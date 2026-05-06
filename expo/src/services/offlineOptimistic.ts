import type { PrimitiveAtom } from "jotai";

import { store } from "@/store";
import { storage } from "./storage";
import { offlineQueueState, QueuedMutation } from "./offlineQueue";
import { mergeItems } from "./dataLoader";

import { personsState } from "../atoms/persons";
import { groupsState } from "../atoms/groups";
import { reportsState } from "../atoms/reports";
import { passagesState } from "../atoms/passages";
import { rencontresState } from "../atoms/rencontres";
import { actionsState } from "../atoms/actions";
import { recurrencesState } from "../atoms/recurrences";
import { territoriesState } from "../atoms/territory";
import { placesState } from "../atoms/places";
import { relsPersonPlaceState } from "../atoms/relPersonPlace";
import { territoryObservationsState } from "../atoms/territoryObservations";
import { commentsState } from "../atoms/comments";
import { consultationsState, formatConsultation } from "../atoms/consultations";
import { treatmentsState } from "../atoms/treatments";
import { medicalFileState } from "../atoms/medicalFiles";
import { decryptDBItem, getHashedOrgEncryptionKey } from "./encryption";

type EntityRegistryEntry = {
  atom: PrimitiveAtom<any[]>;
  mmkvKey: string;
  formatFn?: (item: any) => any;
  isMedical: boolean;
};

const registry: Record<string, EntityRegistryEntry> = {
  person: { atom: personsState as PrimitiveAtom<any[]>, mmkvKey: "person", isMedical: false },
  group: { atom: groupsState as PrimitiveAtom<any[]>, mmkvKey: "group", isMedical: false },
  report: { atom: reportsState as PrimitiveAtom<any[]>, mmkvKey: "report", isMedical: false },
  passage: { atom: passagesState as PrimitiveAtom<any[]>, mmkvKey: "passage", isMedical: false },
  rencontre: { atom: rencontresState as PrimitiveAtom<any[]>, mmkvKey: "rencontre", isMedical: false },
  action: { atom: actionsState as PrimitiveAtom<any[]>, mmkvKey: "action", isMedical: false },
  recurrence: { atom: recurrencesState as PrimitiveAtom<any[]>, mmkvKey: "recurrence", isMedical: false },
  territory: { atom: territoriesState as PrimitiveAtom<any[]>, mmkvKey: "territory", isMedical: false },
  place: { atom: placesState as PrimitiveAtom<any[]>, mmkvKey: "place", isMedical: false },
  relPersonPlace: { atom: relsPersonPlaceState as PrimitiveAtom<any[]>, mmkvKey: "relPersonPlace", isMedical: false },
  "territory-observation": {
    atom: territoryObservationsState as PrimitiveAtom<any[]>,
    mmkvKey: "territory-observation",
    isMedical: false,
  },
  comment: { atom: commentsState as PrimitiveAtom<any[]>, mmkvKey: "comment", isMedical: false },
  consultation: {
    atom: consultationsState as PrimitiveAtom<any[]>,
    mmkvKey: "consultation",
    formatFn: formatConsultation,
    isMedical: true,
  },
  treatment: { atom: treatmentsState as PrimitiveAtom<any[]>, mmkvKey: "treatment", isMedical: true },
  "medical-file": { atom: medicalFileState as PrimitiveAtom<any[]>, mmkvKey: "medical-file", isMedical: true },
};

function getMMKVCacheItem<T>(key: string, defaultValue: T): T {
  const stored = storage.getString(key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored);
  } catch {
    return defaultValue;
  }
}

function setMMKVCacheItem(key: string, value: unknown) {
  storage.set(key, JSON.stringify(value));
}

function flattenDecryptedBody(body: Record<string, any> | null): Record<string, any> | null {
  if (!body) return null;
  const { decrypted, entityKey: _entityKey, ...topLevel } = body;
  return { ...topLevel, ...(decrypted || {}) };
}

export function applyMutationToAtoms(item: QueuedMutation): void {
  const entry = registry[item.entityType];
  if (!entry) return;
  const current = (store.get(entry.atom) as any[]) || [];

  let merged: any[];
  if (item.method === "DELETE") {
    merged = mergeItems(current, [{ _id: item.entityId, deletedAt: new Date().toISOString() }]);
  } else {
    const flattened = flattenDecryptedBody(item.decryptedBody);
    if (!flattened) return;
    const optimistic = {
      ...flattened,
      _id: item.entityId,
      _pendingSync: true,
      _queueItemId: item.id,
    };
    merged = mergeItems(current, [optimistic], { formatNewItemsFunction: entry.formatFn });
  }

  store.set(entry.atom, merged);

  if (!entry.isMedical) {
    setMMKVCacheItem(entry.mmkvKey, merged);
  }
}

export function rehydrateOptimisticUpdates(): void {
  const queue = store.get(offlineQueueState);
  for (const item of queue) {
    if (item.status !== "pending" && item.status !== "processing") continue;
    applyMutationToAtoms(item);
  }
}

export async function hydrateAtomsFromMMKV(): Promise<void> {
  for (const entry of Object.values(registry)) {
    if (!entry.isMedical) {
      const cached = getMMKVCacheItem<any[]>(entry.mmkvKey, []);
      store.set(entry.atom, cached);
      continue;
    }
    if (!getHashedOrgEncryptionKey()) continue;
    const encryptedCache = getMMKVCacheItem<any[]>(entry.mmkvKey, []);
    const decrypted: any[] = [];
    for (const enc of encryptedCache) {
      const d = await decryptDBItem(enc);
      if (d) decrypted.push(d);
    }
    const finalList = entry.formatFn ? decrypted.map(entry.formatFn) : decrypted;
    store.set(entry.atom, finalList);
  }
}
