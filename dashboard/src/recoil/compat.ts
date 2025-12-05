/**
 * Recoil compatibility layer for gradual migration to Zustand.
 *
 * This file provides hooks that mimic Recoil's API but use Zustand internally.
 * Components can import from here during the migration period.
 *
 * Usage: Replace `import { useRecoilValue, useSetRecoilState, useRecoilState } from 'recoil'`
 * with `import { useRecoilValue, useSetRecoilState, useRecoilState } from '../recoil/compat'`
 */

import { useStore, getState, type ModalActionState, type ModalObservationState } from "../store";
import type { OrganisationInstance } from "../types/organisation";
import type { UserInstance } from "../types/user";
import type { TeamInstance } from "../types/team";
import type { PersonInstance } from "../types/person";
import type { ActionInstance } from "../types/action";
import type { ConsultationInstance } from "../types/consultation";
import type { ReportInstance } from "../types/report";
import type { GroupInstance } from "../types/group";
import type { TerritoryInstance } from "../types/territory";
import type { TerritoryObservationInstance } from "../types/territoryObs";
import type { RencontreInstance } from "../types/rencontre";
import type { TreatmentInstance } from "../types/treatment";
import type { MedicalFileInstance } from "../types/medicalFile";
import type { CustomField, CustomFieldsGroup, CustomOrPredefinedField } from "../types/field";
import {
  computeItemsGroupedByPerson,
  computeArrayOfItemsGroupedByPerson,
  computePersonsWithMedicalFileAndConsultationsMerged,
  computeItemsGroupedByAction,
  computeArrayOfItemsGroupedByAction,
  computeItemsGroupedByConsultation,
  computeArrayOfItemsGroupedByConsultation,
  computeItemsGroupedByTreatment,
  computePopulatedPassages,
  usersObjectSelector,
  customFieldsObsSelector,
  groupedCustomFieldsObsSelector,
  personFieldsIncludingCustomFieldsSelector,
  evolutiveStatsIndicatorsBaseSelector,
  currentTeamReportsSelector,
} from "../store/selectors";

// State key type
type StateKey = { key: string };

// Map of state keys to store selectors
const stateKeyToSelector: Record<string, (state: any) => any> = {
  // Auth state
  userState: (s) => s.user,
  organisationState: (s) => s.organisation,
  teamsState: (s) => s.teams,
  usersState: (s) => s.users,
  deletedUsersState: (s) => s.deletedUsers,
  currentTeamState: (s) => s.currentTeam,
  sessionInitialDateTimestamp: (s) => s.sessionInitialDateTimestamp,
  encryptionKeyLengthState: (s) => s.encryptionKeyLength,

  // Data state
  person: (s) => s.persons,
  group: (s) => s.groups,
  action: (s) => s.actions,
  consultation: (s) => s.consultations,
  treatment: (s) => s.treatments,
  "medical-file": (s) => s.medicalFiles,
  report: (s) => s.reports,
  passage: (s) => s.passages,
  rencontre: (s) => s.rencontres,
  territory: (s) => s.territories,
  "territory-observation": (s) => s.territoryObservations,
  place: (s) => s.places,
  relPersonPlace: (s) => s.relsPersonPlace,
  comment: (s) => s.comments,
  recurrence: (s) => s.recurrences,

  // Loading state
  isLoadingState: (s) => s.isLoading,
  fullScreenState: (s) => s.fullScreen,
  progressState: (s) => s.progress,
  totalState: (s) => s.total,
  totalLoadingDurationState: (s) => s.totalLoadingDuration,
  loadingTextState: (s) => s.loadingText,
  initialLoadIsDoneState: (s) => s.initialLoadIsDone,

  // Version state
  deploymentDateState: (s) => s.deploymentDate,
  deploymentCommitState: (s) => s.deploymentCommit,
  shortCommitSHAState: (s) => (s.deploymentCommit || "-").substring(0, 7),
  showOutdateAlertBannerState: (s) => {
    if (!s.deploymentCommit || !s.deploymentDate) return false;
    const { dayjsInstance } = require("../services/date");
    return (
      dayjsInstance(s.deploymentDate).isAfter(dayjsInstance(window.localStorage.getItem("deploymentDate"))) &&
      s.deploymentCommit !== window.localStorage.getItem("deploymentCommit")
    );
  },

  // Modal state
  modalAction: (s) => s.modalAction,
  modalObservation: (s) => s.modalObservation,

  // UI state
  showDrawerState: (s) => s.showDrawer,

  // Authenticated selectors
  userAuthentifiedState: (s) => {
    if (!s.user) throw new Error("User is not authenticated");
    return s.user;
  },
  organisationAuthentifiedState: (s) => {
    if (!s.organisation) throw new Error("Organisation is not defined");
    return s.organisation;
  },
  currentTeamAuthentifiedState: (s) => {
    if (!s.currentTeam) throw new Error("Current team is not defined");
    return s.currentTeam;
  },

  // Complex selectors
  currentTeamReportsSelector: currentTeamReportsSelector,
  usersObjectSelector: usersObjectSelector,
  itemsGroupedByPersonSelector: computeItemsGroupedByPerson,
  arrayOfitemsGroupedByPersonSelector: computeArrayOfItemsGroupedByPerson,
  personsWithMedicalFileAndConsultationsMergedSelector: computePersonsWithMedicalFileAndConsultationsMerged,
  itemsGroupedByActionSelector: computeItemsGroupedByAction,
  arrayOfitemsGroupedByActionSelector: computeArrayOfItemsGroupedByAction,
  itemsGroupedByConsultationSelector: computeItemsGroupedByConsultation,
  arrayOfitemsGroupedByConsultationSelector: computeArrayOfItemsGroupedByConsultation,
  itemsGroupedByTreatmentSelector: computeItemsGroupedByTreatment,
  populatedPassagesSelector: computePopulatedPassages,
  customFieldsObsSelector: customFieldsObsSelector,
  groupedCustomFieldsObsSelector: groupedCustomFieldsObsSelector,
  personFieldsIncludingCustomFieldsSelector: personFieldsIncludingCustomFieldsSelector,
  evolutiveStatsIndicatorsBaseSelector: evolutiveStatsIndicatorsBaseSelector,
};

