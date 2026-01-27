import API from "./api";
import { MMKV } from "react-native-mmkv";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const appCurrentCacheKey = "mano_last_refresh_2026_01_27_entitykey_base64";

export const storage = new MMKV();

export async function clearCache(_message = "message to log when debug") {
  storage.clearAll();
  await AsyncStorage.clear();
  initCacheAndcheckIfExpired();
}

export const initCacheAndcheckIfExpired = () => {
  const storedCurrentCacheKey = storage.getString("mano-currentCacheKey");
  if (storedCurrentCacheKey !== appCurrentCacheKey) {
    clearCache();
  }
  storage.set("mano-currentCacheKey", appCurrentCacheKey);
};
initCacheAndcheckIfExpired();

// Get data from cache or fetch from server.
export async function getData({
  collectionName,
  setProgress = () => {},
  lastRefresh = 0,
}: {
  collectionName: string;
  setProgress?: (batch: number) => void;
  lastRefresh?: number;
}) {
  const response = await API.get({
    path: `/${collectionName}`,
    batch: 5000,
    setProgress,
    query: { after: lastRefresh, withDeleted: Boolean(lastRefresh) },
  });
  if (!response.ok) throw { message: `Error getting ${collectionName} data`, response };

  return response.decryptedData;
}
