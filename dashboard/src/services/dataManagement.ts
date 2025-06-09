import { type UseStore, set, get, createStore, keys, delMany, clear } from "idb-keyval";
import { capture } from "./sentry";

export const dashboardCurrentCacheKey = "mano_last_refresh_2024_10_21_4";
const legacyStoreName = "mano_last_refresh_2022_01_11";
const legacyManoDB = "mano-dashboard";
const manoDB = "mano";
const storeName = "store";

let customStore: UseStore | null = null;

export const dbReadyPromise = (async () => {
  const savedCacheKey = window.localStorage.getItem("mano-currentCacheKey");
  if (savedCacheKey !== dashboardCurrentCacheKey) {
    setupDB();
    await clearCache("savedCacheKey diff dashboardCurrentCacheKey"); // Await the clearCache promise
  } else {
    setupDB();
  }
  // The promise resolves when the async block finishes
})();

function setupDB() {
  // Vidage du store historique qui ne sert plus à rien, mais qui peut-être encore présent
  const legacyStore = createStore(legacyManoDB, legacyStoreName);
  clear(legacyStore).catch(capture);
  // Pour plus tard, quand on sera sûr qu'elle n'est plus utilisée, on devrait même pouvoir la supprimer !
  // Fin du legacy
  window.localStorage.setItem("mano-currentCacheKey", dashboardCurrentCacheKey);
  customStore = createStore(manoDB, storeName);
}

async function deleteDB() {
  // On n'arrive pas à supprimer la base de données, on va donc supprimer les données une par une
  if (!customStore) {
    console.warn("deleteDB: customStore is null. Attempting setupDB.");
    setupDB();
    if (!customStore) {
      const error = new Error("deleteDB: customStore still null after setupDB attempt");
      capture(error);
      throw error;
    }
  }
  try {
    const ks = await keys(customStore);
    if (ks.length > 0) {
      await delMany(ks, customStore); // Await delMany
    }
  } catch (error) {
    capture(error, { tags: { function: "deleteDB" } });
    throw error; // Re-throw to be caught by clearCache
  }
}

export async function clearCache(calledFrom = "not defined", iteration = 0): Promise<boolean> {
  console.log(`clearing cache from ${calledFrom}, iteration ${iteration}`);
  if (iteration > 10) {
    throw new Error("Failed to clear cache");
  }
  try {
    await deleteDB(); // Await deleteDB and handle its potential errors
  } catch (error) {
    capture(error, { tags: { function: "clearCache", iteration } });
  }
  window.localStorage?.clear();
  window.sessionStorage?.clear();

  // Check if the cache is empty
  const localStorageEmpty = window.localStorage.length === 0;
  const sessionStorageEmpty = window.sessionStorage.length === 0;
  const indexedDBEmpty = customStore ? (await keys(customStore)).length === 0 : true;

  // If the cache is not empty, try again
  if (localStorageEmpty && sessionStorageEmpty && indexedDBEmpty) {
    setupDB();
    return true;
  } else {
    if (!localStorageEmpty) console.log(`localStorage not empty ${window.localStorage.key(0)}`);
    // if (!sessionStorageEmpty) console.log("sessionStorage not empty");
    if (!indexedDBEmpty) console.log("indexedDB not empty");
    return clearCache("try again clearCache", iteration + 1); // Ensure promise is returned
  }
}

export async function setCacheItem(key: string, value: any) {
  if (!customStore) { // Check if customStore is null
    console.warn("setCacheItem: customStore is null. Attempting setupDB.");
    setupDB(); // Attempt to re-initialize
    if (!customStore) { // Check again if setup failed
      capture(new Error("setCacheItem: customStore still null after setupDB"), { tags: { key } });
      return; // Cannot proceed if still null
    }
  }
  try {
    await set(key, value, customStore);
  } catch (error) {
    if (error instanceof Error && error?.message?.includes("connection is closing")) {
      // Si on a une erreur de type "connection is closing", on va essayer de réinitialiser
      // la connexion à la base de données et de sauvegarder la donnée à nouveau
      setupDB();
      try {
        if (customStore) await set(key, value, customStore);
      } catch (error) {
        capture(error, { tags: { key } });
        return;
      }
    }
    capture(error, { tags: { key } });
  }
}

export async function getCacheItem(key: string) {
  if (customStore === null) { // Check if customStore is null
    console.warn("getCacheItem: customStore is null. Attempting setupDB.");
    setupDB(); // Attempt to re-initialize
    if (customStore === null) { // Check again if setup failed
        capture(new Error("getCacheItem: customStore still null after setupDB attempt"), { tags: { key } });
        return null; // Cannot proceed if still null
    }
  }
  try {
    const data = await get(key, customStore);
    return data;
  } catch (error) {
    if (error instanceof Error && error?.message?.includes("connection is closing")) {
      // Si on a une erreur de type "connection is closing", on va essayer de réinitialiser
      // la connexion à la base de données et de récupérer la donnée à nouveau
      setupDB();
      try {
        if (customStore) {
          const data = await get(key, customStore);
          return data;
        }
        return null;
      } catch (error) {
        capture(error, { tags: { key } });
        return null;
      }
    }
    capture(error, { tags: { key } });
    return null;
  }
}

export async function getCacheItemDefaultValue(key: string, defaultValue: any) {
  const storedValue = await getCacheItem(key);
  return storedValue || defaultValue;
}
