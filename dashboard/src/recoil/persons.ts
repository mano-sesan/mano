/**
 * Person state and utilities
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { useStore, getState } from "../store";
import { organisationAuthentifiedSelector, personFieldsSelector, fieldsPersonsCustomizableOptionsSelector } from "../store/selectors";
import { toast } from "react-toastify";
import { capture } from "../services/sentry";
import type { PersonInstance } from "../types/person";
import type { PredefinedField, CustomField, CustomOrPredefinedField, FilterableField } from "../types/field";
import { encryptItem } from "../services/encryption";

// State reference for backward compatibility (use useStore instead)
export const personsState = { key: "person" };

// Selectors - use directly with useStore
export const personFieldsSelector_fn = (state: { organisation: any }) => {
  return (state.organisation?.personFields || []) as PredefinedField[];
};

export const fieldsPersonsCustomizableOptionsSelector_fn = (state: { organisation: any }): CustomField[] => {
  return (state.organisation?.fieldsPersonsCustomizableOptions || []) as CustomField[];
};

export const customFieldsPersonsSelector_fn = (state: { organisation: any }) => {
  return state.organisation?.customFieldsPersons || [];
};

export const flattenedCustomFieldsPersonsSelector_fn = (state: { organisation: any }): CustomField[] => {
  const sections = state.organisation?.customFieldsPersons || [];
  const result: CustomField[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      result.push(field);
    }
  }
  return result;
};

export const personFieldsIncludingCustomFieldsSelector_fn = (state: { organisation: any }): CustomOrPredefinedField[] => {
  const personFields = personFieldsSelector_fn(state);
  const customizableOptions = fieldsPersonsCustomizableOptionsSelector_fn(state);
  const flattenedCustom = flattenedCustomFieldsPersonsSelector_fn(state);

  return [
    ...personFields,
    ...[...customizableOptions, ...flattenedCustom].map((f) => ({
      name: f.name,
      type: f.type,
      label: f.label,
      enabled: f.enabled,
      enabledTeams: f.enabledTeams || undefined,
      encrypted: true,
      importable: true,
      options: f.options || undefined,
      filterable: true,
    })),
  ];
};

export const personTypesByFieldsNamesSelector_fn = (state: { organisation: any }): Record<string, string> => {
  const fields = personFieldsIncludingCustomFieldsSelector_fn(state);
  const result: Record<string, string> = {};
  for (const field of fields) {
    result[field.name] = field.type;
  }
  return result;
};

export const forbiddenPersonFieldsInHistory = ["history", "createdAt", "updatedAt", "documents"];

export const allowedPersonFieldsInHistorySelector_fn = (state: { organisation: any }): string[] => {
  const allFields = personFieldsIncludingCustomFieldsSelector_fn(state);
  return allFields.map((f) => f.name).filter((f) => !forbiddenPersonFieldsInHistory.includes(f));
};

// Legacy hook compatibility
export const usePreparePersonForEncryption = () => {
  const organisation = useStore((s) => s.organisation);
  const flattenedCustomFieldsPersons = flattenedCustomFieldsPersonsSelector_fn({ organisation });
  const fieldsPersonsCustomizableOptions = fieldsPersonsCustomizableOptionsSelector_fn({ organisation });
  const personFields = personFieldsSelector_fn({ organisation }) as PredefinedField[];

  const preparePersonForEncryption = (person: PersonInstance, { checkRequiredFields = true } = {}) => {
    if (checkRequiredFields) {
      try {
        if (!person.name) {
          throw new Error("Person is missing name");
        }
      } catch (error) {
        toast.error(
          "La personne n'a pas été sauvegardée car son format était incorrect. Vous pouvez vérifier son contenu et tenter de la sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
        );
        capture(error);
        throw error;
      }
    }
    const encryptedFields = personFields.filter((f) => f.encrypted).map((f) => f.name);
    const encryptedFieldsIncludingCustom = [
      ...flattenedCustomFieldsPersons.map((f) => f.name),
      ...fieldsPersonsCustomizableOptions.map((f) => f.name),
      ...encryptedFields,
    ];
    const decrypted: any = {};
    for (const field of encryptedFieldsIncludingCustom) {
      decrypted[field] = person[field] as never;
    }
    return {
      _id: person._id,
      organisation: person.organisation,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
      deletedAt: person.deletedAt,
      outOfActiveList: person.outOfActiveList,

      decrypted,
      entityKey: person.entityKey,
    };
  };
  const encryptPerson = (person: PersonInstance, { checkRequiredFields = true } = {}) => {
    return encryptItem(preparePersonForEncryption(person, { checkRequiredFields }));
  };
  return { encryptPerson, preparePersonForEncryption };
};

type SortOrder = "ASC" | "DESC";

type SortBy = "name" | "createdAt" | "deletedAt" | "formattedBirthDate" | "alertness" | "group" | "user" | "followedSince" | "lastUpdateCheckForGDPR";

const defaultSort = (a: PersonInstance, b: PersonInstance, sortOrder: SortOrder) => {
  const nameA = String(a.name || "");
  const nameB = String(b.name || "");
  return sortOrder === "ASC" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
};

export const sortPersons = (sortBy: SortBy, sortOrder: SortOrder) => (a: PersonInstance, b: PersonInstance) => {
  if (sortBy === "createdAt") {
    return sortOrder === "ASC"
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  }
  if (sortBy === "deletedAt") {
    return sortOrder === "ASC"
      ? new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
      : new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime();
  }
  if (sortBy === "formattedBirthDate") {
    if (!a.birthdate && !b.birthdate) return defaultSort(a, b, sortOrder);
    if (!a.birthdate) return sortOrder === "ASC" ? 1 : -1;
    if (!b.birthdate) return sortOrder === "DESC" ? 1 : -1;
    return sortOrder === "ASC"
      ? new Date(b.birthdate).getTime() - new Date(a.birthdate).getTime()
      : new Date(a.birthdate).getTime() - new Date(b.birthdate).getTime();
  }
  if (sortBy === "alertness") {
    if (a.alertness === b.alertness) return defaultSort(a, b, sortOrder);
    if (!a.alertness) return sortOrder === "ASC" ? 1 : -1;
    if (!b.alertness) return sortOrder === "DESC" ? 1 : -1;
    return 0;
  }
  if (sortBy === "group") {
    if (!!a.group === !!b.group) return defaultSort(a, b, sortOrder);
    if (!a.group) return sortOrder === "ASC" ? 1 : -1;
    if (!b.group) return sortOrder === "DESC" ? 1 : -1;
    return 0;
  }
  if (sortBy === "user") {
    if (!a.userPopulated && !b.userPopulated) return defaultSort(a, b, sortOrder);
    if (!a.userPopulated) return sortOrder === "ASC" ? 1 : -1;
    if (!b.userPopulated) return sortOrder === "ASC" ? -1 : 1;
    return sortOrder === "ASC" ? a.userPopulated.name.localeCompare(b.userPopulated.name) : b.userPopulated.name.localeCompare(a.userPopulated.name);
  }
  if (sortBy === "followedSince") {
    if (!a.followedSince && !b.followedSince) return defaultSort(a, b, sortOrder);
    if (!a.followedSince) return sortOrder === "ASC" ? 1 : -1;
    if (!b.followedSince) return sortOrder === "DESC" ? 1 : -1;
    return sortOrder === "ASC"
      ? new Date(b.followedSince).getTime() - new Date(a.followedSince).getTime()
      : new Date(a.followedSince).getTime() - new Date(b.followedSince).getTime();
  }
  if (sortBy === "lastUpdateCheckForGDPR") {
    if (!a.lastUpdateCheckForGDPR && !b.lastUpdateCheckForGDPR) return defaultSort(a, b, sortOrder);
    if (!a.lastUpdateCheckForGDPR) return sortOrder === "ASC" ? 1 : -1;
    if (!b.lastUpdateCheckForGDPR) return sortOrder === "DESC" ? 1 : -1;
    return sortOrder === "ASC"
      ? new Date(b.lastUpdateCheckForGDPR).getTime() - new Date(a.lastUpdateCheckForGDPR).getTime()
      : new Date(a.lastUpdateCheckForGDPR).getTime() - new Date(b.lastUpdateCheckForGDPR).getTime();
  }
  // DEFAULT SORTING
  // (sortBy === 'name')
  return defaultSort(a, b, sortOrder);
};
