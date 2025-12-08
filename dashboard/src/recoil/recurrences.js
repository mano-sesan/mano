import { atomWithCache } from "../store";

const collectionName = "recurrence";
export const recurrencesState = atomWithCache(collectionName, []);
