import { atom } from "recoil";

const collectionName = "recurrence";
export const recurrencesState = atom({
  key: collectionName,
  default: [],
});
