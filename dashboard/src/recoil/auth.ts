/**
 * Auth state
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { useStore, getState } from "../store";
import { AppSentry } from "../services/sentry";
import type { OrganisationInstance } from "../types/organisation";
import type { UserInstance } from "../types/user";
import type { TeamInstance } from "../types/team";

// Type exports
export type { OrganisationInstance, UserInstance, TeamInstance };

// State references for backward compatibility with old imports
// Components should use these with useStore() selector pattern
export const userState = { key: "userState" };
export const organisationState = { key: "organisationState" };
export const teamsState = { key: "teamsState" };
export const usersState = { key: "usersState" };
export const currentTeamState = { key: "currentTeamState" };
export const sessionInitialDateTimestamp = { key: "sessionInitialDateTimestamp" };
export const encryptionKeyLengthState = { key: "encryptionKeyLengthState" };
export const deletedUsersState = { key: "deletedUsersState" };

// Selector references
export const userAuthentifiedState = { key: "userAuthentifiedState" };
export const organisationAuthentifiedState = { key: "organisationAuthentifiedState" };
export const currentTeamAuthentifiedState = { key: "currentTeamAuthentifiedState" };

export const MINIMUM_ENCRYPTION_KEY_LENGTH = 8;

// Selectors as functions (use with useStore)
export const userSelector = (state: { user: UserInstance | null }) => state.user;
export const organisationSelector = (state: { organisation: OrganisationInstance | null }) => state.organisation;
export const teamsSelector = (state: { teams: TeamInstance[] }) => state.teams;
export const usersSelector = (state: { users: UserInstance[] }) => state.users;
export const deletedUsersSelector = (state: { deletedUsers: UserInstance[] }) => state.deletedUsers;
export const currentTeamSelector = (state: { currentTeam: TeamInstance | null }) => state.currentTeam;
export const sessionInitialDateTimestampSelector = (state: { sessionInitialDateTimestamp: number | null }) => state.sessionInitialDateTimestamp;
export const encryptionKeyLengthSelector = (state: { encryptionKeyLength: number | null }) => state.encryptionKeyLength;

// Authenticated selectors (throw if not authenticated)
export const userAuthentifiedSelector = (state: { user: UserInstance | null }): UserInstance => {
  if (!state.user) throw new Error("User is not authenticated");
  return state.user;
};

export const organisationAuthentifiedSelector = (state: { organisation: OrganisationInstance | null }): OrganisationInstance => {
  if (!state.organisation) throw new Error("Organisation is not defined");
  return state.organisation;
};

export const currentTeamAuthentifiedSelector = (state: { currentTeam: TeamInstance | null }): TeamInstance => {
  if (!state.currentTeam) throw new Error("Current team is not defined");
  return state.currentTeam;
};
