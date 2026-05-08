import { atom } from "jotai";
import { store } from "@/store";
import { atomWithCache } from "@/utils/atomWithCache";
import { offlineModeState } from "@/atoms/offlineMode";
import { loadQueueFromStorage, removeQueueItem, persistQueue, updateQueueItemStatus, type QueuedMutation, clearQueue } from "./offlineQueue";
import API from "../api";
import { useDataLoader } from "../dataLoader";
import { storage } from "../storage";
import { personsState } from "@/atoms/persons";
import { consultationsState } from "@/atoms/consultations";
import { treatmentsState } from "@/atoms/treatments";
import { medicalFileState } from "@/atoms/medicalFiles";
import { actionsState } from "@/atoms/actions";
import { territoryObservationsState } from "@/atoms/territoryObservations";
import { mergeDocuments } from "./documentsMerge";
import { mergeComments } from "./commentsMerge";
import { mergeHistory } from "./historyMerge";
import { stripOfflineAddedFlag } from "./offlineFlags";
import type { PrimitiveAtom } from "jotai";

// Champs ignorés pour décider s'il reste un conflit "réel" après auto-merge
// (documents, comments, history). Doit rester aligné avec HIDDEN_FIELDS de
// ConflictResolution.tsx. `assignedTeams` n'est PAS dans cette liste : c'est
// un champ que l'utilisateur peut éditer et dont les conflits doivent être
// résolus manuellement dans l'UI.
const FIELDS_NOT_TRIGGERING_CONFLICT = new Set([
  "updatedAt",
  "createdAt",
  "updatedBy",
  "entityKey",
  "entityUpdatedAt",
  "history",
  "documents",
  "comments",
  "_id",
  "organisation",
  "encrypted",
  "encryptedEntityKey",
  "deletedAt",
  "_pendingSync",
  "_queueItemId",
]);

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

