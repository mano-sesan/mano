import { setCacheItem } from "../services/dataManagement";
import { atom, selector, useRecoilValue } from "recoil";
import { organisationState } from "./auth";
import { flattenedActionsCategoriesSelector } from "./actions";
import { toast } from "react-toastify";
import { capture } from "../services/sentry";
import type { PersonInstance } from "../types/person";
import type { PredefinedField, CustomField, CustomOrPredefinedField, FilterableField } from "../types/field";
import { encryptItem } from "../services/encryption";

const collectionName = "person";
export const personsState = atom<PersonInstance[]>({
  key: collectionName,
  default: [],
  effects: [({ onSet }) => onSet(async (newValue) => setCacheItem(collectionName, newValue))],
});

/*

All fields for person are
- personFieldsSelector: fields chosen by Mano, they afre fixed and cannot be changed (yet) by the user
- fieldsPersonsCustomizableOptionsSelector: fields chosen by Mano but that can have options chosen by the user
- customFieldsPersonsSelector: fields chosen by the user

*/
export const personFieldsSelector = selector({
  key: "personFieldsSelector",
  get: ({ get }) => {
    const organisation = get(organisationState);
    return organisation?.personFields || [];
  },
});

export const fieldsPersonsCustomizableOptionsSelector = selector<CustomField[]>({
  key: "fieldsPersonsCustomizableOptionsSelector",
  get: ({ get }) => {
    const organisation = get(organisationState);
    return (organisation?.fieldsPersonsCustomizableOptions || []) as CustomField[];
  },
});

export const customFieldsPersonsSelector = selector({
  key: "customFieldsPersonsSelector",
  get: ({ get }) => {
    const organisation = get(organisationState);
    return organisation?.customFieldsPersons || [];
  },
});

export const flattenedCustomFieldsPersonsSelector = selector({
  key: "flattenedCustomFieldsPersonsSelector",
  get: ({ get }) => {
    const customFieldsPersonsSections = get(customFieldsPersonsSelector);
    const customFieldsPersons = [];
    for (const section of customFieldsPersonsSections) {
      for (const field of section.fields) {
        customFieldsPersons.push(field);
      }
    }
    return customFieldsPersons;
  },
});

/* Other utils selector */

export const personFieldsIncludingCustomFieldsSelector = selector({
  key: "personFieldsIncludingCustomFieldsSelector",
  get: ({ get }) => {
    const personFields = get(personFieldsSelector) as PredefinedField[];
    const fieldsPersonsCustomizableOptions = get(fieldsPersonsCustomizableOptionsSelector) as CustomField[];
    const flattenedCustomFieldsPersons = get(flattenedCustomFieldsPersonsSelector);
    return [
      ...personFields,
      ...[...fieldsPersonsCustomizableOptions, ...flattenedCustomFieldsPersons].map((f) => {
        const field: CustomOrPredefinedField = {
          name: f.name,
          type: f.type,
          label: f.label,
          enabled: f.enabled,
          enabledTeams: f.enabledTeams || undefined,
          encrypted: true,
          importable: true,
          options: f.options || undefined,
          filterable: true,
        };
        return field;
      }),
    ];
  },
});

export const personTypesByFieldsNamesSelector = selector({
  key: "personTypesByFieldsNamesSelector",
  get: ({ get }) => {
    const personFieldsIncludingCustomFields = get(personFieldsIncludingCustomFieldsSelector);
    const personTypesByFieldsNames = {};
    for (const field of personFieldsIncludingCustomFields) {
      personTypesByFieldsNames[field.name] = field.type;
    }
    return personTypesByFieldsNames;
  },
});

export const forbiddenPersonFieldsInHistory = ["history", "createdAt", "updatedAt", "documents"];

export const allowedPersonFieldsInHistorySelector = selector({
  key: "allowedPersonFieldsInHistorySelector",
  get: ({ get }) => {
    const allFields = get(personFieldsIncludingCustomFieldsSelector);
    return allFields.map((f) => f.name).filter((f) => !forbiddenPersonFieldsInHistory.includes(f));
  },
});

