import { type UseStore, set, get, createStore, keys, delMany, clear } from "idb-keyval";
import { capture } from "./sentry";

export const dashboardCurrentCacheKey = "mano_last_refresh_2024_10_21_4";
const legacyStoreName = "mano_last_refresh_2022_01_11";
const legacyManoDB = "mano-dashboard";
const manoDB = "mano";
const storeName = "store";

let customStore: UseStore | null = null;
const savedCacheKey = window.localStorage.getItem("mano-currentCacheKey");
if (savedCacheKey !== dashboardCurrentCacheKey) {
  setupDB();
  clearCache("savedCacheKey diff dashboardCurrentCacheKey");
} else {
  setupDB();
}

function setupDB() {
  try {
    // Vidage du store historique qui ne sert plus à rien, mais qui peut-être encore présent
    const legacyStore = createStore(legacyManoDB, legacyStoreName);
    clear(legacyStore).catch((clearError) => {
      capture(clearError, { 
        tags: { errorContext: "legacy_store_clear_failed_in_setupDB" },
        extra: { legacyManoDB, legacyStoreName }
      });
    });
  } catch (legacyStoreError) {
    capture(legacyStoreError, { 
      tags: { errorContext: "legacy_store_create_failed_in_setupDB" },
      extra: { legacyManoDB, legacyStoreName }
    });
  }
  
  // Pour plus tard, quand on sera sûr qu'elle n'est plus utilisée, on devrait même pouvoir la supprimer !
  // Fin du legacy
  window.localStorage.setItem("mano-currentCacheKey", dashboardCurrentCacheKey);
  
  try {
    customStore = createStore(manoDB, storeName);
  } catch (customStoreError) {
    capture(customStoreError, { 
      tags: { errorContext: "customStore_create_failed_in_setupDB" },
      extra: { manoDB, storeName }
    });
    customStore = null;
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
  return new Promise((resolve) => {
    if (localStorageEmpty && sessionStorageEmpty && indexedDBEmpty) {
      setupDB();
      resolve(true);
    } else {
      if (!localStorageEmpty) console.log(`localStorage not empty ${window.localStorage.key(0)}`);
      // if (!sessionStorageEmpty) console.log("sessionStorage not empty");
      if (!indexedDBEmpty) console.log("indexedDB not empty");
      clearCache("try again clearCache", iteration + 1).then(resolve);
    }
  });
}

export async function setCacheItem(key: string, value: any) {
  try {
    if (!customStore) {
      capture(new Error("customStore is null in setCacheItem"), { 
        tags: { key, errorContext: "customStore_null_before_set" } 
      });
      return;
    }
    await set(key, value, customStore);
  } catch (error) {
    if (error instanceof Error && error?.message?.includes("connection is closing")) {
      // Si on a une erreur de type "connection is closing", on va essayer de réinitialiser
      // la connexion à la base de données et de sauvegarder la donnée à nouveau
      const originalErrorMessage = error.message;
      capture(error, { 
        tags: { key, errorContext: "connection_closing_initial_attempt" },
        extra: { originalErrorMessage }
      });
      
      setupDB();
      try {
        if (!customStore) {
          capture(new Error("customStore is null after setupDB in setCacheItem retry"), { 
            tags: { key, errorContext: "customStore_null_after_setupDB_retry" },
            extra: { originalErrorMessage }
          });
          return;
        }
        await set(key, value, customStore);
      } catch (retryError) {
        capture(retryError, { 
          tags: { key, errorContext: "set_retry_failed_after_connection_closing" },
          extra: { originalErrorMessage, retryErrorMessage: retryError instanceof Error ? retryError.message : String(retryError) }
        });
        return;
      }
    } else {
      capture(error, { 
        tags: { key, errorContext: "general_set_error" },
        extra: { errorMessage: error instanceof Error ? error.message : String(error) }
      });
    }
  }
}

export async function getCacheItem(key: string) {
  try {
    if (customStore === null) {
      capture(new Error("customStore is null in getCacheItem"), { 
        tags: { key, errorContext: "customStore_null_before_get" } 
      });
      return null;
    }
    const data = await get(key, customStore);
    return data;
  } catch (error) {
    if (error instanceof Error && error?.message?.includes("connection is closing")) {
      // Si on a une erreur de type "connection is closing", on va essayer de réinitialiser
      // la connexion à la base de données et de récupérer la donnée à nouveau
      const originalErrorMessage = error.message;
      capture(error, { 
        tags: { key, errorContext: "connection_closing_initial_attempt" },
        extra: { originalErrorMessage }
      });
      
      setupDB();
      try {
        if (customStore === null) {
          capture(new Error("customStore is null after setupDB in getCacheItem retry"), { 
            tags: { key, errorContext: "customStore_null_after_setupDB_retry" },
            extra: { originalErrorMessage }
          });
          return null;
        }
        const data = await get(key, customStore);
        return data;
      } catch (retryError) {
        capture(retryError, { 
          tags: { key, errorContext: "get_retry_failed_after_connection_closing" },
          extra: { originalErrorMessage, retryErrorMessage: retryError instanceof Error ? retryError.message : String(retryError) }
        });
        return null;
      }
    }
    capture(error, { 
      tags: { key, errorContext: "general_get_error" },
      extra: { errorMessage: error instanceof Error ? error.message : String(error) }
    });
    return null;
  }
}

export async function getCacheItemDefaultValue(key: string, defaultValue: any) {
  const storedValue = await getCacheItem(key);
  return storedValue || defaultValue;
}
