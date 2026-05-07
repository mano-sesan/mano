import { vi } from "vitest";
import { store } from "@/store";
import { offlineQueueState, type QueuedMutation } from "@/services/offlineQueue";
import { conflictsState, syncProgressState, syncStatusState } from "@/services/syncProcessor";
import { offlineModeState } from "@/atoms/offlineMode";

export const QUEUE_STORAGE_KEY = "mano-offline-queue";

export function makeMmkvMock() {
  const storage = new Map<string, string>();
  class MMKVMock {
    getString(key: string) {
      return storage.get(key);
    }
    set(key: string, value: string) {
      storage.set(key, value);
    }
    delete(key: string) {
      storage.delete(key);
    }
    clearAll() {
      storage.clear();
    }
  }
  return { storage, MMKVMock };
}

export function makeApiMock() {
  return {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    _doUpload: vi.fn(),
  };
}

export function makeEncryptionMock() {
  return {
    getHashedOrgEncryptionKey: vi.fn(() => "test-hashed-key"),
    decryptDBItem: vi.fn(async (item: any) => item),
    encryptItem: vi.fn(async (item: any) => item),
    derivedMasterKey: vi.fn(),
    encryptFile: vi.fn(),
    decryptFile: vi.fn(),
  };
}

export async function makeLoaderMock() {
  const { atom } = await import("jotai");
  const defaultVal = { status: false, options: { showFullScreen: false, initialLoad: false } };
  const base = atom(defaultVal);
  const refreshTriggerState = atom(
    (get) => get(base),
    (_get: any, set: any, update: typeof defaultVal) => {
      set(base, update);
      if (update.status) {
        Promise.resolve().then(() => set(base, defaultVal));
      }
    }
  );
  return { refreshTriggerState };
}

export function makeQueueItem(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
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

export function seedQueue(mockStorage: Map<string, string>, items: QueuedMutation[]) {
  mockStorage.set(QUEUE_STORAGE_KEY, JSON.stringify(items));
  store.set(offlineQueueState, items);
}

export function readQueueFromStorage(mockStorage: Map<string, string>): QueuedMutation[] {
  const raw = mockStorage.get(QUEUE_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function resetOfflineState(mockStorage: Map<string, string>) {
  mockStorage.clear();
  store.set(offlineQueueState, []);
  store.set(conflictsState, []);
  store.set(syncStatusState, "idle");
  store.set(syncProgressState, { current: 0, total: 0 });
  store.set(offlineModeState, false);
}
