/**
 * Computed selectors for the store.
 * These are simple functions that derive data from state.
 * Use with useStore: const value = useStore(selectorName);
 */

import type { OrganisationInstance } from "../types/organisation";
import type { PersonInstance } from "../types/person";
import type { UserInstance } from "../types/user";
import type { TeamInstance } from "../types/team";
import type { ActionInstance } from "../types/action";
import type { ConsultationInstance } from "../types/consultation";
import type { CustomField, CustomFieldsGroup, CustomOrPredefinedField, FilterableField, PredefinedField } from "../types/field";
import type { ReportInstance } from "../types/report";
import type { TreatmentInstance } from "../types/treatment";
import type { TerritoryInstance } from "../types/territory";
import type { TerritoryObservationInstance } from "../types/territoryObs";
import type { MedicalFileInstance } from "../types/medicalFile";
import type { RencontreInstance } from "../types/rencontre";
import type { GroupInstance } from "../types/group";
import { useStore, type CommentInstance, type PassageInstance, type PlaceInstance, type RelPersonPlaceInstance } from "./index";
import { ageFromBirthdateAsYear, dayjsInstance, formatBirthDate } from "../services/date";
import { extractInfosFromHistory } from "../utils/person-history";
import { excludeConsultationsFieldsFromSearch } from "../recoil/consultations";

// === Auth Selectors ===

export const userAuthentifiedSelector = (state: { user: UserInstance | null }): UserInstance => {
  if (!state.user) throw new Error("User is not authenticated");
  return state.user;
};

export const organisationAuthentifiedSelector = (state: { organisation: OrganisationInstance | null }): OrganisationInstance => {
  if (!state.organisation) throw new Error("organisation is not defined");
  return state.organisation;
};

export const currentTeamAuthentifiedSelector = (state: { currentTeam: TeamInstance | null }): TeamInstance => {
  if (!state.currentTeam) throw new Error("currentTeam is not defined");
  return state.currentTeam;
};

// === Organisation-derived Selectors ===

export const personFieldsSelector = (state: { organisation: OrganisationInstance | null }): PredefinedField[] => {
  return (state.organisation?.personFields || []) as PredefinedField[];
};

export const fieldsPersonsCustomizableOptionsSelector = (state: { organisation: OrganisationInstance | null }): CustomField[] => {
  return (state.organisation?.fieldsPersonsCustomizableOptions || []) as CustomField[];
};

export const customFieldsPersonsSelector = (state: { organisation: OrganisationInstance | null }): CustomFieldsGroup[] => {
  return state.organisation?.customFieldsPersons || [];
};

export const flattenedCustomFieldsPersonsSelector = (state: { organisation: OrganisationInstance | null }): CustomField[] => {
  const sections = state.organisation?.customFieldsPersons || [];
  const result: CustomField[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      result.push(field);
    }
  }
  return result;
};

export const actionsCategoriesSelector = (state: { organisation: OrganisationInstance | null }) => {
  if (state.organisation?.actionsGroupedCategories) return state.organisation.actionsGroupedCategories;
  return [{ groupTitle: "Toutes mes catégories", categories: [] }];
};

export const flattenedActionsCategoriesSelector = (state: { organisation: OrganisationInstance | null }): string[] => {
  const categories = actionsCategoriesSelector(state);
  return categories.reduce<string[]>((all, { categories }) => [...all, ...categories], []);
};

export const servicesSelector = (state: { organisation: OrganisationInstance | null }) => {
  return state.organisation?.groupedServices || [];
};

export const flattenedServicesSelector = (state: { organisation: OrganisationInstance | null }): string[] => {
  const services = servicesSelector(state);
  return services.reduce<string[]>((all, { services }) => [...all, ...services], []);
};

export const consultationFieldsSelector = (state: { organisation: OrganisationInstance | null }): CustomFieldsGroup[] => {
  return state.organisation?.consultations || [];
};

export const flattenedCustomFieldsConsultationsSelector = (state: { organisation: OrganisationInstance | null }): CustomField[] => {
  const sections = consultationFieldsSelector(state);
  const result: CustomField[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      result.push(field);
    }
  }
  return result;
};

export const territoriesTypesSelector = (state: { organisation: OrganisationInstance | null }) => {
  return state.organisation?.territoriesGroupedTypes || [];
};

export const flattenedTerritoriesTypesSelector = (state: { organisation: OrganisationInstance | null }): string[] => {
  const types = territoriesTypesSelector(state);
  return types.reduce<string[]>((all, { types }) => [...all, ...types], []);
};

export const structuresCategoriesSelector = (state: { organisation: OrganisationInstance | null }) => {
  return state.organisation?.structuresGroupedCategories || [];
};

