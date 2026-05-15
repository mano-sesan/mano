import { useLocalStorageValue } from "@react-hookz/web";
import type { Dispatch, SetStateAction } from "react";

export const useLocalStorage = <T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>, () => void] => {
  const { value, set, remove } = useLocalStorageValue(key, {
    defaultValue,
  });
  return [value, set, remove];
};
