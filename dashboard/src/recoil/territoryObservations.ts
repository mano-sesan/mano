import { organisationState } from "./auth";
import { atom, selector } from "recoil";
import type { RecoilValueReadOnly } from "recoil";
import { setCacheItem } from "../services/dataManagement";
import { looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import { capture } from "../services/sentry";
import type { TerritoryObservationInstance, ReadyToEncryptTerritoryObservationInstance } from "../types/territoryObs";
import type { CustomField, CustomFieldsGroup } from "../types/field";
import { encryptItem } from "../services/encryption";

const collectionName = "territory-observation";
export const territoryObservationsState = atom<Array<TerritoryObservationInstance>>({
  key: collectionName,
  default: [],
  effects: [({ onSet }) => onSet(async (newValue) => setCacheItem(collectionName, newValue))],
});

export const customFieldsObsSelector: RecoilValueReadOnly<Array<CustomField>> = selector({
  key: "customFieldsObsSelector",
  get: ({ get }) => {
    const organisation = get(organisationState);
    if (Array.isArray(organisation.customFieldsObs) && organisation.customFieldsObs.length) return organisation.customFieldsObs;
    return defaultCustomFields;
  },
});

export const groupedCustomFieldsObsSelector: RecoilValueReadOnly<Array<CustomFieldsGroup>> = selector({
  key: "groupedCustomFieldsObsSelector",
  get: ({ get }) => {
    const organisation = get(organisationState);
    if (Array.isArray(organisation.groupedCustomFieldsObs) && organisation.groupedCustomFieldsObs.length) return organisation.groupedCustomFieldsObs;
    return [{ name: "Groupe par défaut", fields: defaultCustomFields }];
  },
});

export const defaultCustomFields: Array<CustomField> = [
  {
    name: "personsMale",
    label: "Nombre de personnes non connues hommes rencontrées",
    type: "number",
    enabled: true,
    required: true,
    showInStats: true,
  },
  {
    name: "personsFemale",
    label: "Nombre de personnes non connues femmes rencontrées",
    type: "number",
    enabled: true,
    required: true,
    showInStats: true,
  },
  {
    name: "police",
    label: "Présence policière",
    type: "yes-no",
    enabled: true,
    required: true,
    showInStats: true,
  },
  {
    name: "material",
    label: "Nombre de matériel ramassé",
    type: "number",
    enabled: true,
    required: true,
    showInStats: true,
  },
  {
    name: "atmosphere",
    label: "Ambiance",
    options: ["Violences", "Tensions", "RAS"],
    type: "enum",
    enabled: true,
    required: true,
    showInStats: true,
  },
  {
    name: "mediation",
    label: "Nombre de médiations avec les riverains / les structures",
    type: "number",
    enabled: true,
    required: true,
    showInStats: true,
  },
  {
    name: "comment",
    label: "Commentaire",
    type: "textarea",
    enabled: true,
    required: true,
    showInStats: true,
  },
];

const compulsoryEncryptedFields = ["territory", "user", "team", "observedAt"];

export const prepareObsForEncryption =
  (customFields: Array<CustomField>) =>
  (obs: TerritoryObservationInstance, { checkRequiredFields = true } = {}): ReadyToEncryptTerritoryObservationInstance => {
    if (checkRequiredFields) {
      try {
        if (!looseUuidRegex.test(obs.territory)) {
          throw new Error("Observation is missing territory");
        }
        if (!looseUuidRegex.test(obs.user)) {
          throw new Error("Observation is missing user");
        }
        if (!looseUuidRegex.test(obs.team)) {
          throw new Error("Observation is missing team");
        }
        if (!obs.observedAt) {
          throw new Error("Observation is missing observedAt");
        }
      } catch (error) {
        toast.error(
          "L'observation n'a pas été sauvegardée car son format était incorrect. Vous pouvez vérifier son contenu et tenter de la sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
        );
        capture(error);
        throw error;
      }
    }
    const encryptedFields = [...customFields.map((f) => f.name), ...compulsoryEncryptedFields];
    const decrypted = {};
    for (const field of encryptedFields) {
      decrypted[field] = obs[field];
    }
    return {
      _id: obs._id,
      createdAt: obs.createdAt,
      updatedAt: obs.updatedAt,
      deletedAt: obs.deletedAt,
      organisation: obs.organisation,

      decrypted,
      entityKey: obs.entityKey,
    };
  };

export const encryptObs =
  (customFields: Array<CustomField>) =>
  (obs: TerritoryObservationInstance, { checkRequiredFields = true } = {}) => {
    return encryptItem(prepareObsForEncryption(customFields)(obs, { checkRequiredFields }));
  };

type SortOrder = "ASC" | "DESC";

type SortBy = "observedAt";

export const sortTerritoriesObservations =
  (sortBy: SortBy, sortOrder: SortOrder) => (a: TerritoryObservationInstance, b: TerritoryObservationInstance) => {
    if (sortBy === "observedAt") {
      return sortOrder === "ASC"
        ? new Date(b.observedAt || b.createdAt).getTime() - new Date(a.observedAt || a.createdAt).getTime()
        : new Date(a.observedAt || a.createdAt).getTime() - new Date(b.observedAt || b.createdAt).getTime();
    }
    if (sortBy === "territoryName") {
      return sortOrder === "ASC" ? a.territoryName.localeCompare(b.territoryName) : b.territoryName.localeCompare(a.territoryName);
    }
    if (sortBy === "userName") {
      return sortOrder === "ASC" ? (a.userName || "").localeCompare(b.userName || "") : (b.userName || "").localeCompare(a.userName || "");
    }
  };
