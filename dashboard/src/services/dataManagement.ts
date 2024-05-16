import { type UseStore, set, get, createStore } from "idb-keyval";
import { capture } from "./sentry";
import type { UUIDV4 } from "../types/uuid";
import { decryptDBItem } from "./api";

export const dashboardCurrentCacheKey = "mano_last_refresh_2022_01_11";
export const manoDB = "mano-dashboard";

let customStore: UseStore | null = null;
const savedCacheKey = window.localStorage.getItem("mano-currentCacheKey");
if (savedCacheKey !== dashboardCurrentCacheKey) {
  clearCache().then(() => setupDB());
} else {
  setupDB();
}

function setupDB() {
  window.localStorage.setItem("mano-currentCacheKey", dashboardCurrentCacheKey);
  customStore = createStore(manoDB, dashboardCurrentCacheKey);
}

async function deleteDB() {
  return new Promise((resolve) => {
    const DBDeleteRequest = window.indexedDB.deleteDatabase(manoDB);
    DBDeleteRequest.onerror = (event) => {
      capture(event); // just to monitor, rejecting would block the process, maybe we can remove this capture
      resolve(false);
<<<<<<< HEAD
=======
    };
    DBDeleteRequest.onblocked = (event) => {
      capture(event); // just to monitor, rejecting would block the process, maybe we can remove this capture
      resolve(false);
>>>>>>> 90ba6ed9 (fixed !)
    };
    DBDeleteRequest.onblocked = () => {
      resolve(false);
    };
    DBDeleteRequest.onsuccess = () => {
      resolve(true);
    };
  });
}

export async function clearCache() {
  await deleteDB().then(console.log).catch(capture);
  window.localStorage?.clear();
  window.sessionStorage?.clear();
  return true;
}

export async function setCacheItem(key: string, value: any) {
  try {
    if (customStore) await set(key, value, customStore);
  } catch (error) {
    capture(error, { tags: { key } });
  }
}

export async function getCacheItem(key: string) {
  try {
    if (customStore === null) return null;
    const data = await get(key, customStore);
    return data;
  } catch (error) {
    capture(error, { tags: { key } });
    return null;
  }
}

export async function getCacheItemDefaultValue(key: string, defaultValue: any) {
  const storedValue = await getCacheItem(key);
  return storedValue || defaultValue;
}


interface EncryptedItem {
  _id: UUIDV4;
  organisation: UUIDV4;
  encrypted: string;
  encryptedEntityKey: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  [key: string]: any;
}

export let cachedCollectionsNames = {
  person: "person",
  action: "action",
  // TODO: Add more collections here
} as const;

type CollectionsNames = keyof typeof cachedCollectionsNames;

export async function getDecryptedCache(key: CollectionsNames) {
  const cryptedCache = await getCacheItemDefaultValue(key, []);
  const decryptedCache = await Promise.all(cryptedCache.map((item: EncryptedItem) => decryptDBItem(item, { path: `${key}-cache` })));
  return decryptedCache;
}

