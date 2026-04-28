import { store } from "@/store";
import { offlineModeState } from "@/atoms/offlineMode";
import { enqueue, offlineQueueState, loadQueueFromStorage, type QueuedMutation } from "@/services/offlineQueue";
import { processQueue, conflictsState, syncStatusState } from "@/services/syncProcessor";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { entityFixtures, type EntityFixture } from "./fixtures/entityFixtures";

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
vi.mock("uuid", () => ({ v4: () => `uuid-${++uuidCounter}` }));
vi.mock("@/services/sentry", () => ({ capture: vi.fn() }));
vi.mock("@/services/api", () => ({ default: mockApi }));

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
    }
  );
  return { refreshTriggerState };
});

function seedQueue(items: QueuedMutation[]) {
  mockStorage.set("mano-offline-queue", JSON.stringify(items));
  store.set(offlineQueueState, items);
}

function makeItem(fixture: EntityFixture, overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: `q-${fixture.entityType}-1`,
    method: "PUT",
    path: `${fixture.apiPath}/${fixture.entityId}`,
    decryptedBody: fixture.putBody,
    entityType: fixture.entityType,
    entityId: fixture.entityId,
    entityUpdatedAt: fixture.putBody.updatedAt,
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
  uuidCounter = 0;
});

describe.each(entityFixtures)("$entityType", (fixture) => {
  describe("enqueue + déduplication", () => {
    it("enqueue PUT : stocke le body et capture entityUpdatedAt", () => {
      const item = enqueue({
        method: "PUT",
        path: `${fixture.apiPath}/${fixture.entityId}`,
        decryptedBody: fixture.putBody,
        entityType: fixture.entityType,
        entityId: fixture.entityId,
        entityUpdatedAt: fixture.putBody.updatedAt,
      });

      expect(item.entityUpdatedAt).toBe(fixture.putBody.updatedAt);
      expect(item.decryptedBody).toEqual(fixture.putBody);
      expect(item.decryptedBody!.decrypted).toBeDefined();
      expect(item.status).toBe("pending");

      const queue = loadQueueFromStorage();
      expect(queue).toHaveLength(1);
      expect(queue[0].decryptedBody).toEqual(fixture.putBody);
    });

    it("dédup PUT+PUT : fusionne les champs decrypted et conserve le entityUpdatedAt original", () => {
      // Premier PUT
      enqueue({
        method: "PUT",
        path: `${fixture.apiPath}/${fixture.entityId}`,
        decryptedBody: fixture.putBody,
        entityType: fixture.entityType,
        entityId: fixture.entityId,
        entityUpdatedAt: fixture.putBody.updatedAt,
      });

      // Deuxième PUT (mise à jour partielle)
      enqueue({
        method: "PUT",
        path: `${fixture.apiPath}/${fixture.entityId}`,
        decryptedBody: fixture.putBodyPartialUpdate,
        entityType: fixture.entityType,
        entityId: fixture.entityId,
        entityUpdatedAt: fixture.putBodyPartialUpdate.updatedAt,
      });

      const queue = loadQueueFromStorage();
      expect(queue).toHaveLength(1);

      // Le entityUpdatedAt doit être celui du premier PUT (pour la détection de conflits)
      expect(queue[0].entityUpdatedAt).toBe(fixture.putBody.updatedAt);

      // Les champs decrypted doivent être fusionnés
      const merged = queue[0].decryptedBody!.decrypted;
      const originalFields = fixture.putBody.decrypted;
      const updateFields = fixture.putBodyPartialUpdate.decrypted;

      // Tous les champs du premier PUT doivent être présents
      for (const key of Object.keys(originalFields)) {
        if (key in updateFields) {
          // Les champs mis à jour doivent avoir la nouvelle valeur
          expect(merged[key]).toEqual(updateFields[key]);
        } else {
          // Les champs non modifiés doivent garder l'ancienne valeur
          expect(merged[key]).toEqual(originalFields[key]);
        }
      }

      // Les nouveaux champs du deuxième PUT doivent aussi être présents
      for (const key of Object.keys(updateFields)) {
        expect(merged[key]).toEqual(updateFields[key]);
      }
    });

    it("dédup PUT+POST→POST : fusionne le body dans le POST", () => {
      // POST (création)
      enqueue({
        method: "POST",
        path: `${fixture.apiPath}/multiple`,
        decryptedBody: fixture.postBody,
        entityType: fixture.entityType,
        entityId: fixture.entityId,
      });

      // PUT (mise à jour de l'entité qui vient d'être créée)
      enqueue({
        method: "PUT",
        path: `${fixture.apiPath}/${fixture.entityId}`,
        decryptedBody: fixture.putBodyPartialUpdate,
        entityType: fixture.entityType,
        entityId: fixture.entityId,
        entityUpdatedAt: fixture.putBodyPartialUpdate.updatedAt,
      });

      const queue = loadQueueFromStorage();
      expect(queue).toHaveLength(1);
      // La méthode doit rester POST (le serveur n'a jamais vu l'entité)
      expect(queue[0].method).toBe("POST");

      // Les champs decrypted de la mise à jour doivent être fusionnés
      const merged = queue[0].decryptedBody!.decrypted;
      for (const key of Object.keys(fixture.putBodyPartialUpdate.decrypted)) {
        expect(merged[key]).toEqual(fixture.putBodyPartialUpdate.decrypted[key]);
      }
    });

    it("dédup DELETE après POST : supprime l'élément (jamais existé sur le serveur)", () => {
      // POST
      enqueue({
        method: "POST",
        path: `${fixture.apiPath}/multiple`,
        decryptedBody: fixture.postBody,
        entityType: fixture.entityType,
        entityId: fixture.entityId,
      });

      // DELETE
      enqueue({
        method: "DELETE",
        path: `${fixture.apiPath}/${fixture.entityId}`,
        decryptedBody: null,
        entityType: fixture.entityType,
        entityId: fixture.entityId,
      });

      const queue = loadQueueFromStorage();
      expect(queue).toHaveLength(0);
    });

    it("dédup DELETE après PUT : remplace par DELETE et conserve entityUpdatedAt", () => {
      const originalUpdatedAt = fixture.putBody.updatedAt;

      // PUT
      enqueue({
        method: "PUT",
        path: `${fixture.apiPath}/${fixture.entityId}`,
        decryptedBody: fixture.putBody,
        entityType: fixture.entityType,
        entityId: fixture.entityId,
        entityUpdatedAt: originalUpdatedAt,
      });

      // DELETE
      enqueue({
        method: "DELETE",
        path: `${fixture.apiPath}/${fixture.entityId}`,
        decryptedBody: null,
        entityType: fixture.entityType,
        entityId: fixture.entityId,
      });

      const queue = loadQueueFromStorage();
      expect(queue).toHaveLength(1);
      expect(queue[0].method).toBe("DELETE");
      // Le entityUpdatedAt du PUT original doit être conservé pour la détection de conflits
      expect(queue[0].entityUpdatedAt).toBe(originalUpdatedAt);
    });
  });

  describe("sync (processQueue)", () => {
    it("sync sans conflit : executeRaw appelé quand le updatedAt serveur correspond", async () => {
      seedQueue([makeItem(fixture)]);

      mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
      mockApi.get.mockResolvedValueOnce({
        ok: true,
        data: { _id: fixture.entityId, updatedAt: fixture.putBody.updatedAt },
        decryptedData: { ...fixture.serverEntity, updatedAt: fixture.putBody.updatedAt },
      });
      mockApi.executeRaw.mockResolvedValueOnce({ ok: true });

      await processQueue();

      expect(mockApi.executeRaw).toHaveBeenCalledWith({
        method: "PUT",
        path: `${fixture.apiPath}/${fixture.entityId}`,
        body: fixture.putBody,
      });
      expect(loadQueueFromStorage()).toHaveLength(0);
      expect(store.get(syncStatusState)).toBe("idle");
    });

    it("sync avec conflit : conflit créé quand le updatedAt serveur diffère", async () => {
      const serverUpdatedAt = "2026-02-01T00:00:00.000Z";
      seedQueue([makeItem(fixture)]);

      mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
      mockApi.get.mockResolvedValueOnce({
        ok: true,
        data: { _id: fixture.entityId, updatedAt: serverUpdatedAt },
        decryptedData: { ...fixture.serverEntity, updatedAt: serverUpdatedAt },
      });

      await processQueue();

      expect(mockApi.executeRaw).not.toHaveBeenCalled();

      const conflicts = store.get(conflictsState);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        entityType: fixture.entityType,
        entityId: fixture.entityId,
        changedFields: fixture.expectedChangedFields,
        localUpdatedAt: fixture.putBody.updatedAt,
        serverUpdatedAt,
      });

      const queue = loadQueueFromStorage();
      expect(queue).toHaveLength(1);
      expect(queue[0].status).toBe("conflict");
    });

    it("POST : pas de détection de conflit, executeRaw appelé directement", async () => {
      seedQueue([
        makeItem(fixture, {
          method: "POST",
          path: `${fixture.apiPath}/multiple`,
          decryptedBody: fixture.postBody,
          entityUpdatedAt: undefined,
        }),
      ]);

      mockApi.get.mockResolvedValueOnce({ ok: true }); // auth seulement
      mockApi.executeRaw.mockResolvedValueOnce({ ok: true });

      await processQueue();

      // Seul le check auth, pas de GET pour vérifier l'entité
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(mockApi.executeRaw).toHaveBeenCalledTimes(1);
      expect(loadQueueFromStorage()).toHaveLength(0);
    });

    it("REGRESSION : updatedAt manquant saute la détection de conflit", async () => {
      // Ce test documente le comportement actuel : si entityUpdatedAt est undefined,
      // la condition à la ligne 64 de syncProcessor.ts court-circuite et le PUT
      // est envoyé sans vérifier les conflits.
      seedQueue([makeItem(fixture, { entityUpdatedAt: undefined })]);

      mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
      mockApi.executeRaw.mockResolvedValueOnce({ ok: true });

      await processQueue();

      // executeRaw est appelé sans détection de conflit
      expect(mockApi.executeRaw).toHaveBeenCalledTimes(1);
      // Seul le check auth, pas de GET pour l'entité
      expect(mockApi.get).toHaveBeenCalledTimes(1);
    });
  });
});
