import { atom } from "jotai";
import { organisationState } from "./auth";

export const structuresCategoriesSelector = atom((get) => {
  const organisation = get(organisationState);
  return organisation.structuresGroupedCategories;
});

export const flattenedStructuresCategoriesSelector = atom((get) => {
  const structuresGroupedCategories = get(structuresCategoriesSelector);
  return structuresGroupedCategories.reduce((allCategories, { categories }) => [...allCategories, ...categories], []);
});

export const structuresState = atom([]);
