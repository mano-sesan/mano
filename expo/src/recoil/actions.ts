import { atomWithCache } from "@/store";
import { atom } from "jotai";
import { organisationState } from "./auth";
import { looseUuidRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { ActionInstance } from "@/types/action";

export const actionsState = atomWithCache<Array<ActionInstance>>("action", []);

export const actionsCategoriesSelector = atom((get) => {
  const organisation = get(organisationState)!;
  if (organisation.actionsGroupedCategories) return organisation.actionsGroupedCategories;
  return [{ groupTitle: "Toutes mes catégories", categories: [] }];
});

export const flattenedActionsCategoriesSelector = atom((get) => {
  const actionsGroupedCategories = get(actionsCategoriesSelector);
  return actionsGroupedCategories.reduce((allCategories, { categories }) => [...allCategories, ...categories], [] as string[]);
});

const encryptedFields: Array<keyof ActionInstance> = [
  "category",
  "categories",
  "person",
  "group",
  "structure",
  "name",
  "description",
  "withTime",
  "team",
  "teams",
  "user",
  "urgent",
  "history",
  "documents",
];

export const allowedActionFieldsInHistory = [
  { name: "categories", label: "Catégorie(s)" },
  { name: "person", label: "Personne suivie" },
  { name: "group", label: "Action familiale" },
  { name: "name", label: "Nom de l'action" },
  { name: "description", label: "Description" },
  { name: "teams", label: "Équipe(s) en charge" },
  { name: "urgent", label: "Action urgente" },
  { name: "completedAt", label: "Faite le" },
  { name: "dueAt", label: "À faire le" },
  { name: "status", label: "Status" },
];

export const prepareActionForEncryption = (action: ActionInstance) => {
  try {
    if (!looseUuidRegex.test(action.person || "")) {
      throw new Error("Action is missing person");
    }
    for (const team of action.teams) {
      if (!looseUuidRegex.test(team)) {
        throw new Error("Action is missing teams");
      }
    }
    if (!action.teams.length) throw new Error("Action is missing teams");
    if (!looseUuidRegex.test(action.user)) {
      throw new Error("Action is missing user");
    }
  } catch (error) {
    Alert.alert(
      "L'action n'a pas été sauvegardée car son format était incorrect.",
      "Vous pouvez vérifier son contenu et tenter de la sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
    );
    capture(error);
    throw error;
  }
  const decrypted: Record<string, any> = {};
  for (let field of encryptedFields) {
    decrypted[field] = action[field];
  }
  return {
    _id: action._id,
    organisation: action.organisation,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,

    completedAt: action.completedAt,
    dueAt: action.dueAt,
    status: action.status,
    recurrence: action.recurrence,

    // Phase 1 (links migration): dual-write links outside encrypted blob.
    // Keep legacy fields in `decrypted` too (retro-compat).
    person: action.person,
    user: action.user,
    team: action.team,
    teams: action.teams,

    decrypted,
    entityKey: action.entityKey,
  };
};

export const CHOOSE = "CHOOSE";
export const TODO = "A FAIRE";
export const DONE = "FAIT";
export const CANCEL = "ANNULEE";

export const mappedIdsToLabels = [
  { _id: TODO, name: "À FAIRE" },
  { _id: DONE, name: "FAITE" },
  { _id: CANCEL, name: "ANNULÉE" },
];

export const actionsFiltersState = atom({
  key: "actionsFiltersState",
  default: {},
});
