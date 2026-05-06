import { atom } from "jotai";
import { store } from "@/store";
import { atomWithCache } from "@/utils/atomWithCache";
import { offlineModeState } from "@/atoms/offlineMode";
import { loadQueueFromStorage, removeQueueItem, updateQueueItemStatus, type QueuedMutation } from "./offlineQueue";
import API from "./api";
import { useDataLoader } from "./dataLoader";

export type Conflict = {
  entityType: string;
  entityId: string;
  localVersion: Record<string, any>;
  serverVersion: Record<string, any>;
  changedFields: string[];
  queueItemId: string;
  localUpdatedAt: string;
  serverUpdatedAt: string;
  createdAt: string;
};

export const conflictsState = atomWithCache<Conflict[]>("mano-conflicts", []);
export const syncStatusState = atom<"idle" | "syncing" | "error">("idle");
export const syncProgressState = atom<{ current: number; total: number }>({ current: 0, total: 0 });

let isSyncing = false;

async function processQueue(refresh: () => Promise<any>): Promise<void> {
  if (isSyncing) return;
  const offlineMode = store.get(offlineModeState);
  if (offlineMode) return;

  isSyncing = true;
  store.set(syncStatusState, "syncing");

  try {
    // Step 1: Check auth
    const authCheck = await API.get({ path: "/check-auth" });
    if (!authCheck.ok) {
      // Token expired — the existing handleLogoutError will show the re-login prompt
      store.set(syncStatusState, "error");
      isSyncing = false;
      return;
    }

    // Step 2: Check if there are items to process
    const queue = loadQueueFromStorage().filter((m) => m.status === "pending" || m.status === "failed");
    if (queue.length === 0) {
      store.set(syncStatusState, "idle");
      isSyncing = false;
      return;
    }

    // Step 3: Pull first — trigger incremental sync to get latest server state
    await refresh();

    // Step 4: Process queue items
    store.set(syncProgressState, { current: 0, total: queue.length });

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      store.set(syncProgressState, { current: i + 1, total: queue.length });

      // For PUT/DELETE: detect conflicts by checking updatedAt
      if ((item.method === "PUT" || item.method === "DELETE") && item.entityUpdatedAt) {
        const conflict = await detectConflict(item);
        if (conflict) {
          updateQueueItemStatus(item.id, { status: "conflict" });
          const conflicts = store.get(conflictsState);
          store.set(conflictsState, [...conflicts, conflict]);
          continue;
        }
      }

      // Process the mutation
      const success = await processMutation(item);
      if (!success) {
        // Stop processing on hard failure
        store.set(syncStatusState, "error");
        isSyncing = false;
        return;
      }
    }

    // Step 4: Final sync to confirm state
    await refresh();

    store.set(syncStatusState, "idle");
    store.set(syncProgressState, { current: 0, total: 0 });
  } catch (error) {
    console.warn("[syncProcessor] error:", error);
    store.set(syncStatusState, "error");
  } finally {
    isSyncing = false;
  }
}

export function useProcessQueue() {
  const { refresh } = useDataLoader();
  return () => processQueue(refresh);
}

async function detectConflict(item: QueuedMutation): Promise<Conflict | null> {
  // Get the current server version of this entity from the atom cache
  // The pull sync we just did has already updated the atoms with the latest server state
  // We compare the item's entityUpdatedAt (recorded when the user made the offline edit)
  // with the current server updatedAt (now in the atom cache after pull sync)

  const path = `/${item.entityType}`;

  try {
    const response = await API.get({ path: `${path}/${item.entityId}` });
    if (!response.ok || !response.data) return null;

    const serverEntity: any = response.decryptedData || response.data;
    const serverUpdatedAt = new Date(serverEntity.updatedAt).getTime();
    const localUpdatedAt = new Date(item.entityUpdatedAt!).getTime();

    if (serverUpdatedAt !== localUpdatedAt) {
      // Conflict detected
      const localBody = item.decryptedBody || {};
      const changedFields = localBody.decrypted ? Object.keys(localBody.decrypted) : [];

      return {
        entityType: item.entityType,
        entityId: item.entityId,
        localVersion: localBody,
        serverVersion: serverEntity,
        changedFields,
        queueItemId: item.id,
        localUpdatedAt: item.entityUpdatedAt!,
        serverUpdatedAt: serverEntity.updatedAt,
        createdAt: new Date().toISOString(),
      };
    }
  } catch {
    // If we can't fetch the entity (e.g., it's been deleted), no conflict
    return null;
  }

  return null;
}

async function processMutation(item: QueuedMutation): Promise<boolean> {
  updateQueueItemStatus(item.id, { status: "processing" });

  try {
    // Handle file uploads separately
    if (item.entityType === "file_upload" && item.fileUpload) {
      return await processFileUpload(item);
    }

    let response;
    switch (item.method) {
      case "POST":
        response = await API.post({ path: item.path, body: item.decryptedBody!, offlineEnabled: false });
        break;
      case "PUT":
        response = await API.put({ path: item.path, body: item.decryptedBody!, offlineEnabled: false });
        break;
      case "DELETE":
        response = await API.delete({ path: item.path, body: item.decryptedBody!, offlineEnabled: false });
        break;
    }

    if (response?.ok) {
      removeQueueItem(item.id);
      return true;
    }

    // Non-retryable error
    updateQueueItemStatus(item.id, { status: "failed", error: response?.error || "Unknown error" });
    return false;
  } catch (error: any) {
    updateQueueItemStatus(item.id, { status: "failed", error: error?.message || "Network error" });
    return false;
  }
}

async function processFileUpload(item: QueuedMutation): Promise<boolean> {
  const { fileName, fileType, encryptedEntityKey, encryptedFile } = item.fileUpload!;

  try {
    const response = await API._doUpload({
      name: fileName,
      type: fileType!,
      path: item.path,
      encryptedEntityKey,
      encryptedFile,
    });

    if (response?.ok) {
      removeQueueItem(item.id);
      return true;
    }

    updateQueueItemStatus(item.id, { status: "failed", error: response?.error || "Upload failed" });
    return false;
  } catch (error: any) {
    updateQueueItemStatus(item.id, { status: "failed", error: error?.message || "File upload error" });
    return false;
  }
}

export async function resolveConflict(queueItemId: string, resolvedBody: Record<string, any>) {
  const conflicts = store.get(conflictsState);
  const conflict = conflicts.find((c) => c.queueItemId === queueItemId);

  // If the user resolved with merged data, we send a PUT with the resolved version
  if (resolvedBody && conflict) {
    try {
      const res = await API.put({
        path: `/${conflict.entityType}/${conflict.entityId}`,
        body: resolvedBody,
        entityType: conflict.entityType,
        entityId: conflict.entityId,
      });
      if (!res?.ok) {
        console.warn("[syncProcessor] resolveConflict PUT failed:", res?.error);
      } else {
        removeQueueItem(queueItemId);
      }
    } catch (error) {
      console.warn("[syncProcessor] resolveConflict error:", error);
    }
  }

  // Remove the conflict from state after the PUT (or if no PUT needed)
  store.set(
    conflictsState,
    conflicts.filter((c) => c.queueItemId !== queueItemId)
  );
}

export function discardConflict(queueItemId: string) {
  // Keep server version — just remove conflict and queue item
  const conflicts = store.get(conflictsState);
  store.set(
    conflictsState,
    conflicts.filter((c) => c.queueItemId !== queueItemId)
  );
  removeQueueItem(queueItemId);
}
