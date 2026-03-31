import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.hoisted runs before vi.mock hoisting — safe to reference in mock factories
const { mockStorage, mockApi } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
  mockApi: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    executeRaw: vi.fn(),
    _doUpload: vi.fn(),
  },
}));

vi.mock("react-native-mmkv", () => ({
  MMKV: class {
    getString(key: string) { return mockStorage.get(key); }
    set(key: string, value: string) { mockStorage.set(key, value); }
    delete(key: string) { mockStorage.delete(key); }
    clearAll() { mockStorage.clear(); }
  },
}));

vi.mock("uuid", () => ({ v4: () => "mock-uuid" }));
vi.mock("@/services/sentry", () => ({ capture: vi.fn() }));
vi.mock("../api", () => ({ default: mockApi }));

// Mock pullSync — the real pullSync sets status:true then waits for status:false.
// This mock atom auto-resets to false on the next microtask to simulate sync completion.
vi.mock("@/components/Loader", async () => {
  const { atom } = await import("jotai");
  const defaultVal = { status: false, options: { showFullScreen: false, initialLoad: false } };
  const base = atom(defaultVal);
  const refreshTriggerState = atom(
    (get) => get(base),
    (_get, set, update: typeof defaultVal) => {
      set(base, update);
      if (update.status) {
        Promise.resolve().then(() => set(base, defaultVal));
      }
    },
  );
  return { refreshTriggerState };
});

import { store } from "@/store";
import { offlineModeState } from "@/recoil/offlineMode";
import { offlineQueueState, type QueuedMutation } from "../offlineQueue";
import { conflictsState, syncStatusState, processQueue, resolveConflict, discardConflict } from "../syncProcessor";

function seedQueue(items: QueuedMutation[]) {
  mockStorage.set("mano-offline-queue", JSON.stringify(items));
  store.set(offlineQueueState, items);
}

function makeQueueItem(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: "q-1",
    method: "PUT",
    path: "/action/entity-1",
    decryptedBody: { decrypted: { name: "Updated action" } },
    entityType: "action",
    entityId: "entity-1",
    entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    timestamp: Date.now(),
    status: "pending",
    ...overrides,
  };
}

beforeEach(() => {
  mockStorage.clear();
  store.set(offlineQueueState, []);
  store.set(conflictsState, []);
  store.set(syncStatusState, "idle");
  store.set(offlineModeState, false);
  vi.clearAllMocks();
});

