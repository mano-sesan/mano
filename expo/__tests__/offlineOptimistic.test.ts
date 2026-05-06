import { describe, it, expect, beforeEach, vi } from "vitest";
import { store } from "@/store";
import { offlineQueueState, type QueuedMutation } from "@/services/offlineQueue";
import { personsState } from "@/atoms/persons";
import { actionsState } from "@/atoms/actions";
import { consultationsState } from "@/atoms/consultations";
import { treatmentsState } from "@/atoms/treatments";

const { mockStorage, mockEncryption } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
  mockEncryption: {
    getHashedOrgEncryptionKey: vi.fn(() => "hashed-key"),
    decryptDBItem: vi.fn(async (item: any) => item),
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

import { applyMutationToAtoms, rehydrateOptimisticUpdates, hydrateAtomsFromMMKV } from "@/services/offlineOptimistic";

function makeItem(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: "q-1",
    method: "PUT",
    path: "/person/p1",
    decryptedBody: { decrypted: { name: "Alice" } },
    entityType: "person",
    entityId: "p1",
    entityUpdatedAt: "2026-01-01T00:00:00.000Z",
    timestamp: Date.now(),
    status: "pending",
    ...overrides,
  };
}

beforeEach(() => {
  mockStorage.clear();
  store.set(offlineQueueState, []);
  store.set(personsState, []);
  store.set(actionsState, []);
  store.set(consultationsState, []);
  store.set(treatmentsState, []);
  vi.clearAllMocks();
  mockEncryption.getHashedOrgEncryptionKey.mockReturnValue("hashed-key");
  mockEncryption.decryptDBItem.mockImplementation(async (item: any) => item);
});

