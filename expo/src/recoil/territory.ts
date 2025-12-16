import { atom, useAtomValue } from "jotai";
import { looseUuidRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { organisationState } from "./auth";
import { territoryObservationsState } from "./territoryObservations";
import structuredClone from "@ungap/structured-clone";
import { filterBySearch } from "../utils/search";
import { ReadyToEncryptTerritoryInstance, TerritoryInstance, TerritoryType } from "@/types/territory";
import { atomWithCache } from "@/store";
import { TerritoryObservationInstance } from "@/types/territoryObs";
import { useMemo } from "react";

export const territoriesState = atomWithCache<Array<TerritoryInstance>>("territory", []);

const encryptedFields: Array<keyof TerritoryInstance> = ["name", "perimeter", "description", "types", "user"];

export const prepareTerritoryForEncryption = (territory: Partial<TerritoryInstance>): ReadyToEncryptTerritoryInstance => {
  try {
    if (!territory.name) {
      throw new Error("Territory is missing name");
    }
    if (!looseUuidRegex.test(territory.user!)) {
      throw new Error("Territory is missing user");
    }
  } catch (error) {
    Alert.alert(
      "Le territoire n'a pas été sauvegardé car son format était incorrect.",
      "Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
    );
    capture(error);
    throw error;
  }
  const decrypted: Record<string, any> = {};
  for (let field of encryptedFields) {
    decrypted[field] = territory[field];
  }
  return {
    _id: territory._id!,
    createdAt: territory.createdAt!,
    updatedAt: territory.updatedAt!,
    organisation: territory.organisation!,

    decrypted,
    entityKey: territory.entityKey!,
  };
};

export const territoriesTypesSelector = atom((get) => {
  const organisation = get(organisationState)!;
  return organisation.territoriesGroupedTypes;
});

export const flattenedTerritoriesTypesSelector = atom((get) => {
  const territoriesGroupedTypes = get(territoriesTypesSelector)!;
  const flattenedTerritoriesTypes = territoriesGroupedTypes.reduce((allTypes, { types }) => [...allTypes, ...types], [] as string[]);
  return flattenedTerritoriesTypes.map((type) => type as TerritoryType);
});

const territoriesWithObservations = atom((get) => {
  const territories = get(territoriesState);
  const territoryObservations = get(territoryObservationsState);

  const observationsByTerritory: Record<string, Array<TerritoryObservationInstance>> = {};
  for (const obs of territoryObservations) {
    if (!observationsByTerritory[obs.territory!]) {
      observationsByTerritory[obs.territory!] = [];
    }
    observationsByTerritory[obs.territory!].push(obs);
  }
  return territories.map((t) => ({
    ...t,
    observations: observationsByTerritory[t._id] || [],
    lastObservationDate: structuredClone(observationsByTerritory[t._id])?.sort(
      (a: TerritoryObservationInstance, b: TerritoryObservationInstance) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    )?.[0]?.createdAt,
  }));
});

export function useTerritoriesWithObservationsSearchSelector(search: string) {
  const territories = useAtomValue(territoriesWithObservations);
  return useMemo(() => {
    if (!search?.length) return territories;
    return filterBySearch(search, territories);
  }, [search, territories]);
}
