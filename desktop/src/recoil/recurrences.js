import { setCacheItem } from "../services/dataManagement";
import { atom } from "recoil";

const collectionName = "recurrence";
export const recurrencesState = atom({
  key: collectionName,
  default: [],
  effects: [({ onSet }) => onSet(async (newValue) => setCacheItem(collectionName, newValue))],
});
