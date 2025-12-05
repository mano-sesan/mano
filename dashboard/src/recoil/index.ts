/**
 * Legacy Recoil-compatible hooks that use Zustand under the hood.
 * Use these for backward compatibility during migration.
 * For new code, prefer importing directly from '../store'.
 */

import { useStore, getState, type ModalActionState, type ModalObservationState } from "../store";
import type { OrganisationInstance } from "../types/organisation";
import type { UserInstance } from "../types/user";
import type { TeamInstance } from "../types/team";
import type { PersonInstance } from "../types/person";
import type { ActionInstance } from "../types/action";
import type { ConsultationInstance } from "../types/consultation";
import type { TreatmentInstance } from "../types/treatment";
import type { MedicalFileInstance } from "../types/medicalFile";
import type { ReportInstance } from "../types/report";
import type { GroupInstance } from "../types/group";
import type { TerritoryInstance } from "../types/territory";
import type { TerritoryObservationInstance } from "../types/territoryObs";
import type { RencontreInstance } from "../types/rencontre";
import { type PassageInstance, type PlaceInstance, type RelPersonPlaceInstance, type CommentInstance, type RecurrenceInstance } from "../store";

// Re-export store hooks for direct usage
export { useStore, getState };

// Re-export modal defaults
export { defaultModalActionState, defaultModalObservationState } from "../store";

// === Auth hooks ===

export function useUser() {
  return useStore((s) => s.user);
}

export function useSetUser() {
  return useStore((s) => s.setUser);
}

export function useOrganisation() {
  return useStore((s) => s.organisation);
}

export function useSetOrganisation() {
  return useStore((s) => s.setOrganisation);
}

export function useTeams() {
  return useStore((s) => s.teams);
}

export function useSetTeams() {
  return useStore((s) => s.setTeams);
}

export function useUsers() {
  return useStore((s) => s.users);
}

export function useSetUsers() {
  return useStore((s) => s.setUsers);
}

export function useDeletedUsers() {
  return useStore((s) => s.deletedUsers);
}

export function useSetDeletedUsers() {
  return useStore((s) => s.setDeletedUsers);
}

export function useCurrentTeam() {
  return useStore((s) => s.currentTeam);
}

export function useSetCurrentTeam() {
  return useStore((s) => s.setCurrentTeam);
}

export function useSessionInitialDateTimestamp() {
  return useStore((s) => s.sessionInitialDateTimestamp);
}

export function useSetSessionInitialDateTimestamp() {
  return useStore((s) => s.setSessionInitialDateTimestamp);
}

export function useEncryptionKeyLength() {
  return useStore((s) => s.encryptionKeyLength);
}

export function useSetEncryptionKeyLength() {
  return useStore((s) => s.setEncryptionKeyLength);
}

// Authenticated getters (throw if not authenticated)
export function useUserAuthentified(): UserInstance {
  const user = useStore((s) => s.user);
  if (!user) throw new Error("User is not authenticated");
  return user;
}

export function useOrganisationAuthentified(): OrganisationInstance {
  const org = useStore((s) => s.organisation);
  if (!org) throw new Error("Organisation is not defined");
  return org;
}

export function useCurrentTeamAuthentified(): TeamInstance {
  const team = useStore((s) => s.currentTeam);
  if (!team) throw new Error("Current team is not defined");
  return team;
}

// === Data hooks ===

export function usePersons() {
  return useStore((s) => s.persons);
}

export function useSetPersons() {
  return useStore((s) => s.setPersons);
}

export function useGroups() {
  return useStore((s) => s.groups);
}

export function useSetGroups() {
  return useStore((s) => s.setGroups);
}

export function useActions() {
  return useStore((s) => s.actions);
}

export function useSetActions() {
  return useStore((s) => s.setActions);
}

export function useConsultations() {
  return useStore((s) => s.consultations);
}

export function useSetConsultations() {
  return useStore((s) => s.setConsultations);
}

export function useTreatments() {
  return useStore((s) => s.treatments);
}

export function useSetTreatments() {
  return useStore((s) => s.setTreatments);
}

export function useMedicalFiles() {
  return useStore((s) => s.medicalFiles);
}

export function useSetMedicalFiles() {
  return useStore((s) => s.setMedicalFiles);
}

export function useReports() {
  return useStore((s) => s.reports);
}

export function useSetReports() {
  return useStore((s) => s.setReports);
}

export function usePassages() {
  return useStore((s) => s.passages);
}

export function useSetPassages() {
  return useStore((s) => s.setPassages);
}

export function useRencontres() {
  return useStore((s) => s.rencontres);
}

export function useSetRencontres() {
  return useStore((s) => s.setRencontres);
}

export function useTerritories() {
  return useStore((s) => s.territories);
}

export function useSetTerritories() {
  return useStore((s) => s.setTerritories);
}

export function useTerritoryObservations() {
  return useStore((s) => s.territoryObservations);
}

export function useSetTerritoryObservations() {
  return useStore((s) => s.setTerritoryObservations);
}

export function usePlaces() {
  return useStore((s) => s.places);
}

export function useSetPlaces() {
  return useStore((s) => s.setPlaces);
}

export function useRelsPersonPlace() {
  return useStore((s) => s.relsPersonPlace);
}

export function useSetRelsPersonPlace() {
  return useStore((s) => s.setRelsPersonPlace);
}

export function useComments() {
  return useStore((s) => s.comments);
}

export function useSetComments() {
  return useStore((s) => s.setComments);
}

export function useRecurrences() {
  return useStore((s) => s.recurrences);
}

export function useSetRecurrences() {
  return useStore((s) => s.setRecurrences);
}

// === Loading hooks ===

export function useIsLoading() {
  return useStore((s) => s.isLoading);
}

export function useFullScreen() {
  return useStore((s) => s.fullScreen);
}

export function useProgress() {
  return useStore((s) => s.progress);
}

export function useTotal() {
  return useStore((s) => s.total);
}

export function useLoadingText() {
  return useStore((s) => s.loadingText);
}

export function useInitialLoadIsDone() {
  return useStore((s) => s.initialLoadIsDone);
}

// === Version hooks ===

export function useDeploymentDate() {
  return useStore((s) => s.deploymentDate);
}

export function useSetDeploymentDate() {
  return useStore((s) => s.setDeploymentDate);
}

export function useDeploymentCommit() {
  return useStore((s) => s.deploymentCommit);
}

export function useSetDeploymentCommit() {
  return useStore((s) => s.setDeploymentCommit);
}

// === Modal hooks ===

export function useModalAction() {
  return useStore((s) => s.modalAction);
}

export function useSetModalAction() {
  return useStore((s) => s.setModalAction);
}

export function useModalObservation() {
  return useStore((s) => s.modalObservation);
}

export function useSetModalObservation() {
  return useStore((s) => s.setModalObservation);
}

// === Type exports ===
export type {
  OrganisationInstance,
  UserInstance,
  TeamInstance,
  PersonInstance,
  ActionInstance,
  ConsultationInstance,
  TreatmentInstance,
  MedicalFileInstance,
  ReportInstance,
  GroupInstance,
  TerritoryInstance,
  TerritoryObservationInstance,
  RencontreInstance,
  PassageInstance,
  PlaceInstance,
  RelPersonPlaceInstance,
  CommentInstance,
  RecurrenceInstance,
  ModalActionState,
  ModalObservationState,
};