describe("applyMutationToAtoms", () => {
  it("DELETE : marque deletedAt et l'entité est filtrée par mergeItems", () => {
    store.set(personsState, [{ _id: "p1", name: "Alice" }] as any);

    applyMutationToAtoms(makeItem({ method: "DELETE", entityId: "p1", decryptedBody: null }));

    const persons = store.get(personsState);
    // mergeItems exclut les items avec deletedAt → atom vide
    expect(persons).toHaveLength(0);
  });

  it("PUT : flatten du decryptedBody avec _pendingSync et _queueItemId", () => {
    applyMutationToAtoms(makeItem({ id: "q-42", method: "PUT", entityId: "p1", decryptedBody: { decrypted: { name: "Bob" } } }));

    const persons = store.get(personsState);
    expect(persons).toHaveLength(1);
    expect(persons[0]).toMatchObject({
      _id: "p1",
      name: "Bob",
      _pendingSync: true,
      _queueItemId: "q-42",
    });
  });

  it("PUT : merge top-level + decrypted dans le flatten", () => {
    applyMutationToAtoms(
      makeItem({
        method: "PUT",
        entityId: "p1",
        decryptedBody: { createdAt: "2026-01-01", decrypted: { name: "Bob", age: 30 } },
      })
    );

    const persons = store.get(personsState);
    expect(persons[0]).toMatchObject({ _id: "p1", name: "Bob", age: 30, createdAt: "2026-01-01" });
  });

  it("entityKey strippé du body avant flatten (sécurité chiffrement)", () => {
    applyMutationToAtoms(
      makeItem({
        method: "PUT",
        entityId: "p1",
        decryptedBody: { entityKey: "secret-key", decrypted: { name: "Bob" } },
      })
    );

    const persons = store.get(personsState);
    expect(persons[0]).not.toHaveProperty("entityKey");
    expect(persons[0]).toMatchObject({ _id: "p1", name: "Bob" });
  });

  it("POST sur entité nouvelle : ajoutée à l'atom avec flags optimistes", () => {
    applyMutationToAtoms(makeItem({ method: "POST", entityId: "p2", decryptedBody: { decrypted: { name: "New" } } }));

    const persons = store.get(personsState);
    expect(persons).toHaveLength(1);
    expect(persons[0]).toMatchObject({ _id: "p2", name: "New", _pendingSync: true });
  });

  it("entityType inconnu : no-op silencieux", () => {
    store.set(personsState, [{ _id: "p1", name: "Alice" }] as any);

    applyMutationToAtoms(makeItem({ entityType: "unknown-type", entityId: "x" }));

    expect(store.get(personsState)).toEqual([{ _id: "p1", name: "Alice" }]);
  });

  it("decryptedBody null sur PUT/POST : no-op (early return)", () => {
    store.set(personsState, [{ _id: "p1", name: "Alice" }] as any);

    applyMutationToAtoms(makeItem({ method: "PUT", entityId: "p1", decryptedBody: null }));

    expect(store.get(personsState)).toEqual([{ _id: "p1", name: "Alice" }]);
  });

  it("non-medical : cache MMKV mis à jour", () => {
    applyMutationToAtoms(makeItem({ method: "PUT", entityId: "p1", decryptedBody: { decrypted: { name: "Bob" } } }));

    const cached = mockStorage.get("person");
    expect(cached).toBeDefined();
    const parsed = JSON.parse(cached!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ _id: "p1", name: "Bob", _pendingSync: true });
  });

  it("medical (consultation) : cache MMKV PAS mis à jour (sécurité chiffrement)", () => {
    applyMutationToAtoms(
      makeItem({
        entityType: "consultation",
        entityId: "c1",
        method: "PUT",
        decryptedBody: { decrypted: { name: "Consult" } },
      })
    );

    expect(mockStorage.get("consultation")).toBeUndefined();
    // Mais l'atom est bien à jour
    const consultations = store.get(consultationsState);
    expect(consultations).toHaveLength(1);
    expect(consultations[0]).toMatchObject({ _id: "c1", name: "Consult" });
  });

  it("medical (treatment) : cache MMKV PAS mis à jour", () => {
    applyMutationToAtoms(
      makeItem({
        entityType: "treatment",
        entityId: "t1",
        method: "PUT",
        decryptedBody: { decrypted: { name: "Treat" } },
      })
    );

    expect(mockStorage.get("treatment")).toBeUndefined();
    expect(store.get(treatmentsState)).toHaveLength(1);
  });

  it("consultation : formatConsultation appliqué (defaultConsultationFields fusionnés)", () => {
    applyMutationToAtoms(
      makeItem({
        entityType: "consultation",
        entityId: "c1",
        method: "POST",
        decryptedBody: { decrypted: { name: "Consult" } },
      })
    );

    const consultations = store.get(consultationsState);
    expect(consultations[0]).toHaveProperty("isConsultation", true);
  });
});

describe("rehydrateOptimisticUpdates", () => {
  it("réapplique les items pending et processing", () => {
    store.set(offlineQueueState, [
      makeItem({ id: "q1", entityId: "p1", status: "pending", decryptedBody: { decrypted: { name: "Pending" } } }),
      makeItem({ id: "q2", entityId: "p2", status: "processing", decryptedBody: { decrypted: { name: "Processing" } } }),
    ]);

    rehydrateOptimisticUpdates();

    const persons = store.get(personsState);
    expect(persons).toHaveLength(2);
    expect(persons.map((p: any) => p._id).sort()).toEqual(["p1", "p2"]);
  });

  it("ignore les items conflict et failed", () => {
    store.set(offlineQueueState, [
      makeItem({ id: "q1", entityId: "p1", status: "conflict", decryptedBody: { decrypted: { name: "Conflict" } } }),
      makeItem({ id: "q2", entityId: "p2", status: "failed", decryptedBody: { decrypted: { name: "Failed" } } }),
    ]);

    rehydrateOptimisticUpdates();

    expect(store.get(personsState)).toHaveLength(0);
  });

  it("file vide : no-op", () => {
    store.set(personsState, [{ _id: "p1", name: "Existing" }] as any);
    store.set(offlineQueueState, []);

    rehydrateOptimisticUpdates();

    expect(store.get(personsState)).toEqual([{ _id: "p1", name: "Existing" }]);
  });

  it("ordre préservé : applique dans l'ordre de la queue", () => {
    store.set(offlineQueueState, [
      makeItem({ id: "q1", entityId: "p1", status: "pending", decryptedBody: { decrypted: { name: "First" } } }),
      makeItem({ id: "q2", entityId: "p1", status: "pending", decryptedBody: { decrypted: { name: "Second" } } }),
    ]);

    rehydrateOptimisticUpdates();

    const persons = store.get(personsState);
    expect(persons).toHaveLength(1);
    expect(persons[0].name).toBe("Second");
  });
});

