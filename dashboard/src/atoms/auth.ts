import { atom, type WritableAtom, type SetStateAction } from "jotai";
import { AppSentry } from "../services/sentry";
import type { OrganisationInstance } from "../types/organisation";
import type { UserInstance } from "../types/user";
import type { TeamInstance } from "../types/team";

// User state with Sentry side effect
const userBaseAtom = atom<UserInstance | null>(null);
export const userState: WritableAtom<UserInstance | null, [SetStateAction<UserInstance | null>], void> = atom(
  (get) => get(userBaseAtom),
  (get, set, update: SetStateAction<UserInstance | null>) => {
    const user = typeof update === "function" ? (update as (prev: UserInstance | null) => UserInstance | null)(get(userBaseAtom)) : update;
    set(userBaseAtom as any, user);
    AppSentry.setUser({
      id: user?._id,
      email: user?.email,
      organisation: user?.organisation,
    });
  }
);

// Derived atom that throws if user is not authenticated
export const userAuthentifiedState = atom((get) => {
  const user = get(userState);
  if (!user) throw new Error("User is not authenticated");
  return user;
});

// Organisation state with Sentry side effect
const organisationBaseAtom = atom<OrganisationInstance | null>(null);
export const organisationState: WritableAtom<OrganisationInstance | null, [SetStateAction<OrganisationInstance | null>], void> = atom(
  (get) => get(organisationBaseAtom),
  (get, set, update: SetStateAction<OrganisationInstance | null>) => {
    const organisation =
      typeof update === "function"
        ? (update as (prev: OrganisationInstance | null) => OrganisationInstance | null)(get(organisationBaseAtom))
        : update;
    set(organisationBaseAtom as any, organisation);
    AppSentry.setTag("organisationId", organisation?._id ?? "unauthenticated");
  }
);

// Derived atom that throws if organisation is not defined
export const organisationAuthentifiedState = atom((get) => {
  const organisation = get(organisationState);
  if (!organisation) throw new Error("organisation is not defined");
  return organisation;
});

// Teams state: always sorted alphabetically
const teamsBaseAtom = atom<TeamInstance[]>([]);
export const teamsState: WritableAtom<TeamInstance[], [SetStateAction<TeamInstance[]>], void> = atom(
  (get) => [...get(teamsBaseAtom)].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
  (get, set, update: SetStateAction<TeamInstance[]>) => {
    const teams = typeof update === "function" ? (update as (prev: TeamInstance[]) => TeamInstance[])(get(teamsBaseAtom)) : update;
    set(teamsBaseAtom as any, teams);
  }
);
export const usersState = atom<UserInstance[]>([]);

// Current team state with Sentry side effect
const currentTeamBaseAtom = atom<TeamInstance | null>(null);
export const currentTeamState: WritableAtom<TeamInstance | null, [SetStateAction<TeamInstance | null>], void> = atom(
  (get) => get(currentTeamBaseAtom),
  (get, set, update: SetStateAction<TeamInstance | null>) => {
    const currentTeam =
      typeof update === "function" ? (update as (prev: TeamInstance | null) => TeamInstance | null)(get(currentTeamBaseAtom)) : update;
    set(currentTeamBaseAtom as any, currentTeam);
    AppSentry.setTag("currentTeam", currentTeam?._id ?? "");
  }
);

// Derived atom that throws if currentTeam is not defined
export const currentTeamAuthentifiedState = atom((get) => {
  const currentTeam = get(currentTeamState);
  if (!currentTeam) throw new Error("currentTeam is not defined");
  return currentTeam;
});

export const sessionInitialDateTimestamp = atom<number | null>(null);
export const encryptionKeyLengthState = atom<number | null>(null);
export const deletedUsersState = atom<UserInstance[]>([]);

export const MINIMUM_ENCRYPTION_KEY_LENGTH = 8;
