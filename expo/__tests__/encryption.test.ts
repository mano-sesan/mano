import { describe, it, expect, beforeAll, vi } from "vitest";

// react-native-libsodium is a native module and won't run under vitest in Node.
// Alias it to libsodium-wrappers (pure JS, same API surface) so we exercise real
// crypto in tests rather than stubbing the primitives.
vi.mock("react-native-libsodium", async () => {
  // libsodium-wrappers-sumo is the full build; the standard libsodium-wrappers
  // omits crypto_pwhash, which encryption.js relies on (derivedMasterKey).
  const sodium = (await import("libsodium-wrappers-sumo")).default;
  await sodium.ready;
  return { default: sodium, ready: sodium.ready };
});

vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
}));

vi.mock("@/services/sentry", () => ({
  capture: vi.fn(),
}));

import {
  decryptDBItem,
  encrypt,
  generateEntityKey,
  setOrgEncryptionKey,
  getHashedOrgEncryptionKey,
  resetOrgEncryptionKey,
} from "@/services/encryption";

async function makeEncryptedItem(payload: object) {
  const masterKey = getHashedOrgEncryptionKey();
  const entityKey = await generateEntityKey();
  const { encryptedContent, encryptedEntityKey } = await encrypt(
    JSON.stringify(payload),
    entityKey,
    masterKey,
  );
  return { _id: "x", encrypted: encryptedContent, encryptedEntityKey } as any;
}

beforeAll(async () => {
  await setOrgEncryptionKey("plouf");
});

describe("decryptDBItem — legacy mutation contract", () => {
  // This test pins the CURRENT behavior of decryptDBItem: on success, it mutates
  // the input by removing `item.encrypted`. The dataLoader medical-data bug stems
  // from this mutation; downstream tests (api.test.ts, dataLoader.test.ts) mock
  // decryptDBItem in a way that simulates this exact mutation. If the contract
  // ever changes, this test fails first and signals that the mocks must be
  // re-evaluated.
  it("deletes item.encrypted after a successful decrypt", async () => {
    const item = await makeEncryptedItem({ name: "test" });
    expect(item.encrypted).toBeTruthy();

    const result = await decryptDBItem(item);

    expect(item.encrypted).toBeUndefined();
    expect(result).toMatchObject({ _id: "x", name: "test" });
    expect(result).toHaveProperty("entityKey");
  });

  it("is not idempotent: a second call early-returns the husk", async () => {
    const item = await makeEncryptedItem({ name: "first" });
    const r1 = await decryptDBItem(item);
    const r2 = await decryptDBItem(item);

    expect(r1).toMatchObject({ name: "first" });
    expect(r2).not.toMatchObject({ name: "first" });
    expect(r2).toBe(item);
  });

  it("early-returns the input when item.encrypted is missing", async () => {
    const item = { _id: "z" } as any;
    const result = await decryptDBItem(item);
    expect(result).toBe(item);
  });

  it("early-returns the input when item.deletedAt is set", async () => {
    const item = await makeEncryptedItem({ name: "deleted" });
    item.deletedAt = "2024-01-01";
    const before = item.encrypted;

    const result = await decryptDBItem(item);

    expect(result).toBe(item);
    expect(item.encrypted).toBe(before);
  });

  // Run last because we don't restore the key (avoiding a second ~5s crypto_pwhash).
  it("early-returns the input when no encryption key is set", async () => {
    resetOrgEncryptionKey();
    const item = { _id: "y", encrypted: "x", encryptedEntityKey: "y" } as any;

    const result = await decryptDBItem(item);

    expect(result).toBe(item);
    expect(item.encrypted).toBe("x");
  });
});
