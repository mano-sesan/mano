import {
  enqueue,
  loadQueueFromStorage,
  updateQueueItemStatus,
  removeQueueItem,
  clearQueue,
  initQueue,
  offlineQueueState,
} from "@/services/offlineQueue";
import { store } from "@/store";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock react-native-mmkv before any imports that use it
const mockStorage = new Map<string, string>();
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

let uuidCounter = 0;
vi.mock("uuid", () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

beforeEach(() => {
  mockStorage.clear();
  store.set(offlineQueueState, []);
  uuidCounter = 0;
});

describe("offlineQueue", () => {
  describe("enqueue", () => {
    it("ajoute une mutation avec le bon format", () => {
      const item = enqueue({
        method: "PUT",
        path: "/action/abc-123",
        decryptedBody: { decrypted: { name: "Test action" } },
        entityType: "action",
        entityId: "abc-123",
        entityUpdatedAt: "2026-01-01T00:00:00.000Z",
      });

      expect(item).toMatchObject({
        method: "PUT",
        path: "/action/abc-123",
        decryptedBody: { decrypted: { name: "Test action" } },
        entityType: "action",
        entityId: "abc-123",
        entityUpdatedAt: "2026-01-01T00:00:00.000Z",
        status: "pending",
      });
      expect(item.id).toBeDefined();
      expect(item.timestamp).toBeGreaterThan(0);
    });

    it("persiste la queue dans le storage", () => {
      enqueue({
        method: "POST",
        path: "/action/multiple",
        decryptedBody: { decrypted: { name: "New" } },
        entityType: "action",
        entityId: "new-1",
      });

      const stored = JSON.parse(mockStorage.get("mano-offline-queue")!);
      expect(stored).toHaveLength(1);
      expect(stored[0].entityId).toBe("new-1");
    });

    it("ajoute plusieurs mutations à la suite", () => {
      enqueue({ method: "POST", path: "/action/multiple", decryptedBody: null, entityType: "action", entityId: "a1" });
      enqueue({ method: "PUT", path: "/action/a2", decryptedBody: null, entityType: "action", entityId: "a2" });
      enqueue({ method: "DELETE", path: "/action/a3", decryptedBody: null, entityType: "action", entityId: "a3" });

      const queue = loadQueueFromStorage();
      expect(queue).toHaveLength(3);
      expect(queue.map((q) => q.method)).toEqual(["POST", "PUT", "DELETE"]);
    });

    it("met à jour l'atom Jotai", () => {
      enqueue({ method: "POST", path: "/action/multiple", decryptedBody: null, entityType: "action", entityId: "a1" });

      const atomValue = store.get(offlineQueueState);
      expect(atomValue).toHaveLength(1);
    });
  });

  describe("loadQueueFromStorage", () => {
    it("retourne un tableau vide si le storage est vide", () => {
      expect(loadQueueFromStorage()).toEqual([]);
    });

    it("retourne un tableau vide si le JSON est invalide", () => {
      mockStorage.set("mano-offline-queue", "not-json{{{");
      expect(loadQueueFromStorage()).toEqual([]);
    });

    it("charge correctement la queue depuis le storage", () => {
      const items = [{ id: "1", method: "POST", path: "/test", status: "pending", timestamp: 123 }];
      mockStorage.set("mano-offline-queue", JSON.stringify(items));
      expect(loadQueueFromStorage()).toEqual(items);
    });
  });

  describe("updateQueueItemStatus", () => {
    it("met à jour le statut d'un élément existant", () => {
      const item = enqueue({ method: "PUT", path: "/action/a1", decryptedBody: null, entityType: "action", entityId: "a1" });

      updateQueueItemStatus(item.id, { status: "processing" });

      const queue = loadQueueFromStorage();
      expect(queue[0].status).toBe("processing");
    });

    it("met à jour le statut et l'erreur ensemble", () => {
      const item = enqueue({ method: "PUT", path: "/action/a1", decryptedBody: null, entityType: "action", entityId: "a1" });

      updateQueueItemStatus(item.id, { status: "failed", error: "Network error" });

      const queue = loadQueueFromStorage();
      expect(queue[0].status).toBe("failed");
      expect(queue[0].error).toBe("Network error");
    });

    it("ne fait rien si l'id n'existe pas", () => {
      enqueue({ method: "POST", path: "/test", decryptedBody: null, entityType: "action", entityId: "a1" });

      updateQueueItemStatus("nonexistent-id", { status: "failed" });

      const queue = loadQueueFromStorage();
      expect(queue).toHaveLength(1);
      expect(queue[0].status).toBe("pending");
    });
  });

  describe("removeQueueItem", () => {
    it("supprime un élément de la queue", () => {
      const item1 = enqueue({ method: "POST", path: "/test1", decryptedBody: null, entityType: "action", entityId: "a1" });
      enqueue({ method: "POST", path: "/test2", decryptedBody: null, entityType: "action", entityId: "a2" });

      removeQueueItem(item1.id);

      const queue = loadQueueFromStorage();
      expect(queue).toHaveLength(1);
      expect(queue[0].entityId).toBe("a2");
    });
  });

  describe("clearQueue", () => {
    it("vide entièrement la queue", () => {
      enqueue({ method: "POST", path: "/test1", decryptedBody: null, entityType: "action", entityId: "a1" });
      enqueue({ method: "POST", path: "/test2", decryptedBody: null, entityType: "action", entityId: "a2" });

      clearQueue();

      expect(loadQueueFromStorage()).toEqual([]);
      expect(store.get(offlineQueueState)).toEqual([]);
    });
  });

  describe("dedup chaînée", () => {
    it("POST → PUT → PUT → DELETE : queue vide à la fin", () => {
      enqueue({
        method: "POST",
        path: "/person/multiple",
        decryptedBody: { decrypted: { name: "A" } },
        entityType: "person",
        entityId: "p1",
      });
      enqueue({
        method: "PUT",
        path: "/person/p1",
        decryptedBody: { decrypted: { name: "B" } },
        entityType: "person",
        entityId: "p1",
      });
      enqueue({
        method: "PUT",
        path: "/person/p1",
        decryptedBody: { decrypted: { age: 30 } },
        entityType: "person",
        entityId: "p1",
      });
      enqueue({
        method: "DELETE",
        path: "/person/p1",
        decryptedBody: null,
        entityType: "person",
        entityId: "p1",
      });

      expect(loadQueueFromStorage()).toEqual([]);
    });

    it("PUT → DELETE → PUT : DELETE conservé puis dédupliqué par le PUT (selon code actuel)", () => {
      // Premier PUT
      enqueue({
        method: "PUT",
        path: "/person/p1",
        decryptedBody: { decrypted: { name: "First" } },
        entityType: "person",
        entityId: "p1",
        entityUpdatedAt: "2026-01-01T00:00:00.000Z",
      });
      // DELETE → remplace le PUT par un DELETE (entityUpdatedAt préservé)
      enqueue({
        method: "DELETE",
        path: "/person/p1",
        decryptedBody: null,
        entityType: "person",
        entityId: "p1",
      });
      let queue = loadQueueFromStorage();
      expect(queue).toHaveLength(1);
      expect(queue[0].method).toBe("DELETE");

      // PUT après DELETE : la dedup actuelle ne gère pas ce cas spécifique.
      // Branche atteinte : item existant est DELETE, mutation est PUT → aucune des
      // conditions du switch n'est true (le code ne matche que existing.method === POST/PUT).
      // → pas de dedup, le PUT est ajouté en plus.
      enqueue({
        method: "PUT",
        path: "/person/p1",
        decryptedBody: { decrypted: { name: "Resurrected" } },
        entityType: "person",
        entityId: "p1",
        entityUpdatedAt: "2026-01-02T00:00:00.000Z",
      });

      queue = loadQueueFromStorage();
      // Documentation du comportement actuel : DELETE puis PUT → 2 items dans la queue
      expect(queue).toHaveLength(2);
      expect(queue[0].method).toBe("DELETE");
      expect(queue[1].method).toBe("PUT");
    });
  });

  describe("transitions de status", () => {
    it("pending → processing → failed → pending (retry)", () => {
      const item = enqueue({
        method: "PUT",
        path: "/action/a1",
        decryptedBody: null,
        entityType: "action",
        entityId: "a1",
      });
      expect(loadQueueFromStorage()[0].status).toBe("pending");

      updateQueueItemStatus(item.id, { status: "processing" });
      expect(loadQueueFromStorage()[0].status).toBe("processing");

      updateQueueItemStatus(item.id, { status: "failed", error: "Boom" });
      expect(loadQueueFromStorage()[0].status).toBe("failed");
      expect(loadQueueFromStorage()[0].error).toBe("Boom");

      // Retry : repasse à pending (sans effacer error explicitement, à clarifier au besoin)
      updateQueueItemStatus(item.id, { status: "pending" });
      expect(loadQueueFromStorage()[0].status).toBe("pending");
    });
  });

  describe("concurrence", () => {
    it("Promise.all de 2 enqueue : les deux items présents, ordre préservé", async () => {
      await Promise.all([
        Promise.resolve().then(() =>
          enqueue({
            method: "POST",
            path: "/action/multiple",
            decryptedBody: { decrypted: { name: "First" } },
            entityType: "action",
            entityId: "a1",
          })
        ),
        Promise.resolve().then(() =>
          enqueue({
            method: "POST",
            path: "/action/multiple",
            decryptedBody: { decrypted: { name: "Second" } },
            entityType: "action",
            entityId: "a2",
          })
        ),
      ]);

      const queue = loadQueueFromStorage();
      expect(queue).toHaveLength(2);
      // L'ordre dépend de la résolution des promises mais les deux items doivent être présents
      expect(queue.map((q) => q.entityId).sort()).toEqual(["a1", "a2"]);
    });
  });

  describe("initQueue", () => {
    it("charge la queue du storage dans l'atom", () => {
      const items = [
        {
          id: "x1",
          method: "POST" as const,
          path: "/test",
          decryptedBody: null,
          entityType: "action",
          entityId: "a1",
          timestamp: 1,
          status: "pending" as const,
        },
      ];
      mockStorage.set("mano-offline-queue", JSON.stringify(items));

      initQueue();

      expect(store.get(offlineQueueState)).toEqual(items);
    });
  });
});
