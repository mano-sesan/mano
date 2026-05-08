import { store } from "@/store";
import { offlineModeState } from "@/atoms/offlineMode";
import { offlineQueueState, type QueuedMutation } from "../src/services/offline/offlineQueue";
import { conflictsState, syncStatusState, processQueue, resolveConflict, discardConflict } from "../src/services/offline/syncProcessor";
import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.hoisted runs before vi.mock hoisting — safe to reference in mock factories
const { mockStorage, mockApi, mockRefresh } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
  mockApi: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    _doUpload: vi.fn(),
  },
  mockRefresh: vi.fn(async () => {}),
}));

function totalMutationCalls() {
  return mockApi.post.mock.calls.length + mockApi.put.mock.calls.length + mockApi.delete.mock.calls.length;
}

vi.mock("react-native-mmkv", () => ({
  MMKV: class {
    getString(key: string) {
      return mockStorage.get(key);
    }
    set(key: string, value: string) {
      mockStorage.set(key, value);
    }
    delete(key: string) {
      mockStorage.delete(key);
    }
    clearAll() {
      mockStorage.clear();
    }
  },
}));

vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  Platform: { OS: "ios", select: (obj: any) => obj.ios ?? obj.default },
  StyleSheet: { create: (s: any) => s },
}));
vi.mock("@sentry/react-native", () => ({
  setUser: vi.fn(),
  setContext: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((cb: any) => cb({ setExtras: vi.fn(), setTag: vi.fn() })),
}));
vi.mock("@/services/dataLoader", () => ({ useDataLoader: vi.fn(() => ({ refresh: vi.fn() })) }));
vi.mock("uuid", () => ({ v4: () => "mock-uuid" }));
vi.mock("@/services/sentry", () => ({ capture: vi.fn() }));
vi.mock("@/services/api", () => ({ default: mockApi }));

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

      await processQueue(mockRefresh);

      expect(mockApi.get).not.toHaveBeenCalled();
      expect(store.get(syncStatusState)).toBe("idle");
    });

    it("passe à idle si la queue est vide", async () => {
      mockApi.get.mockResolvedValueOnce({ ok: true }); // check-auth

      await processQueue(mockRefresh);

      expect(store.get(syncStatusState)).toBe("idle");
      expect(totalMutationCalls()).toBe(0);
    });

    it("s'arrête si l'auth échoue", async () => {
      seedQueue([makeQueueItem()]);
      mockApi.get.mockResolvedValueOnce({ ok: false }); // check-auth fails

      await processQueue(mockRefresh);

      expect(store.get(syncStatusState)).toBe("error");
      expect(totalMutationCalls()).toBe(0);
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
      // PUT mutation
      mockApi.put.mockResolvedValueOnce({ ok: true });

      await processQueue(mockRefresh);

      expect(mockApi.put).toHaveBeenCalledWith({
        path: "/action/entity-1",
        body: { decrypted: { name: "Updated action" } },
        offlineEnabled: false,
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
      mockApi.post.mockResolvedValueOnce({ ok: true });

      await processQueue(mockRefresh);

      // POST should not trigger conflict detection (no GET for entity)
      expect(mockApi.get).toHaveBeenCalledTimes(1); // only check-auth
      expect(mockApi.post).toHaveBeenCalledWith({
        path: "/action/multiple",
        body: { decrypted: { name: "Updated action" } },
        offlineEnabled: false,
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

      await processQueue(mockRefresh);

      // Should NOT have called any mutation method for the conflicting item
      expect(totalMutationCalls()).toBe(0);

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

    it("marque comme failed si la mutation échoue", async () => {
      const item = makeQueueItem({ entityUpdatedAt: undefined, method: "POST" });
      seedQueue([item]);

      mockApi.get.mockResolvedValueOnce({ ok: true }); // check-auth
      mockApi.post.mockResolvedValueOnce({ ok: false, error: "Server error" });

      await processQueue(mockRefresh);

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
      mockApi.post.mockResolvedValue({ ok: true });

      await processQueue(mockRefresh);

      expect(mockApi.post).toHaveBeenCalledTimes(2);
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
        entityType: "action",
        entityId: "entity-1",
      });
      expect(store.get(conflictsState)).toHaveLength(0);
      const queue = JSON.parse(mockStorage.get("mano-offline-queue") || "[]");
      expect(queue).toHaveLength(0);
    });
  });

  describe("batch mixte", () => {
    it("1 succès + 1 conflict + 1 fail : queue finit avec [conflict, failed], status error", async () => {
      const okItem = makeQueueItem({ id: "q-ok", entityId: "ok-1", method: "POST", path: "/action/multiple", entityUpdatedAt: undefined });
      const conflictItem = makeQueueItem({ id: "q-conflict", entityId: "conflict-1" });
      const failItem = makeQueueItem({ id: "q-fail", entityId: "fail-1", method: "POST", path: "/action/multiple", entityUpdatedAt: undefined });
      seedQueue([okItem, conflictItem, failItem]);

      mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
      // okItem POST → no conflict detection, success
      mockApi.post.mockResolvedValueOnce({ ok: true });
      // conflictItem PUT → detectConflict triggers, server has different updatedAt
      mockApi.get.mockResolvedValueOnce({
        ok: true,
        data: { _id: "conflict-1", updatedAt: "2099-01-01T00:00:00.000Z" },
        decryptedData: { _id: "conflict-1", updatedAt: "2099-01-01T00:00:00.000Z" },
      });
      // failItem POST → failure
      mockApi.post.mockResolvedValueOnce({ ok: false, error: "Server boom" });

      await processQueue(mockRefresh);

      expect(store.get(syncStatusState)).toBe("error");
      const remaining = JSON.parse(mockStorage.get("mano-offline-queue") || "[]");
      expect(remaining).toHaveLength(2);
      const byId = Object.fromEntries(remaining.map((it: any) => [it.id, it]));
      expect(byId["q-conflict"].status).toBe("conflict");
      expect(byId["q-fail"].status).toBe("failed");
      expect(byId["q-fail"].error).toBe("Server boom");
    });
  });

  describe("régression: pull avant push (commit 38e420340)", () => {
    it("refresh appelé avant la première mutation", async () => {
      const callOrder: string[] = [];
      mockRefresh.mockImplementation(async () => {
        callOrder.push("refresh");
      });
      mockApi.get.mockImplementation(async (req: any) => {
        if (req.path === "/check-auth") {
          callOrder.push("auth");
          return { ok: true };
        }
        callOrder.push(`get:${req.path}`);
        return { ok: true, data: { updatedAt: "2026-01-01T00:00:00.000Z" }, decryptedData: { updatedAt: "2026-01-01T00:00:00.000Z" } };
      });
      mockApi.put.mockImplementation(async () => {
        callOrder.push("mutation");
        return { ok: true };
      });

      seedQueue([makeQueueItem()]);

      await processQueue(mockRefresh);

      const refreshIdx = callOrder.indexOf("refresh");
      const mutIdx = callOrder.indexOf("mutation");
      expect(refreshIdx).toBeGreaterThan(-1);
      expect(mutIdx).toBeGreaterThan(-1);
      expect(refreshIdx).toBeLessThan(mutIdx);
    });
  });

  describe("sync concurrent", () => {
    it("second appel pendant qu'un sync est en cours : no-op", async () => {
      seedQueue([makeQueueItem()]);

      // Auth resolves but slowly, so we can call processQueue again before completion
      let resolveAuth: (val: any) => void;
      mockApi.get.mockReturnValueOnce(new Promise((r) => (resolveAuth = r)));

      const p1 = processQueue(mockRefresh);
      const p2 = processQueue(mockRefresh); // should no-op

      // Drain the second call
      await p2;
      // The second call returned without doing anything: no mutation, no refresh
      expect(totalMutationCalls()).toBe(0);

      // Now finish the first call
      resolveAuth!({ ok: false }); // we don't care about the rest, just need to settle
      await p1;
    });
  });

  describe("erreur réseau (promise rejection)", () => {
    it("mutation throw → status failed avec message capturé", async () => {
      const item = makeQueueItem({ method: "POST", path: "/action/multiple", entityUpdatedAt: undefined });
      seedQueue([item]);

      mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
      mockApi.post.mockRejectedValueOnce(new Error("ECONNRESET"));

      await processQueue(mockRefresh);

      const queue = JSON.parse(mockStorage.get("mano-offline-queue") || "[]");
      expect(queue).toHaveLength(1);
      expect(queue[0].status).toBe("failed");
      expect(queue[0].error).toBe("ECONNRESET");
      expect(store.get(syncStatusState)).toBe("error");
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
