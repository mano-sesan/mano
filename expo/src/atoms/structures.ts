import { atom } from "jotai";
import { organisationState } from "./auth";
import { StructureInstance } from "@/types/structure";

export const structuresCategoriesSelector = atom((get) => {
  const organisation = get(organisationState)!;
  return organisation.structuresGroupedCategories || [];
});

export const flattenedStructuresCategoriesSelector = atom((get) => {
  const structuresGroupedCategories = get(structuresCategoriesSelector)!;
  return structuresGroupedCategories.reduce((allCategories, { categories }) => [...allCategories, ...categories], [] as Array<string>);
});

export const structuresState = atom<Array<StructureInstance>>([]);
