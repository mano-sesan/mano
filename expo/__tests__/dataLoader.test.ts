import { describe, it, expect, vi, beforeEach } from "vitest";

// =============================================================================
// Shared in-memory state for jotai/MMKV mocks. Hoisted so the vi.mock factories
// (which are themselves hoisted to the top of the file) can access them.
// =============================================================================
const { __atomStore, __atomSetters, __mmkvStore } = vi.hoisted(() => ({
  __atomStore: new Map<any, any>(),
  __atomSetters: new Map<any, any>(),
  __mmkvStore: new Map<string, string>(),
}));

// =============================================================================
// jotai mock — atoms become plain refs; setters are vi.fn() spies. useDataLoader
// only composes useAtom/useSetAtom, so mocking them at the module boundary lets
// us call useDataLoader as a regular function (no React renderer).
// =============================================================================
vi.mock("jotai", () => {
  function getOrCreateSetter(atomRef: any) {
    let setter = __atomSetters.get(atomRef);
    if (!setter) {
      setter = vi.fn((update: any) => {
        const prev = __atomStore.get(atomRef);
        const next = typeof update === "function" ? update(prev) : update;
        __atomStore.set(atomRef, next);
      });
      __atomSetters.set(atomRef, setter);
    }
    return setter;
  }
  return {
    atom: (initOrRead: any, _write?: any) => {
      const ref: any = { __atom: true };
      if (typeof initOrRead !== "function") __atomStore.set(ref, initOrRead);
      return ref;
    },
    useAtom: (ref: any) => [__atomStore.get(ref), getOrCreateSetter(ref)],
    useSetAtom: (ref: any) => getOrCreateSetter(ref),
    createStore: () => ({ get: vi.fn(), set: vi.fn() }),
  };
});

// =============================================================================
// MMKV mock — in-memory Map exposed for assertions.
// =============================================================================
vi.mock("react-native-mmkv", () => {
  class MMKVMock {
    getString(k: string) {
      return __mmkvStore.get(k);
    }
    set(k: string, v: string) {
      __mmkvStore.set(k, v);
    }
    delete(k: string) {
      __mmkvStore.delete(k);
    }
    clearAll() {
      __mmkvStore.clear();
    }
    contains(k: string) {
      return __mmkvStore.has(k);
    }
  }
  return {
    MMKV: MMKVMock,
    useMMKVNumber: () => [undefined, vi.fn()],
  };
});

// =============================================================================
// Native module mocks — keep things runnable in Node.
// =============================================================================
vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  Platform: { OS: "ios" },
  Linking: { openURL: vi.fn() },
}));

vi.mock("react-native-device-info", () => {
  const noop = () => undefined;
  const asyncNoop = async () => undefined;
  return {
    getApiLevel: asyncNoop,
    getBrand: noop,
    getCarrier: asyncNoop,
    getDevice: asyncNoop,
    getDeviceId: noop,
    getFreeDiskStorage: asyncNoop,
    getHardware: asyncNoop,
    getManufacturer: asyncNoop,
    getMaxMemory: asyncNoop,
    getModel: noop,
    getProduct: asyncNoop,
    getReadableVersion: noop,
    getSystemName: noop,
    getSystemVersion: noop,
    getBuildId: asyncNoop,
    getTotalDiskCapacity: asyncNoop,
    getTotalMemory: asyncNoop,
    getUserAgent: asyncNoop,
    isTablet: () => false,
  };
});

vi.mock("react-native-blob-util", () => ({
  default: {
    fetch: vi.fn(),
    fs: { readFile: vi.fn() },
    config: vi.fn(() => ({ fetch: vi.fn() })),
  },
}));

vi.mock("expo-file-system", () => ({
  Paths: { cache: "/tmp" },
  File: class {
    create() {}
    write() {}
    get uri() {
      return "";
    }
  },
}));

vi.mock("expo-application", () => ({
  applicationId: "com.test",
  nativeApplicationVersion: "1.0.0",
}));

vi.mock("@/config", () => ({
  SCHEME: "http",
  HOST: "localhost",
  VERSION: "test",
  APP_ENV: "test",
  MANO_DOWNLOAD_URL: "",
  MANO_TEST_ORGANISATION_ID: "",
  MATOMO_SITE_ID: "",
  MATOMO_URL: "",
  DEVMODE_PASSWORD: "",
  DEVMODE_ENCRYPTION_KEY: "",
  DEVMODE_HIDE_STATUS_BAR: false,
}));

vi.mock("fetch-retry", () => ({
  default:
    () =>
    (...args: any[]) =>
      (globalThis.fetch as any)(...args),
}));

