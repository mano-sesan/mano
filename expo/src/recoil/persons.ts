import { atomWithCache } from "@/store";
import { atom, useAtomValue } from "jotai";
import { organisationState, currentTeamState, userState, teamsState } from "./auth";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { PersonInstance } from "@/types/person";
import { Filter, FilterableField } from "@/types/field";
import { placesState } from "./places";
import { flattenedActionsCategoriesSelector } from "./actions";

export const personsState = atomWithCache<PersonInstance[]>("person", []);
/*

All fields for person are
- personFieldsSelector: fields chosen by Mano, they afre fixed and cannot be changed (yet) by the user
- fieldsPersonsCustomizableOptionsSelector: fields chosen by Mano but that can have options chosen by the user
- customFieldsPersonsSelector: fields chosen by the user

*/
export const personFieldsSelector = atom((get) => {
  const organisation = get(organisationState)!;
  return organisation.personFields;
});

export const fieldsPersonsCustomizableOptionsSelector = atom((get) => {
  const organisation = get(organisationState)!;
  return organisation.fieldsPersonsCustomizableOptions;
});

export const customFieldsPersonsSelector = atom((get) => {
  const organisation = get(organisationState)!;
  return organisation.customFieldsPersons || [];
});

export const flattenedCustomFieldsPersonsSelector = atom((get) => {
  const customFieldsPersonsSections = get(customFieldsPersonsSelector);
  const customFieldsPersons = [];
  for (const section of customFieldsPersonsSections) {
    for (const field of section.fields) {
      customFieldsPersons.push(field);
    }
  }
  return customFieldsPersons;
});

/* Other utils atom */

export const personFieldsIncludingCustomFieldsSelector = atom((get) => {
  const personFields = get(personFieldsSelector);
  const fieldsPersonsCustomizableOptions = get(fieldsPersonsCustomizableOptionsSelector);
  const flattenedCustomFieldsPersons = get(flattenedCustomFieldsPersonsSelector);
  return [
    ...personFields,
    ...[...fieldsPersonsCustomizableOptions, ...flattenedCustomFieldsPersons].map((f) => {
      return {
        name: f.name,
        type: f.type,
        label: f.label,
        encrypted: true,
        importable: true,
        options: f.options || null,
      };
    }),
  ];
});

export const forbiddenPersonFieldsInHistory = ["history", "createdAt", "updatedAt", "documents"];

export const allowedPersonFieldsInHistorySelector = atom((get) => {
  const allFields = get(personFieldsIncludingCustomFieldsSelector);
  return allFields.map((f) => f.name).filter((f) => !forbiddenPersonFieldsInHistory.includes(f));
});

export const filterPersonsBaseSelector = atom((get) => {
  const personFields = get(personFieldsSelector);
  return personFields.filter((m) => m.filterable).map(({ name, ...rest }) => ({ field: name, ...rest }));
});

/*

Prepare for encryption hook

*/

export const usePreparePersonForEncryption = () => {
  const flattenedCustomFieldsPersons = useAtomValue(flattenedCustomFieldsPersonsSelector);
  const fieldsPersonsCustomizableOptions = useAtomValue(fieldsPersonsCustomizableOptionsSelector);
  const personFields = useAtomValue(personFieldsSelector);
  const preparePersonForEncryption = (person: Partial<PersonInstance>) => {
    try {
      if (!person.name) {
        throw new Error("Person is missing name");
      }
    } catch (error) {
      Alert.alert(
        "La personne n'a pas été sauvegardée car son format était incorrect.",
        "Vous pouvez vérifier son contenu et tenter de la sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
      );
      capture(error);
      throw error;
    }
    const encryptedFields = personFields.filter((f) => f.encrypted).map((f) => f.name);
    const encryptedFieldsIncludingCustom = [
      ...flattenedCustomFieldsPersons.map((f) => f.name),
      ...fieldsPersonsCustomizableOptions.map((f) => f.name),
      ...encryptedFields,
    ];
    const decrypted: Record<string, any> = {};
    for (let field of encryptedFieldsIncludingCustom) {
      decrypted[field] = person[field];
    }
    return {
      _id: person._id,
      organisation: person.organisation,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
      outOfActiveList: person.outOfActiveList,

      decrypted,
      entityKey: person.entityKey,
    };
  };
  return preparePersonForEncryption;
};