describe("hydrateAtomsFromMMKV", () => {
  it("non-medical : charge depuis MMKV vers les atoms", async () => {
    mockStorage.set("person", JSON.stringify([{ _id: "p1", name: "Cached" }]));
    mockStorage.set("action", JSON.stringify([{ _id: "a1", name: "ActionCached" }]));

    await hydrateAtomsFromMMKV();

    expect(store.get(personsState)).toEqual([{ _id: "p1", name: "Cached" }]);
    expect(store.get(actionsState)).toEqual([{ _id: "a1", name: "ActionCached" }]);
  });

  it("medical : ignoré si pas de encryption key (atom reste vide)", async () => {
    mockEncryption.getHashedOrgEncryptionKey.mockReturnValue(null as any);
    mockStorage.set("consultation", JSON.stringify([{ _id: "c1", encrypted: "..." }]));

    await hydrateAtomsFromMMKV();

    expect(store.get(consultationsState)).toEqual([]);
    expect(mockEncryption.decryptDBItem).not.toHaveBeenCalled();
  });

  it("medical : décrypte chaque item via decryptDBItem", async () => {
    mockStorage.set(
      "consultation",
      JSON.stringify([
        { _id: "c1", encrypted: "enc1" },
        { _id: "c2", encrypted: "enc2" },
      ])
    );
    mockEncryption.decryptDBItem.mockImplementation(async (item: any) => ({
      _id: item._id,
      name: `decrypted-${item._id}`,
    }));

    await hydrateAtomsFromMMKV();

    expect(mockEncryption.decryptDBItem).toHaveBeenCalledTimes(2);
    const consultations = store.get(consultationsState);
    expect(consultations).toHaveLength(2);
    expect(consultations.map((c: any) => c.name).sort()).toEqual(["decrypted-c1", "decrypted-c2"]);
  });

  it("medical : items qui échouent au déchiffrement (null) sont skippés", async () => {
    mockStorage.set(
      "consultation",
      JSON.stringify([
        { _id: "c1", encrypted: "enc1" },
        { _id: "c2", encrypted: "broken" },
      ])
    );
    mockEncryption.decryptDBItem.mockImplementation(async (item: any) => {
      if (item._id === "c2") return null;
      return { _id: item._id, name: "ok" };
    });

    await hydrateAtomsFromMMKV();

    const consultations = store.get(consultationsState);
    expect(consultations).toHaveLength(1);
    expect(consultations[0]._id).toBe("c1");
  });

  it("consultation : formatConsultation appliqué après déchiffrement", async () => {
    mockStorage.set("consultation", JSON.stringify([{ _id: "c1", encrypted: "enc" }]));
    mockEncryption.decryptDBItem.mockImplementation(async () => ({ _id: "c1", name: "Test" }));

    await hydrateAtomsFromMMKV();

    const consultations = store.get(consultationsState);
    expect(consultations[0]).toHaveProperty("isConsultation", true);
  });

  it("JSON corrompu en MMKV : fallback à []", async () => {
    mockStorage.set("person", "not-json{{{");

    await hydrateAtomsFromMMKV();

    expect(store.get(personsState)).toEqual([]);
  });

  it("clé MMKV absente : fallback à []", async () => {
    // Pas de mockStorage.set
    await hydrateAtomsFromMMKV();
    expect(store.get(personsState)).toEqual([]);
  });
});
