import { getCacheItemDefaultValue, setCacheItem } from "../services/dataManagement";
import { atom, selector } from "recoil";

const collectionName = "recurrence";
export const recurrencesState = atom({
  key: collectionName,
  default: selector({
    key: "recurrence/default",
    get: async () => {
      const cache = await getCacheItemDefaultValue("recurrence", []);
      return cache;
    },
  }),
  effects: [({ onSet }) => onSet(async (newValue) => setCacheItem(collectionName, newValue))],
});
