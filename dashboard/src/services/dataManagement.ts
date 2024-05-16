import { set, get, clear, createStore } from "idb-keyval";
import { capture } from "./sentry";

export const dashboardCurrentCacheKey = "mano_last_refresh_2024_05_16";
export const manoDB = "mano-dashboard";

let customStore: any = null;
const savedCacheKey = window.localStorage.getItem("mano-currentCacheKey");
if (savedCacheKey !== dashboardCurrentCacheKey) {
  console.log("Clearing cache", { savedCacheKey, dashboardCurrentCacheKey });
  clearCache().then(() => {
    console.log("setting new cache key", dashboardCurrentCacheKey);
    setupDB();
  });
} else {
  console.log("Cache key is the same, setting up DB");
  setupDB();
}

async function setupDB() {
  console.log("Setting up DB");
  window.localStorage.setItem("mano-currentCacheKey", dashboardCurrentCacheKey);
  customStore = createStore(manoDB, dashboardCurrentCacheKey);
  console.log("DB setup done");
}

async function deleteDB() {
  return new Promise((resolve, reject) => {
    const DBDeleteRequest = window.indexedDB.deleteDatabase(manoDB);
    DBDeleteRequest.onerror = (event) => {
      reject(event);
    };
    DBDeleteRequest.onsuccess = (event) => {
      resolve(true);
    };
  });
}

export async function clearCache() {
  await deleteDB();
  window.localStorage?.clear();
  window.sessionStorage?.clear();
  console.log("Cache cleared");
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
