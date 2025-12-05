/**
 * Territory Observation state and utilities
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import { capture } from "../services/sentry";
import type { TerritoryObservationInstance, ReadyToEncryptTerritoryObservationInstance } from "../types/territoryObs";
import type { CustomField, CustomFieldsGroup } from "../types/field";
import { encryptItem } from "../services/encryption";

// State reference for backward compatibility
export const territoryObservationsState = { key: "territory-observation" };

// Selector functions
export const customFieldsObsSelector_fn = (state: { organisation: any }): CustomField[] => {
  if (Array.isArray(state.organisation?.customFieldsObs) && state.organisation.customFieldsObs.length) {
    return state.organisation.customFieldsObs;
  }
  return defaultCustomFields;
};

export const groupedCustomFieldsObsSelector_fn = (state: { organisation: any }): CustomFieldsGroup[] => {
  if (Array.isArray(state.organisation?.groupedCustomFieldsObs) && state.organisation.groupedCustomFieldsObs.length) {
    return state.organisation.groupedCustomFieldsObs;
  }
  return [{ name: "Groupe par défaut", fields: defaultCustomFields }];
};

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
  { name: "police", label: "Présence policière", type: "yes-no", enabled: true, required: true, showInStats: true },
  { name: "material", label: "Nombre de matériel ramassé", type: "number", enabled: true, required: true, showInStats: true },
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
  { name: "comment", label: "Commentaire", type: "textarea", enabled: true, required: true, showInStats: true },
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
    const decrypted: Record<string, any> = {};
    for (const field of encryptedFields) {
      decrypted[field] = (obs as any)[field];
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
type SortBy = "observedAt" | "territoryName" | "userName";

export const sortTerritoriesObservations =
  (sortBy: SortBy, sortOrder: SortOrder) => (a: TerritoryObservationInstance, b: TerritoryObservationInstance) => {
    if (sortBy === "observedAt") {
      return sortOrder === "ASC"
        ? new Date(b.observedAt || b.createdAt).getTime() - new Date(a.observedAt || a.createdAt).getTime()
        : new Date(a.observedAt || a.createdAt).getTime() - new Date(b.observedAt || b.createdAt).getTime();
    }
    if (sortBy === "territoryName") {
      return sortOrder === "ASC"
        ? ((a as any).territoryName || "").localeCompare((b as any).territoryName || "")
        : ((b as any).territoryName || "").localeCompare((a as any).territoryName || "");
    }
    if (sortBy === "userName") {
      return sortOrder === "ASC"
        ? ((a as any).userName || "").localeCompare((b as any).userName || "")
        : ((b as any).userName || "").localeCompare((a as any).userName || "");
    }
    return 0;
  };
