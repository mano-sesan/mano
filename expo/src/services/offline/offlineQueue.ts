import { atom } from "jotai";
import { v4 as uuidv4 } from "uuid";
import { storage } from "@/services/storage";
import { store } from "@/store";
import type { MutateMethod } from "@/types/api";

const QUEUE_KEY = "mano-offline-queue";

export interface QueuedMutation {
  id: string;
  method: MutateMethod;
  path: string;
  decryptedBody: Record<string, any> | null;
  entityType: string;
  entityId: string;
  entityUpdatedAt?: string;
  timestamp: number;
  status: "pending" | "processing" | "failed" | "conflict";
  error?: string;
  fileUpload?: {
    fileName: string;
    fileType?: string;
    entityKey?: string;
    encryptedEntityKey: string;
    encryptedFile: string;
  };
}

export const offlineQueueState = atom<QueuedMutation[]>([]);
export const offlineQueueCountState = atom<number>((get) => get(offlineQueueState).length);

export function persistQueue(queue: QueuedMutation[]) {
  storage.set(QUEUE_KEY, JSON.stringify(queue));
  store.set(offlineQueueState, queue);
}

export function loadQueueFromStorage(): QueuedMutation[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function initQueue() {
  const queue = loadQueueFromStorage();
  store.set(offlineQueueState, queue);
}

export function enqueue(mutation: Omit<QueuedMutation, "id" | "timestamp" | "status">): QueuedMutation {
  const queue = loadQueueFromStorage();

  // Deduplicate: merge with existing pending item for the same entity
  if (mutation.entityId && mutation.entityType) {
    const existingIndex = queue.findIndex((m) => m.status === "pending" && m.entityId === mutation.entityId && m.entityType === mutation.entityType);

    if (existingIndex !== -1) {
      const existing = queue[existingIndex];

      if (mutation.method === "DELETE") {
        // DELETE after POST → remove the POST entirely (entity never existed on server)
        if (existing.method === "POST") {
          queue.splice(existingIndex, 1);
          persistQueue(queue);
          return existing; // nothing to send
        }
        // DELETE after PUT → replace with DELETE, keep original entityUpdatedAt
        queue[existingIndex] = {
          ...existing,
          method: "DELETE",
          path: mutation.path,
          decryptedBody: mutation.decryptedBody,
          timestamp: Date.now(),
        };
        persistQueue(queue);
        return queue[existingIndex];
      }

      if (mutation.method === "PUT") {
        if (existing.method === "POST") {
          // PUT after POST → merge body into the POST (server never saw the entity)
          const mergedBody = { ...existing.decryptedBody, ...mutation.decryptedBody };
          if (existing.decryptedBody?.decrypted || mutation.decryptedBody?.decrypted) {
            mergedBody.decrypted = { ...existing.decryptedBody?.decrypted, ...mutation.decryptedBody?.decrypted };
          }
          queue[existingIndex] = { ...existing, decryptedBody: mergedBody, timestamp: Date.now() };
          persistQueue(queue);
          return queue[existingIndex];
        }
        if (existing.method === "PUT") {
          // PUT after PUT → replace body, keep original entityUpdatedAt for conflict detection
          const mergedBody = { ...existing.decryptedBody, ...mutation.decryptedBody };
          if (existing.decryptedBody?.decrypted || mutation.decryptedBody?.decrypted) {
            mergedBody.decrypted = { ...existing.decryptedBody?.decrypted, ...mutation.decryptedBody?.decrypted };
          }
          queue[existingIndex] = { ...existing, decryptedBody: mergedBody, path: mutation.path, timestamp: Date.now() };
          persistQueue(queue);
          return queue[existingIndex];
        }
      }
    }
  }

  const item: QueuedMutation = {
    ...mutation,
    id: uuidv4(),
    timestamp: Date.now(),
    status: "pending",
  };
  queue.push(item);
  persistQueue(queue);
  return item;
}

export function updateQueueItemStatus(id: string, updates: Pick<QueuedMutation, "status" | "error">) {
  const queue = loadQueueFromStorage();
  const index = queue.findIndex((m) => m.id === id);
  if (index !== -1) {
    queue[index] = { ...queue[index], ...updates };
    persistQueue(queue);
  }
}

export function removeQueueItem(id: string) {
  const queue = loadQueueFromStorage().filter((m) => m.id !== id);
  persistQueue(queue);
}

export function clearQueue() {
  persistQueue([]);
}
