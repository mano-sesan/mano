import { atom, createStore, type PrimitiveAtom, type SetStateAction } from "jotai";
import { storage } from "@/services/dataManagement";
// Central Jotai store - allows reading/writing atoms outside React components
// This replaces recoil-nexus functionality
export const store = createStore();

// Creates an atom that automatically persists to IndexedDB cache on every update
// This replaces the Recoil effect pattern: effects: [({ onSet }) => onSet(async (newValue) => setCacheItem(collectionName, newValue))]
export function atomWithCache<T>(collectionName: string, initialValue: T): PrimitiveAtom<T> {
  const baseAtom = atom<T>(initialValue);

  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update: SetStateAction<T>) => {
      const currentValue = get(baseAtom);
      const newValue = typeof update === "function" ? (update as (prev: T) => T)(currentValue) : update;
      set(baseAtom, newValue);
      storage.set(collectionName, JSON.stringify(newValue));
    }
  );

  // Copy the init property for debugging
  (derivedAtom as any).debugLabel = collectionName;

  return derivedAtom as unknown as PrimitiveAtom<T>;
}