/*

Filters for persons list

*/

export const personsFiltersState = atomWithCache<Array<Filter>>("person-filters-v2", []);

export const availablePersonFiltersSelector = atom((get) => {
  const places = get(placesState);
  const teams = get(teamsState);
  const user = get(userState);
  const team = get(currentTeamState);
  const fieldsPersonsCustomizableOptions = get(fieldsPersonsCustomizableOptionsSelector);
  const flattenedCustomFieldsPersons = get(flattenedCustomFieldsPersonsSelector);
  const filterPersonsBase = get(filterPersonsBaseSelector);
  const flattenedActionsCategories = get(flattenedActionsCategoriesSelector);

  if (!user || !team) return [];

  const filterBase: Array<FilterableField> = [
    ...filterPersonsBase,
    ...fieldsPersonsCustomizableOptions
      .filter((a) => a.enabled || a.enabledTeams?.includes(team._id))
      .map((a) => ({ field: a.name, name: a.name, label: a.label, type: a.type, options: a.options })),
    ...flattenedCustomFieldsPersons
      .filter((a) => a.enabled || a.enabledTeams?.includes(team._id))
      .map((a) => ({ field: a.name, name: a.name, label: a.label, type: a.type, options: a.options })),
    {
      field: "places",
      name: "places",
      label: "Lieux fréquentés",
      type: "multi-choice" as const,
      options: [...new Set(places.map((place) => place.name))],
    },
    {
      field: "assignedTeams",
      name: "assignedTeams",
      label: "Équipes en charge",
      type: "multi-choice" as const,
      options: teams.map((t) => t.name).filter(Boolean) as string[],
    },
  ];

  // Add calculated fields for statistics
  const calculatedFields: Array<FilterableField> = [
    {
      field: "age",
      name: "age",
      label: "Âge (en années)",
      type: "number",
    },
    {
      field: "followSinceMonths",
      name: "followSinceMonths",
      label: "Suivi depuis (en mois)",
      type: "number",
    },
    {
      field: "hasAtLeastOneConsultation",
      name: "hasAtLeastOneConsultation",
      label: "A eu une consultation",
      type: "boolean",
    },
    {
      field: "numberOfConsultations",
      name: "numberOfConsultations",
      label: "Nombre de consultations",
      type: "number",
    },
    {
      field: "numberOfActions",
      name: "numberOfActions",
      label: "Nombre d'actions",
      type: "number",
    },
    {
      field: "actionCategories",
      name: "actionCategories",
      label: "A bénéficié d'une de ces catégories d'action",
      type: "enum",
      options: flattenedActionsCategories,
    },
    {
      field: "actionCategoriesCombined",
      name: "actionCategoriesCombined",
      label: "A bénéficié d'une action contenant toutes ces catégories",
      type: "enum",
      options: flattenedActionsCategories,
    },
    {
      field: "numberOfTreatments",
      name: "numberOfTreatments",
      label: "Nombre de traitements",
      type: "number",
    },
    {
      field: "numberOfPassages",
      name: "numberOfPassages",
      label: "Nombre de passages",
      type: "number",
    },
    {
      field: "numberOfRencontres",
      name: "numberOfRencontres",
      label: "Nombre de rencontres",
      type: "number",
    },
    {
      field: "group",
      name: "group",
      label: "Appartient à une famille",
      type: "boolean",
    },
  ];

  filterBase.push(...calculatedFields);

  // TODO: Add medical fields if user.healthcareProfessional (Phase 2)
  // This would require importing customFieldsMedicalFileSelector and flattenedCustomFieldsConsultationsSelector

  return filterBase;
});