export const filterPersonsBaseSelector = selector({
  key: "filterPersonsBaseSelector",
  get: ({ get }) => {
    const personFields = get(personFieldsSelector) as PredefinedField[];
    const flattenedActionsCategories = get(flattenedActionsCategoriesSelector);
    const filterPersonsBase: Array<FilterableField> = [];
    for (const field of personFields) {
      if (!field.filterable) continue;
      filterPersonsBase.push({
        // why ? IDK
        field: field.name,
        name: field.name,
        ...field,
      });
      if (field.name === "birthdate") {
        filterPersonsBase.push({
          field: "age",
          name: "age",
          label: "Age (en années)",
          type: "number",
        });
      }
    }
    const followUpFilter: FilterableField = {
      field: "followSinceMonths",
      name: "followSinceMonths",
      label: "Suivi depuis (en mois)",
      type: "number",
    };
    filterPersonsBase.push(followUpFilter);
    const followBySelectedTeamDuringPeriodFilter: FilterableField = {
      field: "startFollowBySelectedTeamDuringPeriod",
      name: "startFollowBySelectedTeamDuringPeriod",
      label: "Début de suivi par l'équipe(s) sélectionnée(s) pendant la période définie",
      type: "boolean",
    };
    filterPersonsBase.push(followBySelectedTeamDuringPeriodFilter);
    const hasAtLeastOneConsultationFilter: FilterableField = {
      field: "hasAtLeastOneConsultation",
      name: "hasAtLeastOneConsultation",
      label: "A eu une consultation",
      type: "boolean",
    };
    filterPersonsBase.push(hasAtLeastOneConsultationFilter);
    const numberOfConsultationsFilter: FilterableField = {
      field: "numberOfConsultations",
      name: "numberOfConsultations",
      label: "Nombre de consultations",
      type: "number",
    };
    filterPersonsBase.push(numberOfConsultationsFilter);
    const numberOfActionsFilter: FilterableField = {
      field: "numberOfActions",
      name: "numberOfActions",
      label: "Nombre d'actions",
      type: "number",
    };
    filterPersonsBase.push(numberOfActionsFilter);
    const actionsCategoriesFilter: FilterableField = {
      field: "actionCategories",
      name: "actionCategories",
      label: "A bénéficié d'une catégorie d'action",
      type: "enum",
      options: flattenedActionsCategories,
    };
    filterPersonsBase.push(actionsCategoriesFilter);
    const numberOfTreatmentsFilter: FilterableField = {
      field: "numberOfTreatments",
      name: "numberOfTreatments",
      label: "Nombre de traitements",
      type: "number",
    };
    filterPersonsBase.push(numberOfTreatmentsFilter);
    const numberOfPassagesFilter: FilterableField = {
      field: "numberOfPassages",
      name: "numberOfPassages",
      label: "Nombre de passages",
      type: "number",
    };
    filterPersonsBase.push(numberOfPassagesFilter);
    const numberOfRencontresFilter: FilterableField = {
      field: "numberOfRencontres",
      name: "numberOfRencontres",
      label: "Nombre de rencontres",
      type: "number",
    };
    filterPersonsBase.push(numberOfRencontresFilter);
    const lastUpdateCheckForGDPRFilter: FilterableField = {
      field: "lastUpdateCheckForGDPR",
      name: "lastUpdateCheckForGDPR",
      label: "Date de dernière interaction",
      type: "date",
    };
    filterPersonsBase.push(lastUpdateCheckForGDPRFilter);
    const belongsToAFamilyFilter: FilterableField = {
      field: "group",
      name: "belongsToAFamily",
      label: "Appartient à une famille",
      type: "boolean",
    };
    filterPersonsBase.push(belongsToAFamilyFilter);
    return filterPersonsBase;
  },
});

/*

Prepare for encryption hook

*/

export const usePreparePersonForEncryption = () => {
  const flattenedCustomFieldsPersons = useRecoilValue(flattenedCustomFieldsPersonsSelector);
  const fieldsPersonsCustomizableOptions = useRecoilValue(fieldsPersonsCustomizableOptionsSelector);
  const personFields = useRecoilValue(personFieldsSelector) as PredefinedField[];
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
