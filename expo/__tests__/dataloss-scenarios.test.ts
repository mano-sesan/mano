/**
 * Scénarios de bout-en-bout sur la transition offline → online.
 * Ces tests simulent un flow complet sans rendu : enqueue + applyOptimistic
 * pendant l'offline, puis processQueue au retour réseau.
 *
 * Frayeur principale : la perte de données silencieuse entre les deux états.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { store } from "@/store";
import { offlineModeState } from "@/atoms/offlineMode";
import { offlineQueueState, enqueue, loadQueueFromStorage, type QueuedMutation } from "@/services/offline/offlineQueue";
import { conflictsState, syncStatusState, processQueue, resolveConflict, discardConflict } from "@/services/offline/syncProcessor";
import { applyMutationToAtoms, rehydrateOptimisticUpdates, hydrateAtomsFromMMKV } from "@/services/offline/offlineOptimistic";
import { personsState } from "@/atoms/persons";

const { mockStorage, mockApi, mockEncryption, mockRefresh } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
  mockApi: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    _doUpload: vi.fn(),
  },
  mockEncryption: {
    getHashedOrgEncryptionKey: vi.fn(() => "hashed-key"),
    decryptDBItem: vi.fn(async (item: any) => item),
  },
  mockRefresh: vi.fn(async () => {}),
}));

function totalMutationCalls() {
  return mockApi.post.mock.calls.length + mockApi.put.mock.calls.length + mockApi.delete.mock.calls.length;
}

/** Recorder unifié pour tester l'ordre de mutations PUT/POST/DELETE */
function recordMutationCalls(): Array<{ method: string; path: string; body?: any }> {
  const calls: Array<{ method: string; path: string; body?: any }> = [];
  mockApi.post.mockImplementation(async (args: any) => {
    calls.push({ method: "POST", path: args.path, body: args.body });
    return { ok: true };
  });
  mockApi.put.mockImplementation(async (args: any) => {
    calls.push({ method: "PUT", path: args.path, body: args.body });
    return { ok: true };
  });
  mockApi.delete.mockImplementation(async (args: any) => {
    calls.push({ method: "DELETE", path: args.path });
    return { ok: true };
  });
  return calls;
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

vi.mock("@/services/sentry", () => ({ capture: vi.fn() }));
vi.mock("@/services/encryption", () => mockEncryption);
vi.mock("@/services/api", () => ({ default: mockApi }));
vi.mock("@/services/dataLoader", () => ({ useDataLoader: vi.fn(() => ({ refresh: vi.fn() })) }));

let uuidCounter = 0;
vi.mock("uuid", () => ({ v4: () => `q-${++uuidCounter}` }));

beforeEach(() => {
  mockStorage.clear();
  store.set(offlineQueueState, []);
  store.set(conflictsState, []);
  store.set(syncStatusState, "idle");
  store.set(offlineModeState, false);
  store.set(personsState, []);
  vi.clearAllMocks();
  uuidCounter = 0;
});

describe("S1. Mutations multiples sur même entité, dédupliquées sans perte de champ", () => {
  it("POST → PUT → PUT : un seul POST avec tous les champs fusionnés", async () => {
    // Offline
    enqueue({
      method: "POST",
      path: "/person/multiple",
      decryptedBody: { decrypted: { name: "Alice", age: 30 } },
      entityType: "person",
      entityId: "p1",
    });
    enqueue({
      method: "PUT",
      path: "/person/p1",
      decryptedBody: { decrypted: { name: "Alice B" } },
      entityType: "person",
      entityId: "p1",
    });
    enqueue({
      method: "PUT",
      path: "/person/p1",
      decryptedBody: { decrypted: { phone: "0123" } },
      entityType: "person",
      entityId: "p1",
    });

    expect(loadQueueFromStorage()).toHaveLength(1);

    // Online
    mockApi.get.mockResolvedValueOnce({ ok: true });
    mockApi.post.mockResolvedValueOnce({ ok: true });
    await processQueue(mockRefresh);

    // Un seul POST envoyé avec tous les champs
    expect(mockApi.post).toHaveBeenCalledTimes(1);
    expect(totalMutationCalls()).toBe(1);
    const call = mockApi.post.mock.calls[0][0];
    expect(call.body.decrypted).toMatchObject({
      name: "Alice B", // dernier wins
      age: 30, // jamais modifié, préservé
      phone: "0123", // ajouté
    });
    expect(loadQueueFromStorage()).toHaveLength(0);
  });
});

describe("S2. Mutations sur entités différentes, ordre préservé", () => {
  it("POST + PUT + DELETE sur entités distinctes : ordre respecté, tout envoyé", async () => {
    enqueue({
      method: "POST",
      path: "/person/multiple",
      decryptedBody: { decrypted: { name: "A" } },
      entityType: "person",
      entityId: "pA",
    });
    enqueue({
      method: "PUT",
      path: "/person/pB",
      decryptedBody: { decrypted: { name: "B updated" } },
      entityType: "person",
      entityId: "pB",
      entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    enqueue({
      method: "DELETE",
      path: "/person/pC",
      decryptedBody: null,
      entityType: "person",
      entityId: "pC",
      entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    enqueue({
      method: "POST",
      path: "/action/multiple",
      decryptedBody: { decrypted: { name: "Action for A" } },
      entityType: "action",
      entityId: "aA",
    });

    expect(loadQueueFromStorage()).toHaveLength(4);

    mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
    // PUT pB conflict-detect : entityUpdatedAt match → no conflict
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: { _id: "pB", updatedAt: "2026-01-01T00:00:00.000Z" },
      decryptedData: { _id: "pB", updatedAt: "2026-01-01T00:00:00.000Z" },
    });
    // DELETE pC conflict-detect : same
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: { _id: "pC", updatedAt: "2026-01-01T00:00:00.000Z" },
      decryptedData: { _id: "pC", updatedAt: "2026-01-01T00:00:00.000Z" },
    });
    const orderedCalls = recordMutationCalls();

    await processQueue(mockRefresh);

    expect(orderedCalls).toHaveLength(4);
    expect(orderedCalls.map((c) => c.method)).toEqual(["POST", "PUT", "DELETE", "POST"]);
    expect(loadQueueFromStorage()).toHaveLength(0);
  });
});

describe("S3. Conflit serveur : aucun écrasement silencieux", () => {
  it("PUT en queue + serveur modifié pendant l'absence → conflit, aucun PUT envoyé", async () => {
    enqueue({
      method: "PUT",
      path: "/person/p1",
      decryptedBody: { decrypted: { name: "LocalEdit" } },
      entityType: "person",
      entityId: "p1",
      entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    });

    mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: { _id: "p1", updatedAt: "2026-02-01T00:00:00.000Z" },
      decryptedData: { _id: "p1", name: "ServerEdit", updatedAt: "2026-02-01T00:00:00.000Z" },
    });

    await processQueue(mockRefresh);

    // Aucun PUT envoyé
    expect(totalMutationCalls()).toBe(0);

    // Conflit en atom
    const conflicts = store.get(conflictsState);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      entityType: "person",
      entityId: "p1",
      changedFields: ["name"],
      localUpdatedAt: "2026-01-01T00:00:00.000Z",
      serverUpdatedAt: "2026-02-01T00:00:00.000Z",
    });
    expect(conflicts[0].localVersion).toMatchObject({ decrypted: { name: "LocalEdit" } });
    expect(conflicts[0].serverVersion).toMatchObject({ name: "ServerEdit" });

    // Item en status conflict
    const queue = loadQueueFromStorage();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe("conflict");
  });
});

