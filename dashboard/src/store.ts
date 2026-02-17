import { atom, createStore, type PrimitiveAtom, type SetStateAction } from "jotai";

// Central Jotai store - allows reading/writing atoms outside React components
// This replaces recoil-nexus functionality
export const store = createStore();

// Creates an atom with a debugLabel for identification.
// The cache is managed separately by the data loader, which stores encrypted items in IndexedDB
// and only decrypts them into the Jotai atom in memory.
export function atomWithCache<T>(collectionName: string, initialValue: T): PrimitiveAtom<T> {
  const baseAtom = atom<T>(initialValue);
  (baseAtom as PrimitiveAtom<T> & { debugLabel: string }).debugLabel = collectionName;
  return baseAtom as unknown as PrimitiveAtom<T>;
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