// Pinned by encryption.test.ts: decryptDBItem currently mutates `item.encrypted`.
// The dataLoader runs api.js (real) AND calls decryptDBItem itself in the medical
// branches; both code paths use this stub.
vi.mock("@/services/encryption", () => ({
  decryptDBItem: vi.fn(async (item: any) => {
    if (!item.encrypted) return item;
    delete item.encrypted;
    // `team` and `date` keep reports past the dataLoader's filter
    // (filterNewItemsFunction: (r) => !!r.team && !!r.date). Harmless for others.
    return { ...item, __decrypted: true, name: "decrypted", team: "team1", date: "2024-01-01" };
  }),
  getHashedOrgEncryptionKey: () => "fake-key",
  encryptFile: vi.fn(),
  decryptFile: vi.fn(),
  encryptItem: vi.fn(async (item: any) => item),
}));

vi.mock("@/services/sentry", () => ({
  capture: vi.fn(),
  AppSentry: {},
}));

vi.mock("@sentry/react-native", () => ({
  setUser: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/services/dataManagement", () => ({
  appCurrentCacheKey: "test-cache-key",
  clearCache: vi.fn(),
  initCacheAndcheckIfExpired: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { clear: vi.fn(), getItem: vi.fn(), setItem: vi.fn() },
}));

// =============================================================================
// Imports (after all mocks are set up).
// =============================================================================
import { useDataLoader } from "@/services/dataLoader";
import { personsState } from "@/atoms/persons";
import { groupsState } from "@/atoms/groups";
import { reportsState } from "@/atoms/reports";
import { passagesState } from "@/atoms/passages";
import { rencontresState } from "@/atoms/rencontres";
import { actionsState } from "@/atoms/actions";
import { recurrencesState } from "@/atoms/recurrences";
import { territoriesState } from "@/atoms/territory";
import { placesState } from "@/atoms/places";
import { relsPersonPlaceState } from "@/atoms/relPersonPlace";
import { territoryObservationsState } from "@/atoms/territoryObservations";
import { commentsState } from "@/atoms/comments";
import { consultationsState } from "@/atoms/consultations";
import { treatmentsState } from "@/atoms/treatments";
import { medicalFileState } from "@/atoms/medicalFiles";

// =============================================================================
// Per-entity table — drives both fetch routing and assertions.
// =============================================================================
type EntityCfg = {
  name: string;
  apiPath: string;
  mmkvKey: string;
  statsKey: string;
  cache: "decrypted" | "encrypted";
  atomRef: any;
};

const ENTITIES: EntityCfg[] = [
  { name: "persons", apiPath: "/person", mmkvKey: "person", statsKey: "persons", cache: "decrypted", atomRef: personsState },
  { name: "groups", apiPath: "/group", mmkvKey: "group", statsKey: "groups", cache: "decrypted", atomRef: groupsState },
  { name: "reports", apiPath: "/report", mmkvKey: "report", statsKey: "reports", cache: "decrypted", atomRef: reportsState },
  { name: "passages", apiPath: "/passage", mmkvKey: "passage", statsKey: "passages", cache: "decrypted", atomRef: passagesState },
  { name: "rencontres", apiPath: "/rencontre", mmkvKey: "rencontre", statsKey: "rencontres", cache: "decrypted", atomRef: rencontresState },
  { name: "actions", apiPath: "/action", mmkvKey: "action", statsKey: "actions", cache: "decrypted", atomRef: actionsState },
  { name: "recurrences", apiPath: "/recurrence", mmkvKey: "recurrence", statsKey: "recurrences", cache: "decrypted", atomRef: recurrencesState },
  { name: "territories", apiPath: "/territory", mmkvKey: "territory", statsKey: "territories", cache: "decrypted", atomRef: territoriesState },
  { name: "places", apiPath: "/place", mmkvKey: "place", statsKey: "places", cache: "decrypted", atomRef: placesState },
  { name: "relsPersonPlace", apiPath: "/relPersonPlace", mmkvKey: "relPersonPlace", statsKey: "relsPersonPlace", cache: "decrypted", atomRef: relsPersonPlaceState },
  { name: "territoryObservations", apiPath: "/territory-observation", mmkvKey: "territory-observation", statsKey: "territoryObservations", cache: "decrypted", atomRef: territoryObservationsState },
  { name: "comments", apiPath: "/comment", mmkvKey: "comment", statsKey: "comments", cache: "decrypted", atomRef: commentsState },
  // Medical: cached encrypted in MMKV; reports report has been generated for full coverage of the bug.
  { name: "consultations", apiPath: "/consultation", mmkvKey: "consultation", statsKey: "consultations", cache: "encrypted", atomRef: consultationsState },
  { name: "treatments", apiPath: "/treatment", mmkvKey: "treatment", statsKey: "treatments", cache: "encrypted", atomRef: treatmentsState },
  { name: "medicalFiles", apiPath: "/medical-file", mmkvKey: "medical-file", statsKey: "medicalFiles", cache: "encrypted", atomRef: medicalFileState },
];

