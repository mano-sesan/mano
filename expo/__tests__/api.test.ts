import { describe, it, expect, vi, beforeEach } from "vitest";

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

// fetch-retry returns a wrapper around fetch. We bypass retry logic in tests by
// returning a function that always calls globalThis.fetch at call time, so the
// `vi.stubGlobal("fetch", ...)` in each test takes effect.
vi.mock("fetch-retry", () => ({
  default:
    () =>
    (...args: any[]) =>
      (globalThis.fetch as any)(...args),
}));

// Pinned by __tests__/encryption.test.ts: decryptDBItem currently mutates the
// input by deleting `encrypted`. The stub mimics that contract so the only way
// `res.data[0].encrypted` survives api.js's `execute()` is if api.js no longer
// runs the array decrypt loop.
vi.mock("@/services/encryption", () => ({
  decryptDBItem: vi.fn(async (item: any) => {
    if (!item.encrypted) return item;
    delete item.encrypted;
    return { ...item, __decrypted: true, name: "decrypted" };
  }),
  getHashedOrgEncryptionKey: () => "fake-key",
  encryptFile: vi.fn(),
  decryptFile: vi.fn(),
  encryptItem: vi.fn(async (item: any) => item),
}));

vi.mock("@/services/sentry", () => ({
  capture: vi.fn(),
}));

vi.mock("@sentry/react-native", () => ({
  setUser: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import API from "@/services/api";

function mockFetch(body: any, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("API.get — array response (e.g. /consultation)", () => {
  it("returns res.data with `encrypted` field intact (post-fix invariant)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ok: true,
        data: [{ _id: "c1", encrypted: "ENC", encryptedEntityKey: "EEK" }],
        hasMore: false,
      })
    );

    const res = await API.get({ path: "/consultation" });

    expect(res.ok).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].encrypted).toBe("ENC");
    expect(res.data[0].encryptedEntityKey).toBe("EEK");
  });

  it("does not populate res.decryptedData for array responses (post-fix invariant)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ok: true,
        data: [{ _id: "c1", encrypted: "ENC", encryptedEntityKey: "EEK" }],
        hasMore: false,
      })
    );

    const res = await API.get({ path: "/consultation" });

    expect(res.decryptedData).toBeUndefined();
  });
});

describe("API.get — single-item response (control: behavior unchanged)", () => {
  it("still decrypts a non-array res.data into res.decryptedData", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ok: true,
        data: { _id: "single", encrypted: "ENC", encryptedEntityKey: "EEK" },
      })
    );

    const res = await API.get({ path: "/some/single-resource" });

    expect(res.decryptedData).toMatchObject({ __decrypted: true, name: "decrypted" });
  });
});
