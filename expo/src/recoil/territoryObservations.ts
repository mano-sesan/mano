import { atom } from "jotai";
import { atomWithCache } from "@/store";
import { organisationState } from "./auth";
import { looseUuidRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { TerritoryObservationInstance } from "@/types/territoryObs";
import { CustomField } from "@/types/field";

export const territoryObservationsState = atomWithCache<Array<TerritoryObservationInstance>>("territory-observation", []);

export const customFieldsObsSelector = atom((get) => {
  const organisation = get(organisationState)!;
  if (Array.isArray(organisation.customFieldsObs) && organisation.customFieldsObs.length) return organisation.customFieldsObs;
  return defaultCustomFields;
});

export const groupedCustomFieldsObsSelector = atom((get) => {
  const organisation = get(organisationState)!;
  if (Array.isArray(organisation.groupedCustomFieldsObs) && organisation.groupedCustomFieldsObs.length) return organisation.groupedCustomFieldsObs;
  return [{ name: "Groupe par défaut", fields: defaultCustomFields }];
});

export const defaultCustomFields = [
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

export const prepareObsForEncryption = (customFields: CustomField[]) => (obs: TerritoryObservationInstance) => {
  try {
    if (!looseUuidRegex.test(obs.territory || "")) {
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
    Alert.alert(
      "L'observation n'a pas été sauvegardée car son format était incorrect.",
      "Vous pouvez vérifier son contenu et tenter de la sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
    );
    capture(error);
    throw error;
  }
  const encryptedFields = [...customFields.map((f) => f.name), ...compulsoryEncryptedFields];
  const decrypted: Record<string, any> = {};
  for (let field of encryptedFields) {
    decrypted[field] = obs[field];
  }
  return {
    _id: obs._id,
    createdAt: obs.createdAt,
    updatedAt: obs.updatedAt,
    organisation: obs.organisation,

    decrypted,
    entityKey: obs.entityKey,
  };
};

export const observationsKeyLabels = defaultCustomFields.map((f) => f.name);
