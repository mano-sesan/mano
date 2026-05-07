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
  // Mirrors the real early-return cascade in encryption.js (deletedAt and missing
  // entityKey items pass through unchanged) so tests covering deletedAt items
  // exercise the same code paths as production.
  decryptDBItem: vi.fn(async (item: any) => {
    if (!item.encrypted) return item;
    if (item.deletedAt) return item;
    if (!item.encryptedEntityKey) return item;
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
import { organisationState, userState, teamsState } from "@/atoms/auth";

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
// fetch routing — picks a handler per pathname; handler receives the URL so it
// can react to query params (e.g. pagination via `page=`).
// =============================================================================
type RouteHandler = (url: URL) => any;

function makeFetch(routes: Record<string, RouteHandler>) {
  return vi.fn(async (url: string) => {
    const u = new URL(url);
    const handler = routes[u.pathname];
    if (!handler) throw new Error(`unmocked path: ${u.pathname}`);
    return {
      ok: true,
      status: 200,
      json: async () => handler(u),
    };
  });
}

function buildRoutes(opts: {
  stats?: Partial<Record<string, number>>;
  overrides?: Record<string, RouteHandler>;
  userResponse?: any;
} = {}): Record<string, RouteHandler> {
  const stats: Record<string, number> = {};
  for (const e of ENTITIES) stats[e.statsKey] = opts.stats?.[e.statsKey] ?? 1;

  const routes: Record<string, RouteHandler> = {
    "/user/me": () =>
      opts.userResponse ?? {
        ok: true,
        user: {
          _id: "u1",
          role: "admin",
          email: "test@example.org",
          organisation: { _id: "o1", encryptionLastUpdateAt: 1, disabledAt: null },
          orgTeams: [],
        },
      },
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

  Object.assign(routes, opts.overrides ?? {});
  return routes;
}

function statsForOnly(entityName: string, count = 1): Record<string, number> {
  const result: Record<string, number> = {};
  for (const e of ENTITIES) result[e.statsKey] = e.name === entityName ? count : 0;
  return result;
}

function entityCfg(name: string): EntityCfg {
  const e = ENTITIES.find((x) => x.name === name);
  if (!e) throw new Error(`unknown entity ${name}`);
  return e;
}

function readAtom(ref: any): any {
  const setter = __atomSetters.get(ref);
  if (!setter) return __atomStore.get(ref);
  const lastCall = setter.mock.calls.at(-1);
  if (!lastCall) return __atomStore.get(ref);
  const arg = lastCall[0];
  return typeof arg === "function" ? arg(__atomStore.get(ref) ?? []) : arg;
}

function readCache(key: string): any[] {
  const raw = __mmkvStore.get(key);
  return raw ? JSON.parse(raw) : [];
}

function seedAtom(ref: any, value: any) {
  __atomStore.set(ref, value);
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

describe("useDataLoader().startInitialLoad — edge cases", () => {
  it("skips entity loaders when stats indicate 0 items, and writes empty caches", async () => {
    const allZeroStats: Record<string, number> = {};
    for (const e of ENTITIES) allZeroStats[e.statsKey] = 0;

    const fetchSpy = makeFetch(buildRoutes({ stats: allZeroStats }));
    vi.stubGlobal("fetch", fetchSpy);

    const loader = useDataLoader();
    await loader.startInitialLoad();

    const calledPaths = fetchSpy.mock.calls.map((c: any) => new URL(c[0]).pathname);
    for (const e of ENTITIES) {
      expect(calledPaths, `should NOT fetch ${e.apiPath}`).not.toContain(e.apiPath);
    }
    // Initial load still writes an empty array to MMKV for every entity.
    for (const e of ENTITIES) {
      expect(readCache(e.mmkvKey), `${e.mmkvKey} cache should be empty array`).toEqual([]);
    }
  });

  it("paginates entity loaders while hasMore is true", async () => {
    const fetchSpy = makeFetch(
      buildRoutes({
        stats: statsForOnly("persons", 2),
        overrides: {
          "/person": (u) =>
            u.searchParams.get("page") === "0"
              ? { ok: true, data: [{ _id: "p-page-0", encrypted: "ENC", encryptedEntityKey: "EEK" }], hasMore: true }
              : { ok: true, data: [{ _id: "p-page-1", encrypted: "ENC", encryptedEntityKey: "EEK" }], hasMore: false },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await useDataLoader().startInitialLoad();

    const cached = readCache("person");
    expect(cached).toHaveLength(2);
    expect(cached.map((p: any) => p._id).sort()).toEqual(["p-page-0", "p-page-1"]);

    const personPages = fetchSpy.mock.calls
      .map((c: any) => new URL(c[0]))
      .filter((u: URL) => u.pathname === "/person")
      .map((u: URL) => u.searchParams.get("page"));
    expect(personPages).toEqual(["0", "1"]);
  });

  it("removes deletedAt items from cache via mergeItems (non-medical)", async () => {
    // Pre-seed cache with an existing person; API sends back the same _id but with deletedAt.
    __mmkvStore.set("person", JSON.stringify([{ _id: "p1", name: "old", __decrypted: true }]));

    vi.stubGlobal(
      "fetch",
      makeFetch(
        buildRoutes({
          stats: statsForOnly("persons", 1),
          overrides: {
            "/person": () => ({
              ok: true,
              data: [{ _id: "p1", deletedAt: "2024-01-01", encrypted: "ENC", encryptedEntityKey: "EEK" }],
              hasMore: false,
            }),
          },
        }),
      ),
    );

    await useDataLoader().startInitialLoad();

    expect(readCache("person")).toEqual([]);
    expect(readAtom(personsState)).toEqual([]);
  });

  it("removes deletedAt items from MMKV cache for medical entities", async () => {
    __mmkvStore.set(
      "consultation",
      JSON.stringify([{ _id: "c1", encrypted: "OLD-ENC", encryptedEntityKey: "OLD-EEK" }]),
    );

    vi.stubGlobal(
      "fetch",
      makeFetch(
        buildRoutes({
          stats: statsForOnly("consultations", 1),
          overrides: {
            "/consultation": () => ({
              ok: true,
              data: [{ _id: "c1", deletedAt: "2024-01-01", encrypted: "ENC", encryptedEntityKey: "EEK" }],
              hasMore: false,
            }),
          },
        }),
      ),
    );

    await useDataLoader().startInitialLoad();

    expect(readCache("consultation")).toEqual([]);
  });

  it("calls resetLoaderOnError when /user/me returns ok:false", async () => {
    const { Alert } = await import("react-native");
    (Alert.alert as any).mockClear();

    const fetchSpy = makeFetch(buildRoutes({ userResponse: { ok: false, error: "boom" } }));
    vi.stubGlobal("fetch", fetchSpy);

    await useDataLoader().startInitialLoad();

    expect((Alert.alert as any)).toHaveBeenCalled();
    expect((Alert.alert as any).mock.calls[0][0]).toBe("Erreur");

    // No entity endpoint should have been hit after the auth failure.
    const calledPaths = fetchSpy.mock.calls.map((c: any) => new URL(c[0]).pathname);
    for (const e of ENTITIES) {
      expect(calledPaths).not.toContain(e.apiPath);
    }
  });

  it("calls resetLoaderOnError when an entity endpoint returns ok:false", async () => {
    const { Alert } = await import("react-native");
    (Alert.alert as any).mockClear();

    vi.stubGlobal(
      "fetch",
      makeFetch(
        buildRoutes({
          stats: statsForOnly("persons", 1),
          overrides: { "/person": () => ({ ok: false, error: "server fail" }) },
        }),
      ),
    );

    await useDataLoader().startInitialLoad();

    expect((Alert.alert as any).mock.calls[0][0]).toBe("Erreur");
  });
});

describe("useDataLoader().refresh — refresh path", () => {
  it("merges new items with existing atom + cache state (non-medical)", async () => {
    // organisationState must match latestOrganisation.encryptionLastUpdateAt or the
    // refresh bails out with an "encryption key changed" alert.
    seedAtom(organisationState, { _id: "o1", encryptionLastUpdateAt: 1 });
    seedAtom(userState, { _id: "u1", role: "admin" });
    seedAtom(teamsState, []);

    const existing = { _id: "p-existing", name: "old", __decrypted: true };
    seedAtom(personsState, [existing]);
    __mmkvStore.set("person", JSON.stringify([existing]));

    vi.stubGlobal(
      "fetch",
      makeFetch(
        buildRoutes({
          stats: statsForOnly("persons", 1),
          overrides: {
            "/person": () => ({
              ok: true,
              data: [{ _id: "p-new", encrypted: "ENC", encryptedEntityKey: "EEK" }],
              hasMore: false,
            }),
          },
        }),
      ),
    );

    await useDataLoader().refresh();

    const cached = readCache("person");
    expect(cached.map((c: any) => c._id).sort()).toEqual(["p-existing", "p-new"]);
    const newItem = cached.find((c: any) => c._id === "p-new");
    expect(newItem.__decrypted).toBe(true);

    const atomVal = readAtom(personsState);
    expect(atomVal.map((p: any) => p._id).sort()).toEqual(["p-existing", "p-new"]);
  });

  it("preserves encrypted blobs in MMKV cache on medical refresh", async () => {
    seedAtom(organisationState, { _id: "o1", encryptionLastUpdateAt: 1 });
    seedAtom(userState, { _id: "u1", role: "admin" });
    seedAtom(teamsState, []);

    // The medical refresh path calls `setConsultations((prev) => mergeItems(prev, ...))`
    // BEFORE updating MMKV — if `prev` is undefined the reducer throws and the cache
    // update never runs. Seeding the atom mirrors what real React state looks like.
    const existingDecrypted = { _id: "c-existing", __decrypted: true, name: "old", isConsultation: true };
    seedAtom(consultationsState, [existingDecrypted]);

    const existingEncrypted = { _id: "c-existing", encrypted: "OLD-ENC", encryptedEntityKey: "OLD-EEK" };
    __mmkvStore.set("consultation", JSON.stringify([existingEncrypted]));

    vi.stubGlobal(
      "fetch",
      makeFetch(
        buildRoutes({
          stats: statsForOnly("consultations", 1),
          overrides: {
            "/consultation": () => ({
              ok: true,
              data: [{ _id: "c-new", encrypted: "NEW-ENC", encryptedEntityKey: "NEW-EEK" }],
              hasMore: false,
            }),
          },
        }),
      ),
    );

    await useDataLoader().refresh();

    const cached = readCache("consultation");
    expect(cached).toHaveLength(2);
    const newCached = cached.find((c: any) => c._id === "c-new");
    expect(newCached.encrypted, "new medical item must be cached encrypted").toBe("NEW-ENC");
    expect(newCached.encryptedEntityKey).toBe("NEW-EEK");
    const oldCached = cached.find((c: any) => c._id === "c-existing");
    expect(oldCached.encrypted, "pre-existing encrypted blob must be preserved").toBe("OLD-ENC");

    // Atom should also have both items.
    const atomVal = readAtom(consultationsState);
    expect(atomVal.map((c: any) => c._id).sort()).toEqual(["c-existing", "c-new"]);
  });
});
