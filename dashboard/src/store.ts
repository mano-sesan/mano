import { atom, createStore, type PrimitiveAtom, type SetStateAction } from "jotai";
import { setCacheItem } from "./services/dataManagement";

// Central Jotai store - allows reading/writing atoms outside React components
// This replaces recoil-nexus functionality
export const store = createStore();

// Type for atoms created with atomWithCache that have a debugLabel
type AtomWithDebugLabel<T> = PrimitiveAtom<T> & { debugLabel: string };

// Creates an atom that automatically persists to IndexedDB cache on every update
// This replaces the Recoil effect pattern: effects: [({ onSet }) => onSet(async (newValue) => setCacheItem(collectionName, newValue))]
export function atomWithCache<T>(collectionName: string, initialValue: T): PrimitiveAtom<T> {
  const baseAtom = atom<T>(initialValue);

  // Copy the init property for debugging
  (baseAtom as AtomWithDebugLabel<T>).debugLabel = collectionName;

  return baseAtom as unknown as PrimitiveAtom<T>;
}

// Creates a setter function that awaits the IndexedDB write operation
// Use this in dataLoader.ts to prevent transaction conflicts when setting multiple atoms rapidly
export function awaitSetAtomAndIDBCache<T>(atomWithCacheInstance: PrimitiveAtom<T>): (update: SetStateAction<T>) => Promise<void> {
  // Extract the collection name from the atom's debugLabel
  const collectionName = (atomWithCacheInstance as AtomWithDebugLabel<T>).debugLabel;
  
  if (!collectionName) {
    throw new Error("awaitSetAtomAndIDBCache can only be used with atoms created by atomWithCache");
  }

  return async (update: SetStateAction<T>) => {
    // Get the current value
    const currentValue = store.get(atomWithCacheInstance);
    
    // Resolve the update - it could be a value or a function
    const newValue = typeof update === "function" ? (update as (prev: T) => T)(currentValue) : update;
    
    // Update the atom in the store
    store.set(atomWithCacheInstance, newValue);
    
    // Await the IndexedDB write operation
    await setCacheItem(collectionName, newValue);
  };
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
