import { atom, type WritableAtom, type SetStateAction } from "jotai";
import { OrganisationInstance } from "@/types/organisation";
import { TeamInstance } from "@/types/team";
import { UserInstance, UserResponseData } from "@/types/user";
import * as Sentry from "@sentry/react-native";

// User state with Sentry side effect
const userBaseAtom = atom<UserResponseData | null>(null);
export const userState: WritableAtom<UserResponseData | null, [SetStateAction<UserResponseData | null>], void> = atom(
  (get) => get(userBaseAtom),
  (get, set, update: SetStateAction<UserResponseData | null>) => {
    const user = typeof update === "function" ? (update as (prev: UserResponseData | null) => UserResponseData | null)(get(userBaseAtom)) : update;
    set(userBaseAtom as any, user);
    Sentry.setUser({
      id: user?._id,
      email: user?.email,
      organisation: user?.organisation,
    });
  }
);

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
    Sentry.setTag("organisationId", organisation?._id ?? "unauthenticated");
  }
);

export const teamsState = atom<TeamInstance[]>([]);
export const usersState = atom<UserInstance[]>([]);

const currentTeamBaseAtom = atom<TeamInstance | null>(null);
export const currentTeamState: WritableAtom<TeamInstance | null, [SetStateAction<TeamInstance | null>], void> = atom(
  (get) => get(currentTeamBaseAtom),
  (get, set, update: SetStateAction<TeamInstance | null>) => {
    const currentTeam =
      typeof update === "function" ? (update as (prev: TeamInstance | null) => TeamInstance | null)(get(currentTeamBaseAtom)) : update;
    set(currentTeamBaseAtom as any, currentTeam);
    Sentry.setTag("currentTeam", currentTeam?._id ?? "");
  }
);

export const deletedUsersState = atom<UserInstance[]>([]);