// Map of state keys to store setters
const stateKeyToSetter: Record<string, string> = {
  // Auth state
  userState: "setUser",
  organisationState: "setOrganisation",
  teamsState: "setTeams",
  usersState: "setUsers",
  deletedUsersState: "setDeletedUsers",
  currentTeamState: "setCurrentTeam",
  sessionInitialDateTimestamp: "setSessionInitialDateTimestamp",
  encryptionKeyLengthState: "setEncryptionKeyLength",

  // Data state
  person: "setPersons",
  group: "setGroups",
  action: "setActions",
  consultation: "setConsultations",
  treatment: "setTreatments",
  "medical-file": "setMedicalFiles",
  report: "setReports",
  passage: "setPassages",
  rencontre: "setRencontres",
  territory: "setTerritories",
  "territory-observation": "setTerritoryObservations",
  place: "setPlaces",
  relPersonPlace: "setRelsPersonPlace",
  comment: "setComments",
  recurrence: "setRecurrences",

  // Loading state
  isLoadingState: "setIsLoading",
  fullScreenState: "setFullScreen",
  progressState: "setProgress",
  totalState: "setTotal",
  totalLoadingDurationState: "setTotalLoadingDuration",
  loadingTextState: "setLoadingText",
  initialLoadIsDoneState: "setInitialLoadIsDone",

  // Version state
  deploymentDateState: "setDeploymentDate",
  deploymentCommitState: "setDeploymentCommit",

  // Modal state
  modalAction: "setModalAction",
  modalObservation: "setModalObservation",

  // UI state
  showDrawerState: "setShowDrawer",
};

/**
 * Compatibility hook that mimics useRecoilValue
 */
export function useRecoilValue<T>(state: StateKey | ((s: any) => T)): T {
  // If it's a function (selector), use it directly
  if (typeof state === "function") {
    return useStore(state as (s: any) => T);
  }

  // Otherwise look up by key
  const selector = stateKeyToSelector[state.key];
  if (!selector) {
    console.warn(`No selector found for state key: ${state.key}`);
    return undefined as T;
  }
  return useStore(selector);
}

/**
 * Compatibility hook that mimics useSetRecoilState
 */
export function useSetRecoilState<T>(state: StateKey): (value: T | ((prev: T) => T)) => void {
  const setterName = stateKeyToSetter[state.key];
  if (!setterName) {
    console.warn(`No setter found for state key: ${state.key}`);
    return () => {};
  }
  return useStore((s) => (s as any)[setterName]);
}

/**
 * Compatibility hook that mimics useRecoilState
 */
export function useRecoilState<T>(state: StateKey): [T, (value: T | ((prev: T) => T)) => void] {
  const value = useRecoilValue<T>(state);
  const setter = useSetRecoilState<T>(state);
  return [value, setter];
}

// Re-export store for direct access
export { useStore, getState };

// Re-export types
export type {
  OrganisationInstance,
  UserInstance,
  TeamInstance,
  PersonInstance,
  ActionInstance,
  ConsultationInstance,
  ReportInstance,
  GroupInstance,
  TerritoryInstance,
  TerritoryObservationInstance,
  RencontreInstance,
  TreatmentInstance,
  MedicalFileInstance,
  ModalActionState,
  ModalObservationState,
  CustomField,
  CustomFieldsGroup,
  CustomOrPredefinedField,
};