describe("S4. Conflit résolu sans fuite", () => {
  it("resolveConflict envoie PUT, retire conflict + queue item", async () => {
    // Setup : un item en conflict
    enqueue({
      method: "PUT",
      path: "/person/p1",
      decryptedBody: { decrypted: { name: "LocalEdit" } },
      entityType: "person",
      entityId: "p1",
      entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    const queueItem = loadQueueFromStorage()[0];
    store.set(conflictsState, [
      {
        entityType: "person",
        entityId: "p1",
        localVersion: { decrypted: { name: "LocalEdit" } },
        serverVersion: { name: "ServerEdit" },
        changedFields: ["name"],
        queueItemId: queueItem.id,
        localUpdatedAt: "2026-01-01T00:00:00.000Z",
        serverUpdatedAt: "2026-02-01T00:00:00.000Z",
        createdAt: new Date().toISOString(),
      },
    ]);

    mockApi.put.mockResolvedValueOnce({ ok: true });

    await resolveConflict(queueItem.id, { name: "Merged" });

    expect(mockApi.put).toHaveBeenCalledWith({
      path: "/person/p1",
      body: { name: "Merged" },
      entityType: "person",
      entityId: "p1",
    });
    expect(store.get(conflictsState)).toHaveLength(0);
    expect(loadQueueFromStorage()).toHaveLength(0);
  });

  it("discardConflict : retire tout sans envoyer de PUT", () => {
    enqueue({
      method: "PUT",
      path: "/person/p1",
      decryptedBody: { decrypted: { name: "LocalEdit" } },
      entityType: "person",
      entityId: "p1",
      entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    const queueItem = loadQueueFromStorage()[0];
    store.set(conflictsState, [
      {
        entityType: "person",
        entityId: "p1",
        localVersion: {},
        serverVersion: {},
        changedFields: [],
        queueItemId: queueItem.id,
        localUpdatedAt: "",
        serverUpdatedAt: "",
        createdAt: "",
      },
    ]);

    discardConflict(queueItem.id);

    expect(store.get(conflictsState)).toHaveLength(0);
    expect(loadQueueFromStorage()).toHaveLength(0);
    expect(mockApi.put).not.toHaveBeenCalled();
  });
});

describe("S5. Crash mid-sync : pas de double-execution, pas de perte", () => {
  it("Erreur après 2 succès → 2 retirés, 3 restent. Re-sync reprend les 3.", async () => {
    // 5 POSTs (pas de conflict detection, pas de pull à mocker)
    for (let i = 1; i <= 5; i++) {
      enqueue({
        method: "POST",
        path: "/person/multiple",
        decryptedBody: { decrypted: { name: `P${i}` } },
        entityType: "person",
        entityId: `p${i}`,
      });
    }
    expect(loadQueueFromStorage()).toHaveLength(5);

    // Premier sync : 2 succès, 3e renvoie un échec dur
    mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
    mockApi.post.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "Network down" });

    await processQueue(mockRefresh);

    // Le 3e item a été marqué failed, le sync s'arrête là
    let queue = loadQueueFromStorage();
    expect(queue).toHaveLength(3); // 2 retirés (succès), 3 restent
    expect(queue[0].status).toBe("failed");
    expect(store.get(syncStatusState)).toBe("error");
    const firstSyncCallCount = totalMutationCalls();

    // Re-sync (réseau revenu) : reprend les 3 restants, tous succès
    mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
    mockApi.post.mockResolvedValue({ ok: true });

    await processQueue(mockRefresh);

    queue = loadQueueFromStorage();
    expect(queue).toHaveLength(0);
    // 3 nouveaux appels mutation : aucun des 2 premiers n'est ré-envoyé
    expect(totalMutationCalls()).toBe(firstSyncCallCount + 3);
  });
});

describe("S6. Cold-boot avec queue : rehydratation sans doublon", () => {
  it("Cache MMKV + queue PUT sur même entité → atom contient une seule entité optimiste", async () => {
    // Préseed : cache MMKV person + queue PUT sur p1
    mockStorage.set("person", JSON.stringify([{ _id: "p1", name: "Cached" }]));
    const queueItem: QueuedMutation = {
      id: "q-boot",
      method: "PUT",
      path: "/person/p1",
      decryptedBody: { decrypted: { name: "Edited" } },
      entityType: "person",
      entityId: "p1",
      entityUpdatedAt: "2026-01-01T00:00:00.000Z",
      timestamp: Date.now(),
      status: "pending",
    };
    mockStorage.set("mano-offline-queue", JSON.stringify([queueItem]));

    // Boot
    store.set(offlineQueueState, [queueItem]);
    await hydrateAtomsFromMMKV();
    rehydrateOptimisticUpdates();

    const persons = store.get(personsState);
    expect(persons).toHaveLength(1);
    expect(persons[0]).toMatchObject({
      _id: "p1",
      name: "Edited",
      _pendingSync: true,
      _queueItemId: "q-boot",
    });
  });

  it("Queue contient POST sur entité non en cache → atom contient la nouvelle entité optimiste", async () => {
    // Cache vide, queue POST sur p2
    mockStorage.set("person", JSON.stringify([]));
    const queueItem: QueuedMutation = {
      id: "q-boot-post",
      method: "POST",
      path: "/person/multiple",
      decryptedBody: { decrypted: { name: "BrandNew" } },
      entityType: "person",
      entityId: "p2",
      timestamp: Date.now(),
      status: "pending",
    };
    mockStorage.set("mano-offline-queue", JSON.stringify([queueItem]));

    store.set(offlineQueueState, [queueItem]);
    await hydrateAtomsFromMMKV();
    rehydrateOptimisticUpdates();

    const persons = store.get(personsState);
    expect(persons).toHaveLength(1);
    expect(persons[0]).toMatchObject({ _id: "p2", name: "BrandNew", _pendingSync: true });
  });
});

describe("S7. Pull sync ne perd pas les optimistes en cours", () => {
  it("rehydrateOptimisticUpdates appliqué après un pull conserve _pendingSync", () => {
    // Le pull a écrit la version serveur dans l'atome
    store.set(personsState, [{ _id: "p1", name: "OldServer", updatedAt: "2026-01-01T00:00:00.000Z" }] as any);
    store.set(offlineQueueState, [
      {
        id: "q-1",
        method: "PUT",
        path: "/person/p1",
        decryptedBody: { decrypted: { name: "Local" } },
        entityType: "person",
        entityId: "p1",
        entityUpdatedAt: "2026-01-01T00:00:00.000Z",
        timestamp: Date.now(),
        status: "pending",
      },
    ]);

    rehydrateOptimisticUpdates();

    const persons = store.get(personsState);
    expect(persons).toHaveLength(1);
    expect(persons[0]).toMatchObject({
      _id: "p1",
      name: "Local",
      _pendingSync: true,
    });
  });
});

describe("S8. DELETE+POST : annulation propre, rien envoyé", () => {
  it("POST puis DELETE sur même entité → queue vide, aucun appel API", async () => {
    enqueue({
      method: "POST",
      path: "/person/multiple",
      decryptedBody: { decrypted: { name: "Temp" } },
      entityType: "person",
      entityId: "ptmp",
    });
    enqueue({
      method: "DELETE",
      path: "/person/ptmp",
      decryptedBody: null,
      entityType: "person",
      entityId: "ptmp",
    });

    expect(loadQueueFromStorage()).toHaveLength(0);

    mockApi.get.mockResolvedValueOnce({ ok: true });
    await processQueue(mockRefresh);

    expect(totalMutationCalls()).toBe(0);
  });
});

describe("S9. PUT puis DELETE : DELETE l'emporte avec entityUpdatedAt préservé", () => {
  it("Un seul DELETE envoyé avec le entityUpdatedAt original (pour conflict detection)", async () => {
    const originalUpdatedAt = "2026-01-01T00:00:00.000Z";

    enqueue({
      method: "PUT",
      path: "/person/p1",
      decryptedBody: { decrypted: { name: "Edit before delete" } },
      entityType: "person",
      entityId: "p1",
      entityUpdatedAt: originalUpdatedAt,
    });
    enqueue({
      method: "DELETE",
      path: "/person/p1",
      decryptedBody: null,
      entityType: "person",
      entityId: "p1",
    });

    const queue = loadQueueFromStorage();
    expect(queue).toHaveLength(1);
    expect(queue[0].method).toBe("DELETE");
    expect(queue[0].entityUpdatedAt).toBe(originalUpdatedAt);

    // Online sync
    mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: { _id: "p1", updatedAt: originalUpdatedAt },
      decryptedData: { _id: "p1", updatedAt: originalUpdatedAt },
    });
    mockApi.delete.mockResolvedValueOnce({ ok: true });

    await processQueue(mockRefresh);

    expect(mockApi.delete).toHaveBeenCalledTimes(1);
    expect(totalMutationCalls()).toBe(1);
  });
});

