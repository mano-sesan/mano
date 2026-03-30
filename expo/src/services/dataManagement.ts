import API from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storage } from "@/services/storage";

export const appCurrentCacheKey = "mano_last_refresh_2026_01_27_entitykey_base64";

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
