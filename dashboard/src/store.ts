import { atom, createStore, type PrimitiveAtom, type SetStateAction } from "jotai";
import { setCacheItem } from "./services/dataManagement";

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
      // Resolve the update - it could be a value or a function
      const currentValue = get(baseAtom);
      const newValue = typeof update === "function" ? (update as (prev: T) => T)(currentValue) : update;
      set(baseAtom, newValue);
      // Persist to IndexedDB cache (fire and forget)
      setCacheItem(collectionName, newValue);
    }
  );

  // Copy the init property for debugging
  (derivedAtom as any).debugLabel = collectionName;

  return derivedAtom as unknown as PrimitiveAtom<T>;
}

// Creates an atom that syncs with localStorage
export function atomWithLocalStorage<T>(key: string, initialValue: T): PrimitiveAtom<T> {
  const getInitialValue = (): T => {
    if (typeof window === "undefined") return initialValue;
    const savedValue = localStorage.getItem(key);
    return savedValue != null ? JSON.parse(savedValue) : initialValue;
  };

  const baseAtom = atom<T>(getInitialValue());

  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, set, update: SetStateAction<T>) => {
      const currentValue = get(baseAtom);
      const newValue = typeof update === "function" ? (update as (prev: T) => T)(currentValue) : update;
      set(baseAtom, newValue);
      if (JSON.stringify(newValue) === JSON.stringify(initialValue)) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(newValue));
      }
    }
  );

  return derivedAtom as unknown as PrimitiveAtom<T>;
}
