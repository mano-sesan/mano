import { atom } from "jotai";
import { v4 as uuidv4 } from "uuid";
import { storage } from "@/services/storage";
import { store } from "@/store";

const QUEUE_KEY = "mano-offline-queue";

export interface QueuedMutation {
  id: string;
  method: "POST" | "PUT" | "DELETE";
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

function persistQueue(queue: QueuedMutation[]) {
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
