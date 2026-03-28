import API from "./api";
import { MMKV } from "react-native-mmkv";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const appCurrentCacheKey = "mano_last_refresh_2022_12_01";

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

// Get data preserving raw encrypted items alongside decrypted ones.
export async function getDataWithRaw({
  collectionName,
  setProgress = () => {},
  lastRefresh = 0,
}: {
  collectionName: string;
  setProgress?: (batch: number) => void;
  lastRefresh?: number;
}): Promise<{ decryptedData: any[]; rawData: any[] }> {
  const response = await API.get({
    path: `/${collectionName}`,
    batch: 5000,
    setProgress,
    query: { after: lastRefresh, withDeleted: Boolean(lastRefresh) },
    preserveRawData: true,
  });
  if (!response.ok) throw { message: `Error getting ${collectionName} data`, response };

  return { decryptedData: response.decryptedData || [], rawData: response.rawData || [] };
}

const ENCRYPTED_MEDICAL_PREFIX = "encrypted-medical-";

export function getEncryptedCacheItem<T>(key: string, defaultValue: T): T {
  const raw = storage.getString(`${ENCRYPTED_MEDICAL_PREFIX}${key}`);
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function setEncryptedCacheItem(key: string, value: unknown): void {
  storage.set(`${ENCRYPTED_MEDICAL_PREFIX}${key}`, JSON.stringify(value));
}

export function clearEncryptedMedicalCache(): void {
  storage.delete(`${ENCRYPTED_MEDICAL_PREFIX}consultation`);
  storage.delete(`${ENCRYPTED_MEDICAL_PREFIX}treatment`);
  storage.delete(`${ENCRYPTED_MEDICAL_PREFIX}medical-file`);
}