export const flattenedStructuresCategoriesSelector = (state: { organisation: OrganisationInstance | null }): string[] => {
  const categories = structuresCategoriesSelector(state);
  return categories.reduce<string[]>((all, { categories }) => [...all, ...categories], []);
};

export const customFieldsObsSelector = (state: { organisation: OrganisationInstance | null }): CustomField[] => {
  const org = state.organisation;
  if (Array.isArray(org?.customFieldsObs) && org.customFieldsObs.length) return org.customFieldsObs;
  return defaultCustomFieldsObs;
};

export const groupedCustomFieldsObsSelector = (state: { organisation: OrganisationInstance | null }): CustomFieldsGroup[] => {
  const org = state.organisation;
  if (Array.isArray(org?.groupedCustomFieldsObs) && org.groupedCustomFieldsObs.length) return org.groupedCustomFieldsObs;
  return [{ name: "Groupe par défaut", fields: defaultCustomFieldsObs }];
};

export const defaultCustomFieldsObs: CustomField[] = [
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

// === Person Fields Selectors ===

export const personFieldsIncludingCustomFieldsSelector = (state: { organisation: OrganisationInstance | null }): CustomOrPredefinedField[] => {
  const personFields = personFieldsSelector(state);
  const customizableOptions = fieldsPersonsCustomizableOptionsSelector(state);
  const flattenedCustom = flattenedCustomFieldsPersonsSelector(state);

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

export const personTypesByFieldsNamesSelector = (state: { organisation: OrganisationInstance | null }): Record<string, string> => {
  const fields = personFieldsIncludingCustomFieldsSelector(state);
  const result: Record<string, string> = {};
  for (const field of fields) {
    result[field.name] = field.type;
  }
  return result;
};

export const forbiddenPersonFieldsInHistory = ["history", "createdAt", "updatedAt", "documents"];

export const allowedPersonFieldsInHistorySelector = (state: { organisation: OrganisationInstance | null }): string[] => {
  const allFields = personFieldsIncludingCustomFieldsSelector(state);
  return allFields.map((f) => f.name).filter((f) => !forbiddenPersonFieldsInHistory.includes(f));
};

export const filterPersonsBaseSelector = (state: { organisation: OrganisationInstance | null }): FilterableField[] => {
  const personFields = personFieldsSelector(state);
  const flattenedActionsCategories = flattenedActionsCategoriesSelector(state);
  const result: FilterableField[] = [];

  for (const field of personFields) {
    if (!field.filterable) continue;
    result.push({ field: field.name, name: field.name, ...field });
    if (field.name === "birthdate") {
      result.push({ field: "age", name: "age", label: "Age (en années)", type: "number" });
    }
  }

  result.push({ field: "followSinceMonths", name: "followSinceMonths", label: "Suivi depuis (en mois)", type: "number" });
  result.push({
    field: "startFollowBySelectedTeamDuringPeriod",
    name: "startFollowBySelectedTeamDuringPeriod",
    label: "Début de suivi par l'équipe(s) sélectionnée(s) pendant la période définie",
    type: "boolean",
  });
  result.push({ field: "hasAtLeastOneConsultation", name: "hasAtLeastOneConsultation", label: "A eu une consultation", type: "boolean" });
  result.push({ field: "numberOfConsultations", name: "numberOfConsultations", label: "Nombre de consultations", type: "number" });
  result.push({ field: "numberOfActions", name: "numberOfActions", label: "Nombre d'actions", type: "number" });
  result.push({
    field: "actionCategories",
    name: "actionCategories",
    label: "A bénéficié d'une catégorie d'action",
    type: "enum",
    options: flattenedActionsCategories,
  });
  result.push({ field: "numberOfTreatments", name: "numberOfTreatments", label: "Nombre de traitements", type: "number" });
  result.push({ field: "numberOfPassages", name: "numberOfPassages", label: "Nombre de passages", type: "number" });
  result.push({ field: "numberOfRencontres", name: "numberOfRencontres", label: "Nombre de rencontres", type: "number" });
  result.push({ field: "lastUpdateCheckForGDPR", name: "lastUpdateCheckForGDPR", label: "Date de dernière interaction", type: "date" });
  result.push({ field: "group", name: "belongsToAFamily", label: "Appartient à une famille", type: "boolean" });

  return result;
};

// === Consultation Fields Selector ===

export const consultationsFieldsIncludingCustomFieldsSelector = (state: { organisation: OrganisationInstance | null }) => {
  const flattenedCustom = flattenedCustomFieldsConsultationsSelector(state);
  return [
    { name: "name", label: "Nom" },
    { name: "type", label: "Type" },
    { name: "onlyVisibleBy", label: "Seulement visible par moi" },
    { name: "person", label: "Personne suivie" },
    { name: "teams", label: ":Equipe(s) en charge" },
    { name: "completedAt", label: "Faite le" },
    { name: "dueAt", label: "À faire le" },
    { name: "status", label: "Statut" },
    ...flattenedCustom.map((f) => ({ name: f.name, label: f.label })),
  ];
};

// === Version Selectors ===

export const deploymentShortCommitSHASelector = (state: { deploymentCommit: string | null }): string => {
  return (state.deploymentCommit || "-").substring(0, 7);
};

// Alias for backward compatibility
export const deploymentShortCommitSHA = deploymentShortCommitSHASelector;

export const showOutdateAlertBannerSelector = (state: { deploymentCommit: string | null; deploymentDate: string | null }): boolean => {
  if (!state.deploymentCommit || !state.deploymentDate) return false;
  return (
    dayjsInstance(state.deploymentDate).isAfter(dayjsInstance(window.localStorage.getItem("deploymentDate"))) &&
    state.deploymentCommit !== window.localStorage.getItem("deploymentCommit")
  );
};

// === Current Team Reports Selector ===

export const currentTeamReportsSelector = (state: { reports: ReportInstance[]; currentTeam: TeamInstance | null }): ReportInstance[] => {
  return state.reports.filter((r) => r.team === state.currentTeam?._id);
};

// === Users Object Selector ===

export const usersObjectSelector = (state: { users: UserInstance[] }): Record<string, UserInstance> => {
  const result: Record<string, UserInstance> = {};
  for (const user of state.users) {
    result[user._id] = user;
  }
  return result;
};

// === Persons Object Selector ===

export const personsObjectSelector = (state: { persons: PersonInstance[] }): Record<string, PersonInstance> => {
  const result: Record<string, PersonInstance> = {};
  for (const person of state.persons) {
    result[person._id] = { ...person };
  }
  return result;
};

// === Places Object Selector ===

export const placesObjectSelector = (state: { places: PlaceInstance[] }): Record<string, PlaceInstance> => {
  const result: Record<string, PlaceInstance> = {};
  for (const place of state.places) {
    if (!place?.name) continue;
    result[place._id] = place;
  }
  return result;
};

// === Evolutive Stats Indicators Base ===

export const evolutiveStatsIndicatorsBaseSelector = (state: { organisation: OrganisationInstance | null; currentTeam: TeamInstance | null }) => {
  const allFields = personFieldsIncludingCustomFieldsSelector(state);
  const currentTeam = state.currentTeam;

  return allFields
    .filter((a) => a.enabled || a.enabledTeams?.includes(currentTeam?._id || ""))
    .filter((f) => {
      if (f.name === "history") return false;
      if (f.name === "documents") return false;
      switch (f.type) {
        case "text":
        case "textarea":
        case "date":
        case "duration":
        case "date-with-time":
          return false;
        case "multi-choice":
        case "number":
        case "yes-no":
        case "enum":
        case "boolean":
        default:
          return f.filterable;
      }
    });
};

// === Only Filled Observations Territories ===

export const onlyFilledObservationsTerritoriesSelector = (state: {
  organisation: OrganisationInstance | null;
  territoryObservations: TerritoryObservationInstance[];
}) => {
  const customFieldsObs = customFieldsObsSelector(state);
  const observations = state.territoryObservations;

  const observationsKeyLabels: Record<string, string> = {};
  for (const field of customFieldsObs) {
    observationsKeyLabels[field.name] = field.label;
  }

  return observations.map((obs) => {
    const obsWithOnlyFilledFields: Record<string, unknown> = {};
    for (const key of Object.keys(obs)) {
      if (observationsKeyLabels[key]) {
        if ((obs as Record<string, unknown>)[key] != null) {
          obsWithOnlyFilledFields[key] = (obs as Record<string, unknown>)[key];
        }
      } else {
        obsWithOnlyFilledFields[key] = (obs as Record<string, unknown>)[key];
      }
    }
    return { _id: obs._id, territory: obs.territory, ...obsWithOnlyFilledFields };
  });
};

// === Populated Passages Selector ===

interface PopulatedPassage extends PassageInstance {
  type: "Anonyme" | "Non-anonyme";
  gender: string | null;
}

// Export helper function for complex selectors that need full store access
// This is used by components that need the itemsGroupedByPersonSelector logic
export function createItemsGroupedByPersonSelector() {
  const state = useStore.getState();
  return computeItemsGroupedByPerson(state);
}

// Main computation function for items grouped by person
export function computeItemsGroupedByPerson(state: {
  persons: PersonInstance[];
  groups: GroupInstance[];
  actions: ActionInstance[];
  consultations: ConsultationInstance[];
  treatments: TreatmentInstance[];
  medicalFiles: MedicalFileInstance[];
  reports: ReportInstance[];
  passages: PassageInstance[];
  rencontres: RencontreInstance[];
  territories: TerritoryInstance[];
  territoryObservations: TerritoryObservationInstance[];
  places: PlaceInstance[];
  relsPersonPlace: RelPersonPlaceInstance[];
  comments: CommentInstance[];
  user: UserInstance | null;
  users: UserInstance[];
}): Record<string, any> {
  const endOfToday = dayjsInstance().endOf("day").toISOString();
  const usersObject = usersObjectSelector(state);
  const placesObject = placesObjectSelector(state);

  const personsObject: Record<string, any> = {};

  // Initialize persons
  for (const person of state.persons) {
    const { interactions, assignedTeamsPeriods } = extractInfosFromHistory(person);
    personsObject[person._id] = {
      ...person,
      followedSince: person.followedSince || person.createdAt,
      followSinceMonths: dayjsInstance().diff(person.followedSince || person.createdAt, "months"),
      userPopulated: usersObject[person.user],
      formattedBirthDate: formatBirthDate(person.birthdate),
      age: ageFromBirthdateAsYear(person.birthdate),
      formattedPhoneNumber: person.phone?.replace(/\D/g, ""),
      interactions,
      assignedTeamsPeriods,
      lastUpdateCheckForGDPR: person.followedSince || person.createdAt,
      numberOfActions: 0,
      numberOfConsultations: 0,
      numberOfTreatments: 0,
      numberOfPassages: 0,
      numberOfRencontres: 0,
      hasAtLeastOneConsultation: false,
      outOfActiveListDate: person.outOfActiveList ? person.outOfActiveListDate : null,
    };
  }

  // Add groups to persons
  for (const group of state.groups) {
    if (!group.persons?.length) continue;
    for (const personId of group.persons) {
      if (!personsObject[personId]) continue;
      personsObject[personId].group = group;
    }
  }

  // Process person documents
  for (const person of state.persons) {
    if (!person.documents?.length) continue;
    const documentsForModule: any[] = [];
    const uniqueDocIds: Record<string, boolean> = {};
    for (const document of person.documents) {
      if (!document) continue;
      if (uniqueDocIds[document._id]) continue;
      uniqueDocIds[document._id] = true;
      const documentForModule = {
        ...document,
        type: document.type ?? "document",
        linkedItem: { _id: person._id, type: "person" },
      };
      documentsForModule.push(documentForModule);
      personsObject[person._id].interactions.push(document.createdAt);
      if (!document.group) continue;
      if (!personsObject[person._id].group) continue;
      for (const personIdInGroup of personsObject[person._id].group.persons) {
        if (personIdInGroup === person._id) continue;
        if (!personsObject[personIdInGroup]) continue;
        if (!personsObject[personIdInGroup].groupDocuments) {
          personsObject[personIdInGroup].groupDocuments = [];
        }
        personsObject[personIdInGroup].groupDocuments.push(documentForModule);
      }
    }
    personsObject[person._id].documentsForModule = documentsForModule;
  }

  // Build actions with comments
  const actionsWithComments: Record<string, any> = {};
  for (const action of state.actions) {
    actionsWithComments[action._id] = { ...action, comments: [] };
  }
  for (const comment of state.comments) {
    if (!actionsWithComments[comment.action]) continue;
    actionsWithComments[comment.action].comments.push({ ...comment, date: comment.date || comment.createdAt });
  }

  const personPerAction: Record<string, string> = {};
  const personActionCategoriesObject: Record<string, Record<string, boolean>> = {};

  // Process actions
  for (const action of Object.values(actionsWithComments) as any[]) {
    if (!personsObject[action.person]) continue;
    personPerAction[action._id] = action.person;
    personsObject[action.person].actions = personsObject[action.person].actions || [];
    personsObject[action.person].actions.push(action);
    personsObject[action.person].numberOfActions++;
    personsObject[action.person].interactions.push(action.dueAt, action.createdAt, action.completedAt);

    if (action.categories) {
      for (const category of action.categories) {
        personActionCategoriesObject[action.person] = personActionCategoriesObject[action.person] || {};
        personsObject[action.person].actionCategories = personsObject[action.person].actionCategories || [];
        if (!personActionCategoriesObject[action.person][category]) {
          personActionCategoriesObject[action.person][category] = true;
          personsObject[action.person].actionCategories.push(category);
        }
      }
    }

    if (action.group) {
      const group = personsObject[action.person].group;
      if (group) {
        for (const personId of group.persons) {
          if (!personsObject[personId]) continue;
          if (personId === action.person) continue;
          personsObject[personId].actions = personsObject[personId].actions || [];
          personsObject[personId].actions.push(action);
        }
      }
    }

    if (action.documents) {
      for (const document of action.documents) {
        if (!document) continue;
        personsObject[action.person].documentsForModule = personsObject[action.person].documentsForModule || [];
        personsObject[action.person].documentsForModule.push({
          ...document,
          type: "document",
          linkedItem: { _id: action._id, type: "action" },
          parentId: document.parentId ?? "actions",
        });
        if (action.group) {
          const group = personsObject[action.person].group;
          if (group) {
            for (const personId of group.persons) {
              if (!personsObject[personId]) continue;
              if (personId === action.person) continue;
              personsObject[personId].documentsForModule = personsObject[personId].documentsForModule || [];
              personsObject[personId].documentsForModule.push({
                ...document,
                type: "document",
                linkedItem: { _id: action._id, type: "action" },
                parentId: document.parentId ?? "actions",
              });
            }
          }
        }
      }
    }
  }

  // Process comments
  for (const comment of state.comments) {
    if (comment.action) {
      const personId = personPerAction[comment.action];
      if (!personId || !personsObject[personId]) continue;
      personsObject[personId].comments = personsObject[personId].comments || [];
      personsObject[personId].comments.push({ ...comment, type: "action", date: comment.date || comment.createdAt });
      if (actionsWithComments[comment.action]?.group) {
        const actionPersonGroup = personsObject[actionsWithComments[comment.action].person]?.group;
        if (actionPersonGroup) {
          for (const personOfGroup of actionPersonGroup.persons) {
            if (!personsObject[personOfGroup]) continue;
            if (personOfGroup === personId) continue;
            personsObject[personOfGroup].comments = personsObject[personOfGroup].comments || [];
            personsObject[personOfGroup].comments.push({ ...comment, type: "action", date: comment.date || comment.createdAt });
          }
        }
      }
      continue;
    }
    if (!personsObject[comment.person]) continue;
    personsObject[comment.person].comments = personsObject[comment.person].comments || [];
    personsObject[comment.person].comments.push({ ...comment, type: "person", date: comment.date || comment.createdAt });
    personsObject[comment.person].interactions.push(comment.date || comment.createdAt);
    if (comment.group) {
      const group = personsObject[comment.person].group;
      if (group) {
        for (const personId of group.persons) {
          if (!personsObject[personId]) continue;
          if (personId === comment.person) continue;
          personsObject[personId].comments = personsObject[personId].comments || [];
          personsObject[personId].comments.push({ ...comment, type: "person", date: comment.date || comment.createdAt });
        }
      }
    }
  }

  // Process relPersonPlace
  for (const rel of state.relsPersonPlace) {
    if (!personsObject[rel.person]) continue;
    const place = placesObject[rel.place];
    if (!place) continue;
    personsObject[rel.person].places = personsObject[rel.person].places || [];
    personsObject[rel.person].places.push(place.name);
    personsObject[rel.person].relsPersonPlace = personsObject[rel.person].relsPersonPlace || [];
    personsObject[rel.person].relsPersonPlace.push(rel);
    personsObject[rel.person].interactions.push(rel.createdAt);
  }

  // Process consultations
  for (const consultation of state.consultations) {
    if (!personsObject[consultation.person]) continue;
    personsObject[consultation.person].consultations = personsObject[consultation.person].consultations || [];
    personsObject[consultation.person].flattenedConsultations = personsObject[consultation.person].flattenedConsultations || {};

    for (const key of Object.keys(consultation)) {
      if (excludeConsultationsFieldsFromSearch.has(key)) continue;
      if (!personsObject[consultation.person].flattenedConsultations[key]) {
        personsObject[consultation.person].flattenedConsultations[key] = [];
      }
      if (Array.isArray((consultation as any)[key])) {
        personsObject[consultation.person].flattenedConsultations[key] = personsObject[consultation.person].flattenedConsultations[key].concat(
          (consultation as any)[key]
        );
      } else {
        personsObject[consultation.person].flattenedConsultations[key].push((consultation as any)[key]);
      }
    }

    personsObject[consultation.person].consultations.push(consultation);
    personsObject[consultation.person].hasAtLeastOneConsultation = true;
    personsObject[consultation.person].numberOfConsultations++;
    personsObject[consultation.person].interactions.push(consultation.dueAt, consultation.createdAt, consultation.completedAt);

    const consultationIsVisibleByMe = !consultation.onlyVisibleBy?.length || consultation.onlyVisibleBy.includes(state.user?._id || "");
    for (const comment of consultation.comments || []) {
      personsObject[consultation.person].interactions.push(comment.date);
      if (!consultationIsVisibleByMe) continue;
      personsObject[consultation.person].commentsMedical = personsObject[consultation.person].commentsMedical || [];
      personsObject[consultation.person].commentsMedical.push({
        ...comment,
        consultation,
        person: consultation.person,
        type: "consultation",
      });
    }
  }

  // Process treatments
  for (const treatment of state.treatments) {
    if (!personsObject[treatment.person]) continue;
    personsObject[treatment.person].treatments = personsObject[treatment.person].treatments || [];
    personsObject[treatment.person].treatments.push(treatment);
    personsObject[treatment.person].numberOfTreatments++;
    personsObject[treatment.person].interactions.push(treatment.createdAt);
    for (const comment of treatment.comments || []) {
      personsObject[treatment.person].interactions.push(comment.date);
      personsObject[treatment.person].commentsMedical = personsObject[treatment.person].commentsMedical || [];
      personsObject[treatment.person].commentsMedical.push({
        ...comment,
        treatment,
        person: treatment.person,
        type: "treatment",
      });
    }
  }

  // Process medical files
  const sortedMedicalFiles = [...state.medicalFiles].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  for (const medicalFile of sortedMedicalFiles) {
    if (!personsObject[medicalFile.person]) continue;
    if (personsObject[medicalFile.person].medicalFile) {
      const nextDocuments: Record<string, any> = {};
      const nextComments: Record<string, any> = {};
      const existingMedicalFile = personsObject[medicalFile.person].medicalFile;
      for (const document of medicalFile.documents || []) {
        nextDocuments[document._id] = document;
      }
      for (const document of existingMedicalFile.documents || []) {
        nextDocuments[document._id] = document;
      }
      for (const comment of medicalFile.comments || []) {
        nextComments[comment._id] = comment;
      }
      for (const comment of existingMedicalFile.comments || []) {
        nextComments[comment._id] = comment;
      }
      personsObject[medicalFile.person].medicalFile = {
        ...medicalFile,
        ...personsObject[medicalFile.person].medicalFile,
        documents: Object.values(nextDocuments),
        comments: Object.values(nextComments),
      };
    } else {
      personsObject[medicalFile.person].medicalFile = medicalFile;
    }
    personsObject[medicalFile.person].interactions.push(medicalFile.createdAt);
    for (const comment of medicalFile.comments || []) {
      personsObject[medicalFile.person].interactions.push(comment.date);
      personsObject[medicalFile.person].commentsMedical = personsObject[medicalFile.person].commentsMedical || [];
      personsObject[medicalFile.person].commentsMedical.push({
        ...comment,
        person: medicalFile.person,
        type: "medical-file",
      });
    }
  }

  // Process passages
  for (const passage of state.passages) {
    if (!personsObject[passage.person]) continue;
    personsObject[passage.person].passages = personsObject[passage.person].passages || [];
    personsObject[passage.person].passages.push({
      ...passage,
      type: "Non-anonyme",
      gender: personsObject[passage.person]?.gender || "Non renseigné",
    });
    personsObject[passage.person].numberOfPassages++;
    personsObject[passage.person].interactions.push(passage.date || passage.createdAt);
    if (passage.comment) {
      personsObject[passage.person].comments = personsObject[passage.person].comments || [];
      personsObject[passage.person].comments.push({
        comment: passage.comment,
        type: "passage",
        team: passage.team,
        person: passage.person,
        passage: passage._id,
        date: passage.date,
        user: passage.user,
        _id: passage.date + passage._id,
      });
    }
  }

  // Process rencontres with territories
  const rencontresObject: Record<string, RencontreInstance> = {};
  const rencontresByObservations: Record<string, string[]> = {};
  for (const rencontre of state.rencontres) {
    if (!personsObject[rencontre.person]) continue;
    rencontresObject[rencontre._id] = rencontre;
    personsObject[rencontre.person].numberOfRencontres++;
    if (!rencontre.observation) continue;
    if (!rencontresByObservations[rencontre.observation]) rencontresByObservations[rencontre.observation] = [];
    rencontresByObservations[rencontre.observation].push(rencontre._id);
  }

  const observationsForRencontresObject: Record<string, { territory: string }> = {};
  const observationsByTerritories: Record<string, string[]> = {};
  for (const observation of state.territoryObservations) {
    if (!rencontresByObservations[observation._id]) continue;
    observationsForRencontresObject[observation._id] = { territory: observation.territory };
    if (!observationsByTerritories[observation.territory]) observationsByTerritories[observation.territory] = [];
    observationsByTerritories[observation.territory].push(observation._id);
  }

  const territoriesForObservationsForRencontresObject: Record<string, { name: string }> = {};
  for (const territory of state.territories) {
    if (!observationsByTerritories[territory._id]) continue;
    territoriesForObservationsForRencontresObject[territory._id] = { name: territory.name };
  }

  for (const rencontre of Object.values(rencontresObject)) {
    if (!personsObject[rencontre.person]) continue;
    personsObject[rencontre.person].rencontres = personsObject[rencontre.person].rencontres || [];
    if (rencontre.observation) {
      const observationObject = observationsForRencontresObject[rencontre.observation];
      if (!observationObject) {
        personsObject[rencontre.person].rencontres.push(rencontre);
      } else {
        const territoryObject = territoriesForObservationsForRencontresObject[observationObject.territory];
        personsObject[rencontre.person].rencontres.push({
          ...rencontre,
          observationObject,
          territoryObject,
        });
      }
    } else {
      personsObject[rencontre.person].rencontres.push(rencontre);
    }

    personsObject[rencontre.person].interactions.push(rencontre.date || rencontre.createdAt);
    if (rencontre.comment) {
      personsObject[rencontre.person].comments = personsObject[rencontre.person].comments || [];
      personsObject[rencontre.person].comments.push({
        comment: rencontre.comment,
        type: "rencontre",
        rencontre: rencontre._id,
        person: rencontre.person,
        team: rencontre.team,
        user: rencontre.user,
        date: rencontre.date,
        _id: rencontre.date + rencontre._id,
      });
    }
  }

  // Finalize interactions
  for (const personId of Object.keys(personsObject)) {
    personsObject[personId].interactions = [
      ...new Set(
        personsObject[personId].interactions.sort((a: string, b: string) => {
          if (a > b) return -1;
          if (a < b) return 1;
          return 0;
        })
      ),
    ].filter((i: string) => Boolean(i));

    personsObject[personId].lastUpdateCheckForGDPR = personsObject[personId].interactions.filter((a: string) => a < endOfToday)[0];
  }

  return personsObject;
}

// Array version of items grouped by person
export function computeArrayOfItemsGroupedByPerson(state: Parameters<typeof computeItemsGroupedByPerson>[0]): any[] {
  return Object.values(computeItemsGroupedByPerson(state));
}

// Persons with medical file and consultations merged
export function computePersonsWithMedicalFileAndConsultationsMerged(state: Parameters<typeof computeItemsGroupedByPerson>[0]): any[] {
  const persons = computeArrayOfItemsGroupedByPerson(state);
  if (!state.user?.healthcareProfessional) return persons;
  return persons.map((person) => ({
    ...(person.medicalFile || {}),
    ...(person.flattenedConsultations || {}),
    ...person,
  }));
}

// Items grouped by action
export function computeItemsGroupedByAction(state: {
  actions: ActionInstance[];
  persons: PersonInstance[];
  comments: CommentInstance[];
  users: UserInstance[];
  places: PlaceInstance[];
  relsPersonPlace: RelPersonPlaceInstance[];
}): Record<string, any> {
  const usersObject = usersObjectSelector(state);
  const placesObject = placesObjectSelector(state);

  // Build persons with places
  const personsWithPlaces: Record<string, any> = {};
  for (const person of state.persons) {
    personsWithPlaces[person._id] = { ...person };
  }
  for (const rel of state.relsPersonPlace) {
    if (!personsWithPlaces[rel.person]) continue;
    const place = placesObject[rel.place];
    if (!place) continue;
    personsWithPlaces[rel.person].places = personsWithPlaces[rel.person].places || {};
    personsWithPlaces[rel.person].places[place._id] = place.name;
  }

  // Build actions with comments
  const actionsWithComments: Record<string, any> = {};
  for (const action of state.actions) {
    actionsWithComments[action._id] = { ...action, comments: [] };
  }
  for (const comment of state.comments) {
    if (!actionsWithComments[comment.action]) continue;
    actionsWithComments[comment.action].comments.push({ ...comment, date: comment.date || comment.createdAt });
  }

  const result: Record<string, any> = {};
  for (const actionId of Object.keys(actionsWithComments)) {
    const action = actionsWithComments[actionId];
    result[actionId] = {
      ...action,
      personPopulated: personsWithPlaces[action.person],
      userPopulated: action.user ? usersObject[action.user] : null,
    };
  }
  return result;
}

// Array of items grouped by action
export function computeArrayOfItemsGroupedByAction(state: Parameters<typeof computeItemsGroupedByAction>[0]): any[] {
  return Object.values(computeItemsGroupedByAction(state));
}

// Items grouped by consultation
export function computeItemsGroupedByConsultation(state: {
  consultations: ConsultationInstance[];
  persons: PersonInstance[];
  users: UserInstance[];
  places: PlaceInstance[];
  relsPersonPlace: RelPersonPlaceInstance[];
}): Record<string, any> {
  const usersObject = usersObjectSelector(state);
  const placesObject = placesObjectSelector(state);

  // Build persons with places
  const personsWithPlaces: Record<string, any> = {};
  for (const person of state.persons) {
    personsWithPlaces[person._id] = { ...person };
  }
  for (const rel of state.relsPersonPlace) {
    if (!personsWithPlaces[rel.person]) continue;
    const place = placesObject[rel.place];
    if (!place) continue;
    personsWithPlaces[rel.person].places = personsWithPlaces[rel.person].places || {};
    personsWithPlaces[rel.person].places[place._id] = place.name;
  }

  const result: Record<string, any> = {};
  for (const consultation of state.consultations) {
    result[consultation._id] = {
      ...consultation,
      personPopulated: personsWithPlaces[consultation.person],
      userPopulated: consultation.user ? usersObject[consultation.user] : null,
    };
  }
  return result;
}

// Array of items grouped by consultation
export function computeArrayOfItemsGroupedByConsultation(state: Parameters<typeof computeItemsGroupedByConsultation>[0]): any[] {
  return Object.values(computeItemsGroupedByConsultation(state));
}

// Items grouped by treatment
export function computeItemsGroupedByTreatment(state: {
  treatments: TreatmentInstance[];
  persons: PersonInstance[];
  users: UserInstance[];
  places: PlaceInstance[];
  relsPersonPlace: RelPersonPlaceInstance[];
}): Record<string, any> {
  const usersObject = usersObjectSelector(state);
  const placesObject = placesObjectSelector(state);

  // Build persons with places
  const personsWithPlaces: Record<string, any> = {};
  for (const person of state.persons) {
    personsWithPlaces[person._id] = { ...person };
  }
  for (const rel of state.relsPersonPlace) {
    if (!personsWithPlaces[rel.person]) continue;
    const place = placesObject[rel.place];
    if (!place) continue;
    personsWithPlaces[rel.person].places = personsWithPlaces[rel.person].places || {};
    personsWithPlaces[rel.person].places[place._id] = place.name;
  }

  const result: Record<string, any> = {};
  for (const treatment of state.treatments) {
    result[treatment._id] = {
      ...treatment,
      personPopulated: personsWithPlaces[treatment.person],
      userPopulated: treatment.user ? usersObject[treatment.user] : null,
    };
  }
  return result;
}

// Selector wrappers for compute functions
export const itemsGroupedByActionSelector = computeItemsGroupedByAction;
export const arrayOfitemsGroupedByActionSelector = computeArrayOfItemsGroupedByAction;
export const itemsGroupedByConsultationSelector = computeItemsGroupedByConsultation;
export const arrayOfitemsGroupedByConsultationSelector = computeArrayOfItemsGroupedByConsultation;
export const itemsGroupedByPersonSelector = computeItemsGroupedByPerson;
export const arrayOfItemsGroupedByPersonSelector = computeArrayOfItemsGroupedByPerson;
export const personsWithMedicalFileAndConsultationsMergedSelector = computePersonsWithMedicalFileAndConsultationsMerged;

// Populated passages
export function computePopulatedPassages(state: {
  passages: PassageInstance[];
  persons: PersonInstance[];
  groups: GroupInstance[];
  actions: ActionInstance[];
  consultations: ConsultationInstance[];
  treatments: TreatmentInstance[];
  medicalFiles: MedicalFileInstance[];
  reports: ReportInstance[];
  rencontres: RencontreInstance[];
  territories: TerritoryInstance[];
  territoryObservations: TerritoryObservationInstance[];
  places: PlaceInstance[];
  relsPersonPlace: RelPersonPlaceInstance[];
  comments: CommentInstance[];
  user: UserInstance | null;
  users: UserInstance[];
}): PopulatedPassage[] {
  const allPersonsAsObject = computeItemsGroupedByPerson(state);
  return state.passages
    .map((passage) => {
      if (passage.person && !allPersonsAsObject[passage.person]) return null;
      return {
        ...passage,
        type: passage.person ? ("Non-anonyme" as const) : ("Anonyme" as const),
        gender: !passage.person ? null : allPersonsAsObject[passage.person].gender || "Non renseigné",
      };
    })
    .filter((p): p is PopulatedPassage => p !== null);
}

// Aliases for backward compatibility
export const onlyFilledObservationsTerritories = onlyFilledObservationsTerritoriesSelector;