describe("syncProcessor", () => {
  describe("processQueue", () => {
    it("ne fait rien si le mode offline est activé", async () => {
      store.set(offlineModeState, true);
      seedQueue([makeQueueItem()]);

      await processQueue();

      expect(mockApi.get).not.toHaveBeenCalled();
      expect(store.get(syncStatusState)).toBe("idle");
    });

    it("passe à idle si la queue est vide", async () => {
      mockApi.get.mockResolvedValueOnce({ ok: true }); // check-auth

      await processQueue();

      expect(store.get(syncStatusState)).toBe("idle");
      expect(mockApi.executeRaw).not.toHaveBeenCalled();
    });

    it("s'arrête si l'auth échoue", async () => {
      seedQueue([makeQueueItem()]);
      mockApi.get.mockResolvedValueOnce({ ok: false }); // check-auth fails

      await processQueue();

      expect(store.get(syncStatusState)).toBe("error");
      expect(mockApi.executeRaw).not.toHaveBeenCalled();
    });

    it("traite une mutation PUT sans conflit et la supprime de la queue", async () => {
      const item = makeQueueItem();
      seedQueue([item]);

      // check-auth
      mockApi.get.mockResolvedValueOnce({ ok: true });
      // detectConflict: fetch entity — same updatedAt = no conflict
      mockApi.get.mockResolvedValueOnce({
        ok: true,
        data: { _id: "entity-1", updatedAt: "2026-01-01T00:00:00.000Z" },
        decryptedData: { _id: "entity-1", updatedAt: "2026-01-01T00:00:00.000Z" },
      });
      // executeRaw
      mockApi.executeRaw.mockResolvedValueOnce({ ok: true });

      await processQueue();

      expect(mockApi.executeRaw).toHaveBeenCalledWith({
        method: "PUT",
        path: "/action/entity-1",
        body: { decrypted: { name: "Updated action" } },
      });

      // Queue should be empty after processing
      const remaining = JSON.parse(mockStorage.get("mano-offline-queue") || "[]");
      expect(remaining).toHaveLength(0);
      expect(store.get(syncStatusState)).toBe("idle");
    });

    it("traite une mutation POST (pas de détection de conflit)", async () => {
      const item = makeQueueItem({
        id: "q-post",
        method: "POST",
        path: "/action/multiple",
        entityUpdatedAt: undefined,
      });
      seedQueue([item]);

      mockApi.get.mockResolvedValueOnce({ ok: true }); // check-auth
      mockApi.executeRaw.mockResolvedValueOnce({ ok: true });

      await processQueue();

      // POST should not trigger conflict detection (no GET for entity)
      expect(mockApi.get).toHaveBeenCalledTimes(1); // only check-auth
      expect(mockApi.executeRaw).toHaveBeenCalledWith({
        method: "POST",
        path: "/action/multiple",
        body: { decrypted: { name: "Updated action" } },
      });
    });

    it("détecte un conflit quand updatedAt diffère", async () => {
      const item = makeQueueItem({
        entityUpdatedAt: "2026-01-01T00:00:00.000Z",
      });
      seedQueue([item]);

      mockApi.get.mockResolvedValueOnce({ ok: true }); // check-auth
      // Server has a newer version
      mockApi.get.mockResolvedValueOnce({
        ok: true,
        data: { _id: "entity-1", updatedAt: "2026-01-02T00:00:00.000Z" },
        decryptedData: { _id: "entity-1", updatedAt: "2026-01-02T00:00:00.000Z", name: "Server version" },
      });

      await processQueue();

      // Should NOT have called executeRaw for the conflicting item
      expect(mockApi.executeRaw).not.toHaveBeenCalled();

      // Queue item should be marked as conflict
      const queue = JSON.parse(mockStorage.get("mano-offline-queue")!);
      expect(queue[0].status).toBe("conflict");

      // Conflict should be stored in atom
      const conflicts = store.get(conflictsState);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        entityType: "action",
        entityId: "entity-1",
        queueItemId: "q-1",
      });
    });

    it("marque comme failed si executeRaw échoue", async () => {
      const item = makeQueueItem({ entityUpdatedAt: undefined, method: "POST" });
      seedQueue([item]);

      mockApi.get.mockResolvedValueOnce({ ok: true }); // check-auth
      mockApi.executeRaw.mockResolvedValueOnce({ ok: false, error: "Server error" });

      await processQueue();

      expect(store.get(syncStatusState)).toBe("error");
      const queue = JSON.parse(mockStorage.get("mano-offline-queue")!);
      expect(queue[0].status).toBe("failed");
      expect(queue[0].error).toBe("Server error");
    });

    it("traite plusieurs mutations dans l'ordre", async () => {
      const item1 = makeQueueItem({ id: "q-1", method: "POST", path: "/action/multiple", entityUpdatedAt: undefined, entityId: "a1" });
      const item2 = makeQueueItem({ id: "q-2", method: "POST", path: "/action/multiple", entityUpdatedAt: undefined, entityId: "a2" });
      seedQueue([item1, item2]);

      mockApi.get.mockResolvedValueOnce({ ok: true }); // check-auth
      mockApi.executeRaw.mockResolvedValue({ ok: true });

      await processQueue();

      expect(mockApi.executeRaw).toHaveBeenCalledTimes(2);
      const remaining = JSON.parse(mockStorage.get("mano-offline-queue") || "[]");
      expect(remaining).toHaveLength(0);
    });
  });

  describe("resolveConflict", () => {
    it("envoie un PUT avec les données résolues et nettoie", async () => {
      const conflict = {
        entityType: "action",
        entityId: "entity-1",
        localVersion: { name: "Local" },
        serverVersion: { name: "Server" },
        changedFields: ["name"],
        queueItemId: "q-1",
        localUpdatedAt: "2026-01-01T00:00:00.000Z",
        serverUpdatedAt: "2026-01-02T00:00:00.000Z",
        createdAt: new Date().toISOString(),
      };
      store.set(conflictsState, [conflict]);
      seedQueue([makeQueueItem({ id: "q-1" })]);

      mockApi.put.mockResolvedValueOnce({ ok: true });

      await resolveConflict("q-1", { name: "Merged version" });

      expect(mockApi.put).toHaveBeenCalledWith({
        path: "/action/entity-1",
        body: { name: "Merged version" },
      });
      expect(store.get(conflictsState)).toHaveLength(0);
      const queue = JSON.parse(mockStorage.get("mano-offline-queue") || "[]");
      expect(queue).toHaveLength(0);
    });
  });

  describe("discardConflict", () => {
    it("supprime le conflit et l'élément de la queue sans envoyer de requête", () => {
      const conflict = {
        entityType: "action",
        entityId: "entity-1",
        localVersion: { name: "Local" },
        serverVersion: { name: "Server" },
        changedFields: ["name"],
        queueItemId: "q-1",
        localUpdatedAt: "2026-01-01T00:00:00.000Z",
        serverUpdatedAt: "2026-01-02T00:00:00.000Z",
        createdAt: new Date().toISOString(),
      };
      store.set(conflictsState, [conflict]);
      seedQueue([makeQueueItem({ id: "q-1" })]);

      discardConflict("q-1");

      expect(store.get(conflictsState)).toHaveLength(0);
      const queue = JSON.parse(mockStorage.get("mano-offline-queue") || "[]");
      expect(queue).toHaveLength(0);
      expect(mockApi.put).not.toHaveBeenCalled();
    });
  });
});