describe("S10. Failed → retry → success : pas de duplication", () => {
  it("PUT échoue puis réussit au retry : un seul PUT total au serveur", async () => {
    enqueue({
      method: "PUT",
      path: "/person/p1",
      decryptedBody: { decrypted: { name: "Edited" } },
      entityType: "person",
      entityId: "p1",
      entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    });

    // Premier essai : échec
    mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: { _id: "p1", updatedAt: "2026-01-01T00:00:00.000Z" },
      decryptedData: { _id: "p1", updatedAt: "2026-01-01T00:00:00.000Z" },
    });
    mockApi.put.mockResolvedValueOnce({ ok: false, error: "Boom" });

    await processQueue(mockRefresh);

    let queue = loadQueueFromStorage();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe("failed");
    expect(mockApi.put).toHaveBeenCalledTimes(1);

    // Retry : succès
    mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: { _id: "p1", updatedAt: "2026-01-01T00:00:00.000Z" },
      decryptedData: { _id: "p1", updatedAt: "2026-01-01T00:00:00.000Z" },
    });
    mockApi.put.mockResolvedValueOnce({ ok: true });

    await processQueue(mockRefresh);

    queue = loadQueueFromStorage();
    expect(queue).toHaveLength(0);
    // Total : 2 appels PUT (un échec + une réussite), pas 3
    expect(mockApi.put).toHaveBeenCalledTimes(2);
  });
});