// =============================================================================
// fetch routing — picks a handler per pathname.
// =============================================================================
function makeFetch(routes: Record<string, () => any>) {
  return vi.fn(async (url: string) => {
    const u = new URL(url);
    const path = u.pathname;
    const handler = routes[path];
    if (!handler) throw new Error(`unmocked path: ${path}`);
    return {
      ok: true,
      status: 200,
      json: async () => handler(),
    };
  });
}

function buildRoutes(): Record<string, () => any> {
  const stats: Record<string, number> = {};
  for (const e of ENTITIES) stats[e.statsKey] = 1;

  const routes: Record<string, () => any> = {
    "/user/me": () => ({
      ok: true,
      user: {
        _id: "u1",
        role: "admin",
        email: "test@example.org",
        organisation: { _id: "o1", encryptionLastUpdateAt: 1, disabledAt: null },
        orgTeams: [],
      },
    }),
    "/now": () => ({ ok: true, data: 1700000000 }),
    "/organisation/stats": () => ({ ok: true, data: stats }),
  };

  for (const e of ENTITIES) {
    routes[e.apiPath] = () => ({
      ok: true,
      data: [{ _id: `${e.name}-1`, encrypted: "ENC", encryptedEntityKey: "EEK" }],
      hasMore: false,
    });
  }

  return routes;
}

// =============================================================================
// Tests.
// =============================================================================
beforeEach(() => {
  __mmkvStore.clear();
  __atomStore.clear();
  __atomSetters.clear();
});

describe("useDataLoader().startInitialLoad — full data load across all entity types", () => {
  it("populates cache and atoms correctly for every entity", async () => {
    vi.stubGlobal("fetch", makeFetch(buildRoutes()));

    const loader = useDataLoader();
    // startInitialLoad() resolves to undefined (it chains a `.then(() => setIsLoading(false))`),
    // so we can't assert a return value — but we can assert no error alert was raised.
    await loader.startInitialLoad();
    const { Alert } = await import("react-native");
    expect((Alert.alert as any).mock.calls, "no error alert should be shown").toEqual([]);

    // ---------------------------------------------------------------------
    // 1. MMKV cache contracts — non-medical entities cache DECRYPTED items;
    //    medical entities (consultations/treatments/medical-file) cache the
    //    ENCRYPTED payload so they can be re-decrypted in memory only.
    // ---------------------------------------------------------------------
    for (const e of ENTITIES) {
      const raw = __mmkvStore.get(e.mmkvKey);
      const cached = raw ? JSON.parse(raw) : [];
      expect(cached, `MMKV cache for ${e.mmkvKey} should have one item`).toHaveLength(1);

      if (e.cache === "decrypted") {
        expect(cached[0].__decrypted, `${e.mmkvKey} cache should hold decrypted items`).toBe(true);
        expect(cached[0].encrypted, `${e.mmkvKey} cache should not retain raw encrypted blob`).toBeUndefined();
      } else {
        // Medical: MMKV cache MUST keep the encrypted payload so a future refresh
        // can re-decrypt it. The legacy bug strips it via decryptDBItem mutation.
        expect(cached[0].encrypted, `${e.mmkvKey} cache must keep 'encrypted' intact`).toBe("ENC");
        expect(cached[0].encryptedEntityKey, `${e.mmkvKey} cache must keep 'encryptedEntityKey'`).toBe("EEK");
      }
    }

    // ---------------------------------------------------------------------
    // 2. In-memory atoms — every entity must end up with a properly-decrypted
    //    item (carries the `__decrypted` marker added by our stub).
    //    Pre-fix on medical entities, the dataLoader passes already-stripped
    //    items into decryptDBItem and gets husks back without the marker.
    // ---------------------------------------------------------------------
    for (const e of ENTITIES) {
      const setter = __atomSetters.get(e.atomRef);
      expect(setter, `atom setter for ${e.name} must have been called`).toBeTruthy();
      if (!setter) continue;
      const lastCall = setter.mock.calls.at(-1);
      expect(lastCall, `atom ${e.name} setter call args`).toBeTruthy();
      let value: any = lastCall![0];
      if (typeof value === "function") {
        // Reducer-style update — apply against the last seen store value (or [] default).
        value = value(__atomStore.get(e.atomRef) ?? []);
      }
      expect(Array.isArray(value), `atom ${e.name} setter received an array`).toBe(true);
      expect(value).toHaveLength(1);
      expect(value[0].__decrypted, `atom ${e.name} should hold a decrypted item`).toBe(true);
    }
  });
});
