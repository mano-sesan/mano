import { type UseStore, set, get, createStore, keys, delMany, clear } from "idb-keyval";
import { capture } from "./sentry";

// If you need users to force refresh their cache, change the value of `dashboardCurrentCacheKey` and push to main
export const dashboardCurrentCacheKey = "mano_last_refresh_2026_01_06_1";
const legacyStoreName = "mano_last_refresh_2022_01_11";
const legacyManoDB = "mano-dashboard";
const manoDB = "mano";
const storeName = "store";

let customStore: UseStore | null = null;

(async () => {
  try {
    const savedCacheKey = window.localStorage.getItem("mano-currentCacheKey");
    if (savedCacheKey !== dashboardCurrentCacheKey) {
      await setupDB(); // Await setupDB
      await clearCache("savedCacheKey diff dashboardCurrentCacheKey"); // Await clearCache
    } else {
      await setupDB(); // Await setupDB
    }
  } catch (initError) {
    console.error("Error during initial DB setup:", initError);
    capture(initError, { extra: { context: "Initial database setup process" } });
  }
})();

async function setupDB() {
  // Vidage du store historique qui ne sert plus à rien, mais qui peut-être encore présent
  const legacyStore = createStore(legacyManoDB, legacyStoreName);
  await clear(legacyStore).catch(capture); // Await the clear operation
  // Pour plus tard, quand on sera sûr qu'elle n'est plus utilisée, on devrait même pouvoir la supprimer !
  // Fin du legacy
  window.localStorage.setItem("mano-currentCacheKey", dashboardCurrentCacheKey);
  customStore = createStore(manoDB, storeName);
  try {
    // Perform a simple operation to ensure the database is open and ready.
    await keys(customStore); // Await a simple operation
  } catch (error) {
    capture(error, { extra: { context: "setupDB: new store readiness check failed" } });
    throw new Error(`Failed to ensure new database store readiness: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function deleteDB() {
  // On n'arrive pas à supprimer la base de données, on va donc supprimer les données une par une
  if (!customStore) return;
  const ks = await keys(customStore);
  return await delMany(ks, customStore);
}

export async function clearCache(calledFrom = "not defined", iteration = 0) {
  console.log(`clearing cache from ${calledFrom}, iteration ${iteration}`);
  if (iteration > 10) {
    throw new Error("Failed to clear cache");
  }
  await deleteDB().catch(capture);
  window.localStorage?.clear();
  window.sessionStorage?.clear();

  // Check if the cache is empty
  const localStorageEmpty = window.localStorage.length === 0;
  const sessionStorageEmpty = window.sessionStorage.length === 0;
  const indexedDBEmpty = customStore ? (await keys(customStore)).length === 0 : true;

  // If the cache is not empty, try again
  return new Promise((resolve, reject) => {
    if (localStorageEmpty && sessionStorageEmpty && indexedDBEmpty) {
      setupDB()
        .then(() => resolve(true))
        .catch((error) => {
          console.error("Error during setupDB in clearCache after clearing:", error);
          capture(error, { tags: { calledFrom, iteration }, extra: { context: "setupDB in clearCache" } });
          reject(error);
        });
    } else {
      if (!localStorageEmpty) console.log(`localStorage not empty ${window.localStorage.key(0)}`);
      // if (!sessionStorageEmpty) console.log("sessionStorage not empty");
      if (!indexedDBEmpty) console.log("indexedDB not empty");
      clearCache("try again clearCache", iteration + 1)
        .then(resolve)
        .catch(reject);
    }
  });
}

export async function setCacheItem(key: string, value: any) {
  try {
    if (customStore) await set(key, value, customStore);
  } catch (error) {
    if (error instanceof Error && error?.message?.includes("connection is closing")) {
      // Si on a une erreur de type "connection is closing", on va essayer de réinitialiser
      // la connexion à la base de données et de sauvegarder la donnée à nouveau
      await setupDB(); // Await setupDB before retrying
      try {
        await set(key, value, customStore);
      } catch (error) {
        capture(error, { tags: { key } });
        return;
      }
    }
    capture(error, { tags: { key } });
  }
}

export async function getCacheItem(key: string) {
  try {
    if (customStore === null) return null;
    const data = await get(key, customStore);
    return data;
  } catch (error) {
    if (error instanceof Error && error?.message?.includes("connection is closing")) {
      // Si on a une erreur de type "connection is closing", on va essayer de réinitialiser
      // la connexion à la base de données et de récupérer la donnée à nouveau
      await setupDB(); // Await setupDB before retrying
      try {
        const data = await get(key, customStore);
        return data;
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
