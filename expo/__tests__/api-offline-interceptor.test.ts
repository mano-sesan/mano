/**
 * Tests de l'interceptor offline de api.js (lignes 106-146).
 *
 * Vérifie que les appels POST/PUT/DELETE en mode offline :
 *  - sont enqueue avec le bon shape
 *  - appliquent l'optimiste sur les atoms
 *  - retournent une réponse marquée _offlineQueued
 *  - capturent body.updatedAt comme entityUpdatedAt sur PUT (clé pour la détection de conflits)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { store } from "@/store";
import { offlineModeState } from "@/atoms/offlineMode";
import { offlineQueueState, loadQueueFromStorage } from "@/services/offlineQueue";
import { personsState } from "@/atoms/persons";
import API, { type OfflineApiResponse } from "@/services/api";

const { mockStorage, mockEncryption, mockAlert } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
  mockEncryption: {
    encryptItem: vi.fn(async (item: any) => item),
    decryptItem: vi.fn(async (item: any) => item),
    encryptFile: vi.fn(),
    decryptFile: vi.fn(),
    decryptDBItem: vi.fn(async (item: any) => item),
    getHashedOrgEncryptionKey: vi.fn(() => "hashed"),
  },
  mockAlert: vi.fn(),
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
  Alert: { alert: mockAlert },
  Linking: { openURL: vi.fn() },
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

vi.mock("react-native-blob-util", () => ({ default: {} }));
vi.mock("expo-file-system", () => ({ default: {} }));
vi.mock("expo-application", () => ({ applicationId: "com.test.app" }));
vi.mock("react-native-device-info", () => ({
  getApiLevel: vi.fn(() => 30),
  getBrand: vi.fn(() => "test"),
  getCarrier: vi.fn(() => "test"),
  getDevice: vi.fn(() => "test"),
  getDeviceId: vi.fn(() => "test"),
  getFreeDiskStorage: vi.fn(() => 0),
  getHardware: vi.fn(() => "test"),
  getManufacturer: vi.fn(() => "test"),
  getMaxMemory: vi.fn(() => 0),
  getModel: vi.fn(() => "test"),
  getProduct: vi.fn(() => "test"),
  getReadableVersion: vi.fn(() => "test"),
  getSystemName: vi.fn(() => "test"),
  getSystemVersion: vi.fn(() => "test"),
  getBuildId: vi.fn(() => "test"),
  getTotalDiskCapacity: vi.fn(() => 0),
  getTotalMemory: vi.fn(() => 0),
  getUserAgent: vi.fn(() => "test"),
  isTablet: vi.fn(() => false),
}));
vi.mock("fetch-retry", () => ({ default: () => fetch }));
vi.mock("urijs", () => ({
  default: class URI {
    scheme() {
      return this;
    }
    host() {
      return this;
    }
    path() {
      return this;
    }
    setSearch() {
      return this;
    }
    toString() {
      return "https://test";
    }
  },
}));
vi.mock("@/config", () => ({ HOST: "test", SCHEME: "https", VERSION: "1.0.0" }));
vi.mock("../config", () => ({ HOST: "test", SCHEME: "https", VERSION: "1.0.0" }));

let uuidCounter = 0;
vi.mock("uuid", () => ({ v4: () => `gen-uuid-${++uuidCounter}` }));

beforeEach(() => {
  mockStorage.clear();
  store.set(offlineQueueState, []);
  store.set(personsState, []);
  store.set(offlineModeState, true);
  vi.clearAllMocks();
  uuidCounter = 0;
});

describe("interceptor offline", () => {
  it("POST en offline : génère UUID, enqueue, applique optimiste, retourne _offlineQueued", async () => {
    const result = (await API.execute({
      method: "POST",
      path: "/person/multiple",
      body: { decrypted: { name: "New Person" }, entityKey: "ek-1" },
      entityType: "person",
    })) as OfflineApiResponse;

    expect(result.ok).toBe(true);
    expect(result._offlineQueued).toBe(true);
    expect(result._queueItemId).toBeDefined();
    expect((result.data as any)._pendingSync).toBe(true);
    expect((result.data as any)._id).toBe("gen-uuid-1");

    const queue = loadQueueFromStorage();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      method: "POST",
      path: "/person/multiple",
      entityType: "person",
      entityId: "gen-uuid-1",
      status: "pending",
    });

    // Optimistic dans l'atom
    const persons = store.get(personsState);
    expect(persons).toHaveLength(1);
    expect(persons[0]).toMatchObject({ _id: "gen-uuid-1", name: "New Person", _pendingSync: true });
  });

  it("PUT en offline : capture body.updatedAt comme entityUpdatedAt (clé conflict detection)", async () => {
    const result = (await API.execute({
      method: "PUT",
      path: "/person/p1",
      body: {
        _id: "p1",
        updatedAt: "2026-01-15T10:00:00.000Z",
        decrypted: { name: "Edited" },
        entityKey: "ek-1",
      },
      entityType: "person",
      entityId: "p1",
    })) as OfflineApiResponse;

    expect(result._offlineQueued).toBe(true);

    const queue = loadQueueFromStorage();
    expect(queue).toHaveLength(1);
    expect(queue[0].method).toBe("PUT");
    expect(queue[0].entityUpdatedAt).toBe("2026-01-15T10:00:00.000Z");
  });

  it("DELETE en offline : optimistic apply marque deletedAt sur l'entité", async () => {
    store.set(personsState, [{ _id: "p1", name: "Existing" }] as any);

    const result = (await API.execute({
      method: "DELETE",
      path: "/person/p1",
      body: null,
      entityType: "person",
      entityId: "p1",
    })) as OfflineApiResponse;

    expect(result._offlineQueued).toBe(true);
    // mergeItems exclut les items avec deletedAt → atom vide
    expect(store.get(personsState)).toHaveLength(0);
    expect(loadQueueFromStorage()).toHaveLength(1);
    expect(loadQueueFromStorage()[0].method).toBe("DELETE");
  });

  it("offline + POST sans entityType : Alert et retour ok:false", async () => {
    const result = await API.execute({
      method: "POST",
      path: "/person/multiple",
      body: { decrypted: { name: "X" } },
      // entityType manquant
    });

    expect(result.ok).toBe(false);
    expect(mockAlert).toHaveBeenCalled();
    expect(loadQueueFromStorage()).toHaveLength(0);
  });

  it("offline + offlineEnabled:false : bypass de l'interceptor", async () => {
    // Ce cas devrait passer au flux fetch normal, donc pas d'enqueue.
    // Le fetch va échouer dans les mocks mais on peut vérifier l'absence d'enqueue.
    try {
      await API.execute({
        method: "POST",
        path: "/auth/login",
        body: {},
        entityType: "user",
        entityId: "u1",
        offlineEnabled: false,
      });
    } catch {
      // fetch va échouer dans le test, c'est attendu
    }
    expect(loadQueueFromStorage()).toHaveLength(0);
  });
});