describe("S11. entityKey préservé à travers la dedup", () => {
  it("POST avec entityKey puis PUT : entityKey conservé pour le chiffrement", () => {
    enqueue({
      method: "POST",
      path: "/person/multiple",
      decryptedBody: { entityKey: "secret-key-abc", decrypted: { name: "A" } },
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

    const queue = loadQueueFromStorage();
    expect(queue).toHaveLength(1);
    expect(queue[0].decryptedBody?.entityKey).toBe("secret-key-abc");
  });

  it("PUT+PUT : entityKey du premier conservé même si non répété", () => {
    enqueue({
      method: "PUT",
      path: "/person/p1",
      decryptedBody: { entityKey: "key-1", decrypted: { name: "A" } },
      entityType: "person",
      entityId: "p1",
      entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    enqueue({
      method: "PUT",
      path: "/person/p1",
      decryptedBody: { decrypted: { age: 30 } },
      entityType: "person",
      entityId: "p1",
      entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    });

    const queue = loadQueueFromStorage();
    expect(queue).toHaveLength(1);
    expect(queue[0].decryptedBody?.entityKey).toBe("key-1");
  });
});

describe("S12. Item en conflict ne re-déclenche pas une mutation", () => {
  it("Nouvel enqueue sur entité en conflict : ajouté à la suite, pas de dedup", async () => {
    // Premier enqueue + le marquer comme conflict manuellement
    enqueue({
      method: "PUT",
      path: "/person/p1",
      decryptedBody: { decrypted: { name: "Local" } },
      entityType: "person",
      entityId: "p1",
      entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    let queue = loadQueueFromStorage();
    queue[0].status = "conflict";
    mockStorage.set("mano-offline-queue", JSON.stringify(queue));
    store.set(offlineQueueState, queue);

    // Second enqueue : ne doit PAS dédupliquer avec l'item conflict
    enqueue({
      method: "PUT",
      path: "/person/p1",
      decryptedBody: { decrypted: { name: "NewLocal" } },
      entityType: "person",
      entityId: "p1",
      entityUpdatedAt: "2026-01-02T00:00:00.000Z",
    });

    queue = loadQueueFromStorage();
    expect(queue).toHaveLength(2);
    expect(queue[0].status).toBe("conflict");
    expect(queue[1].status).toBe("pending");

    // processQueue ne traite que le pending
    mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: { _id: "p1", updatedAt: "2026-01-02T00:00:00.000Z" },
      decryptedData: { _id: "p1", updatedAt: "2026-01-02T00:00:00.000Z" },
    });
    mockApi.put.mockResolvedValueOnce({ ok: true });

    await processQueue(mockRefresh);

    expect(mockApi.put).toHaveBeenCalledTimes(1);
    expect(mockApi.put.mock.calls[0][0].body.decrypted.name).toBe("NewLocal");

    // L'item conflict reste, le pending est retiré
    queue = loadQueueFromStorage();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe("conflict");
  });
});

describe("S13. Action avec recurrence en offline : champ top-level préservé jusqu'au POST", () => {
  // Régression nommée d'un bug réel : une action créée offline avec un UUID de récurrence
  // doit transporter ce champ jusqu'au POST envoyé au serveur. `recurrence` est un champ
  // TOP-LEVEL (pas dans `decrypted`), particularité du modèle Action — donc piégeux
  // si quelqu'un refactore `flattenDecryptedBody` ou la dedup en pensant que tout est dans decrypted.
  it("POST /action avec recurrence : la valeur arrive intacte au serveur après sync", async () => {
    enqueue({
      method: "POST",
      path: "/action/multiple",
      decryptedBody: {
        _id: "act-1",
        organisation: "org-1",
        status: "A FAIRE",
        dueAt: "2026-02-01T00:00:00.000Z",
        completedAt: null,
        recurrence: "rec-uuid-123", // top-level, comme le modèle Action côté serveur
        decrypted: { name: "Visite récurrente", person: "p-1" },
        entityKey: "ek-1",
      },
      entityType: "action",
      entityId: "act-1",
    });

    mockApi.get.mockResolvedValueOnce({ ok: true }); // auth
    mockApi.post.mockResolvedValueOnce({ ok: true });
    await processQueue(mockRefresh);

    expect(mockApi.post).toHaveBeenCalledTimes(1);
    const sent = mockApi.post.mock.calls[0][0];
    expect(sent.body.recurrence).toBe("rec-uuid-123");
    // Sanity : le champ decrypted.name est aussi là
    expect(sent.body.decrypted.name).toBe("Visite récurrente");
  });

  it("PUT /action après dedup PUT+PUT : recurrence du premier PUT préservé si le 2e ne le précise pas", () => {
    // Cas piégeux : si le user édite l'action 2 fois (une avec recurrence, une sans),
    // la dedup shallow merge top-level → recurrence du premier doit être conservé.
    enqueue({
      method: "PUT",
      path: "/action/act-1",
      decryptedBody: {
        _id: "act-1",
        recurrence: "rec-original",
        updatedAt: "2026-01-01T00:00:00.000Z",
        decrypted: { name: "First edit" },
        entityKey: "ek-1",
      },
      entityType: "action",
      entityId: "act-1",
      entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    enqueue({
      method: "PUT",
      path: "/action/act-1",
      decryptedBody: {
        _id: "act-1",
        updatedAt: "2026-01-01T00:00:00.000Z",
        decrypted: { name: "Second edit" },
        entityKey: "ek-1",
      },
      entityType: "action",
      entityId: "act-1",
      entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    });

    const queue = loadQueueFromStorage();
    expect(queue).toHaveLength(1);
    expect(queue[0].decryptedBody?.recurrence).toBe("rec-original");
    expect(queue[0].decryptedBody?.decrypted.name).toBe("Second edit");
  });
});