// export for testing usage
export async function processQueue(refresh: () => Promise<any>): Promise<void> {
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

    // Step 2: Check if there are items to process. Process file_uploads first so
    // their real server filename is substituted into any queued entity mutation
    // (person POST/PUT, etc.) that references the pending- placeholder before
    // that mutation is sent.
    const queue = loadQueueFromStorage()
      .filter((m) => m.status === "pending" || m.status === "failed")
      .sort((a, b) => {
        const aIsUpload = a.entityType === "file_upload" ? 0 : 1;
        const bIsUpload = b.entityType === "file_upload" ? 0 : 1;
        return aIsUpload - bIsUpload;
      });
    // console.log("queue", queue);
    if (queue.length === 0) {
      store.set(syncStatusState, "idle");
      store.set(syncProgressState, { current: 0, total: 0 });
      clearQueue();
      isSyncing = false;
      return;
    }

    // Step 3: Pull first — trigger incremental sync to get latest server state
    await refresh();

    // Step 4: Process queue items
    store.set(syncProgressState, { current: 0, total: queue.length });

    for (let i = 0; i < queue.length; i++) {
      // Re-read from storage: a previous file_upload may have rewritten this
      // item's body to substitute its pending- placeholder with the real filename.
      const item = loadQueueFromStorage().find((m) => m.id === queue[i].id);
      if (!item) continue;
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

function persistQueueItemBody(itemId: string, body: Record<string, any>) {
  const queue = loadQueueFromStorage();
  const idx = queue.findIndex((q) => q.id === itemId);
  if (idx === -1) return;
  queue[idx] = { ...queue[idx], decryptedBody: body };
  persistQueue(queue);
}

function bumpQueueItemEntityUpdatedAt(itemId: string, newEntityUpdatedAt: string | undefined) {
  if (!newEntityUpdatedAt) return;
  const queue = loadQueueFromStorage();
  const idx = queue.findIndex((q) => q.id === itemId);
  if (idx === -1) return;
  queue[idx] = { ...queue[idx], entityUpdatedAt: newEntityUpdatedAt };
  persistQueue(queue);
}

function hasRealConflict(localDecrypted: Record<string, any> | undefined, serverEntity: Record<string, any>): boolean {
  if (!localDecrypted) return false;
  for (const key of Object.keys(localDecrypted)) {
    if (FIELDS_NOT_TRIGGERING_CONFLICT.has(key)) continue;
    if (JSON.stringify(localDecrypted[key]) !== JSON.stringify(serverEntity[key])) return true;
  }
  return false;
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
      const localBody = item.decryptedBody || {};

      // Auto-merge des champs tableau qui ne devraient JAMAIS être en conflit
      // utilisateur — sans ça, le PUT offline écraserait silencieusement les
      // ajouts/suppressions effectués côté serveur pendant la session offline.
      //
      //  - documents : merge par _id avec tag `_offlineAdded`, re-parentage des
      //    orphelins. Voir documentsMerge.ts.
      //  - comments  : merge par _id avec tag `_offlineAdded`. Voir commentsMerge.ts.
      //  - history   : append-only log, dédup par contenu (pas de tag requis).
      let bodyMutated = false;
      const localDocs = localBody.decrypted?.documents;
      const serverDocs = serverEntity.documents;
      if (Array.isArray(localDocs) || Array.isArray(serverDocs)) {
        const merged = mergeDocuments(localDocs, serverDocs);
        if (localBody.decrypted) localBody.decrypted.documents = merged;
        serverEntity.documents = merged;
        bodyMutated = true;
      }
      const localComments = localBody.decrypted?.comments;
      const serverComments = serverEntity.comments;
      if (Array.isArray(localComments) || Array.isArray(serverComments)) {
        const merged = mergeComments(localComments, serverComments);
        if (localBody.decrypted) localBody.decrypted.comments = merged;
        serverEntity.comments = merged;
        bodyMutated = true;
      }
      const localHistory = localBody.decrypted?.history;
      const serverHistory = serverEntity.history;
      if (Array.isArray(localHistory) || Array.isArray(serverHistory)) {
        const merged = mergeHistory(localHistory, serverHistory);
        if (localBody.decrypted) localBody.decrypted.history = merged;
        serverEntity.history = merged;
        bodyMutated = true;
      }
      if (bodyMutated) persistQueueItemBody(item.id, localBody);

      // Si tous les champs locaux sont soit identiques au serveur soit ignorés
      // (HIDDEN_FIELDS / champs techniques), c'était un conflit purement
      // documentaire — on aligne l'entityUpdatedAt et on laisse le PUT partir
      // sans surface UI.
      if (!hasRealConflict(localBody.decrypted, serverEntity)) {
        bumpQueueItemEntityUpdatedAt(item.id, serverEntity.updatedAt);
        return null;
      }

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

    const cleanBody = stripOfflineAddedFlag(item.decryptedBody);

    let response;
    switch (item.method) {
      case "POST":
        response = await API.post({ path: item.path, body: cleanBody!, offlineEnabled: false });
        break;
      case "PUT":
        response = await API.put({ path: item.path, body: cleanBody!, offlineEnabled: false });
        break;
      case "DELETE":
        response = await API.delete({ path: item.path, body: cleanBody!, offlineEnabled: false });
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
      const fileMetadata = response.data;
      if (fileMetadata?.filename) {
        const placeholder = `pending-${item.entityId}`;
        substitutePendingFilenameInQueue(placeholder, fileMetadata);
        substitutePendingFilenameInAtoms(placeholder, fileMetadata);
      }
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

// When a queued file_upload completes, the server assigns a final filename. Any
// queued PUT/POST that already references the placeholder (e.g. a person update
// containing the new document) must be rewritten before it's sent, otherwise
// the synced entity points to a file that doesn't exist on the server.
function substitutePendingFilenameInQueue(placeholder: string, fileMetadata: Record<string, any>) {
  const realFilename: string = fileMetadata.filename;
  const queue = loadQueueFromStorage();
  let changed = false;

  for (const item of queue) {
    const documents = item.decryptedBody?.decrypted?.documents;
    if (!Array.isArray(documents)) continue;
    for (const doc of documents) {
      if (!doc) continue;
      if (doc._id === placeholder) {
        doc._id = realFilename;
        changed = true;
      }
      if (doc.file?.filename === placeholder) {
        doc.file = { ...doc.file, ...fileMetadata };
        changed = true;
      }
      if (typeof doc.downloadPath === "string" && doc.downloadPath.endsWith(`/${placeholder}`)) {
        doc.downloadPath = doc.downloadPath.slice(0, -placeholder.length) + realFilename;
        changed = true;
      }
    }
  }

  console.log("[sync] substitutePendingFilenameInQueue", { placeholder, realFilename, changed, queueSize: queue.length });
  if (changed) persistQueue(queue);
}

const atomsWithDocuments: Array<{ atom: PrimitiveAtom<any[]>; mmkvKey: string | null }> = [
  { atom: personsState as PrimitiveAtom<any[]>, mmkvKey: "person" },
  { atom: consultationsState as PrimitiveAtom<any[]>, mmkvKey: null },
  { atom: treatmentsState as PrimitiveAtom<any[]>, mmkvKey: null },
  { atom: medicalFileState as PrimitiveAtom<any[]>, mmkvKey: null },
  { atom: actionsState as PrimitiveAtom<any[]>, mmkvKey: "action" },
  { atom: territoryObservationsState as PrimitiveAtom<any[]>, mmkvKey: "territory-observation" },
];

// Mirrors the queue substitution onto the in-memory atoms (and their MMKV cache),
// so the UI reflects the real filename immediately — without waiting for the
// post-sync refresh — and a tap during sync doesn't fall back into _downloadFromQueue.
function substitutePendingFilenameInAtoms(placeholder: string, fileMetadata: Record<string, any>) {
  const realFilename: string = fileMetadata.filename;
  let totalChanged = 0;

  for (const { atom: entityAtom, mmkvKey } of atomsWithDocuments) {
    const list = store.get(entityAtom) as any[] | undefined;
    if (!Array.isArray(list)) continue;
    let entityChanged = false;

    const next = list.map((entity) => {
      if (!Array.isArray(entity?.documents)) return entity;
      let docsChanged = false;
      const documents = entity.documents.map((doc: any) => {
        if (!doc) return doc;
        const docHasPlaceholder = doc._id === placeholder || doc.file?.filename === placeholder;
        if (!docHasPlaceholder) return doc;
        docsChanged = true;
        const updated = { ...doc };
        if (updated._id === placeholder) updated._id = realFilename;
        if (updated.file?.filename === placeholder) updated.file = { ...updated.file, ...fileMetadata };
        if (typeof updated.downloadPath === "string" && updated.downloadPath.endsWith(`/${placeholder}`)) {
          updated.downloadPath = updated.downloadPath.slice(0, -placeholder.length) + realFilename;
        }
        return updated;
      });
      if (!docsChanged) return entity;
      entityChanged = true;
      return { ...entity, documents };
    });

    if (entityChanged) {
      totalChanged++;
      store.set(entityAtom, next);
      if (mmkvKey) storage.set(mmkvKey, JSON.stringify(next));
    }
  }

  console.log("[sync] substitutePendingFilenameInAtoms", { placeholder, realFilename, atomsUpdated: totalChanged });
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
