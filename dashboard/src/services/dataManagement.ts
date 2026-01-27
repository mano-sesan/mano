import { type UseStore, set, get, createStore, keys, delMany } from "idb-keyval";
import { capture } from "./sentry";
import { logout } from "./logout";

// If you need users to force refresh their cache, change the value of `dashboardCurrentCacheKey` and push to main
export const dashboardCurrentCacheKey = "mano_last_refresh_2026_01_27_entitykey_base64";
const manoDB = "mano";
const storeName = "store";

let customStore: UseStore | null = null;
let storageFailureHandled = false;

export const AUTH_TOAST_KEY = "mano-auth-toast";

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
  // legacy db, not used anymore, delete it
  // no exception thrown if the database does not exist (https://developer.mozilla.org/en-US/docs/Web/API/IDBFactory/deleteDatabase#name)
  window.indexedDB?.deleteDatabase("mano-dashboard");
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

export async function setCacheItem(key: string, value: unknown) {
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
    const errorString = String(error);
    if (
      errorString.includes("QuotaExceededError") ||
      errorString.includes("DataError") ||
      errorString.includes("IOError") ||
      errorString.includes("Failed to write blobs")
    ) {
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const { usage, quota } = await navigator.storage.estimate();
          const valueSize = JSON.stringify(value).length;
          const usageInMib = (usage || 0) / 1024 / 1024;
          const quotaInMib = (quota || 0) / 1024 / 1024;
          const valueSizeInMib = valueSize / 1024 / 1024;
          const errorMessage = `Storage error for key ${key}: usage ${usageInMib.toFixed(2)}MiB, quota ${quotaInMib.toFixed(
            2
          )}MiB, payload ${valueSizeInMib.toFixed(2)}MiB`;
          console.error(errorMessage);
          capture(error, { tags: { key }, extra: { usage, quota, valueSize, errorMessage } });
          const userMessage = "Impossible de mettre vos données en cache, veuillez vérifier votre espace disque et réessayer.";
          if (!storageFailureHandled) {
            storageFailureHandled = true;
            // Store a one-time message for the login page (shared across tabs).
            try {
              window.localStorage?.setItem(AUTH_TOAST_KEY, JSON.stringify({ type: "error", message: userMessage, ts: Date.now() }));
            } catch (_e) {
              // ignore
            }
            // Logout + broadcast to other tabs (best-effort).
            logout().finally(() => {
              try {
                window.localStorage?.removeItem("previously-logged-in");
              } catch (_e) {
                // ignore
              }
              window.location.href = "/auth";
            });
          }
          return;
        }
      } catch (e) {
        capture(e, { extra: { context: "Failed to estimate storage" } });
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
