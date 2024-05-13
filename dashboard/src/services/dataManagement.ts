import { set, get, clear, createStore } from "idb-keyval";
import { capture } from "./sentry";

export const dashboardCurrentCacheKey = "mano_last_refresh_2022_01_11";
export const manoDB = "mano-dashboard";
const customStore = createStore(manoDB, dashboardCurrentCacheKey);

export async function clearCache(calledFrom: string) {
  clear(customStore);
  window.localStorage?.clear();
  window.sessionStorage?.clear();
}

export async function setCacheItem(key: string, value: any) {
  try {
    await set(key, value, customStore);
  } catch (error) {
    capture(error, { tags: { key } });
  }
}

export async function getCacheItem(key: string) {
  try {
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
