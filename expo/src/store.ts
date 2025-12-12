import { atom, createStore, type PrimitiveAtom, type SetStateAction } from "jotai";
import { storage } from "@/services/dataManagement";
// Central Jotai store - allows reading/writing atoms outside React components
// This replaces recoil-nexus functionality
export const store = createStore();

export function atomWithCache<T>(collectionName: string, initialValue: T): PrimitiveAtom<T> {
  // Try to load from storage, fallback to initialValue if not found or invalid
  const storedValue = storage.getString(collectionName);
  let cachedValue = initialValue;
  if (storedValue) {
    try {
      cachedValue = JSON.parse(storedValue);
    } catch (error) {
      console.warn(`Failed to parse cached value for ${collectionName}:`, error);
    }
  }

  const baseAtom = atom<T>(cachedValue);

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
