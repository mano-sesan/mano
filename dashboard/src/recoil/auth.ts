import { atom, selector } from "recoil";
import { AppSentry } from "../services/sentry";
import type { OrganisationInstance } from "../types/organisation";
import type { UserInstance } from "../types/user";
import type { TeamInstance } from "../types/team";
import dayjs from "dayjs";

export const userState = atom<UserInstance | null>({
  key: "userState",
  default: null,
  effects: [
    ({ onSet }) =>
      onSet((user) =>
        AppSentry.setUser({
          id: user?._id,
          email: user?.email,
          organisation: user?.organisation,
        })
      ),
  ],
});

export const userAuthentifiedState = selector<UserInstance>({
  key: "userAuthentifiedState",
  get: ({ get }) => {
    const user = get(userState);
    if (!user) throw new Error("User is not authenticated");
    return user;
  },
});

export const organisationState = atom<OrganisationInstance | null>({
  key: "organisationState",
  default: null,
  effects: [
    ({ onSet }) =>
      onSet((organisation) => {
        AppSentry.setTag("organisationId", organisation?._id ?? "unauthenticated");
      }),
  ],
});

export const organisationAuthentifiedState = selector<OrganisationInstance>({
  key: "organisationAuthentifiedState",
  get: ({ get }) => {
    const organisation = get(organisationState);
    if (!organisation) throw new Error("organisation is not defined");
    return organisation;
  },
});

export const teamsState = atom<TeamInstance[]>({
  key: "teamsState",
  default: [],
});

export const usersState = atom<UserInstance[]>({
  key: "usersState",
  default: [],
});

export const currentTeamState = atom<TeamInstance | null>({
  key: "currentTeamState",
  default: null,
  effects: [({ onSet }) => onSet((currentTeam) => AppSentry.setTag("currentTeam", currentTeam?._id ?? ""))],
});

export const currentTeamAuthentifiedState = selector<TeamInstance>({
  key: "currentTeamAuthentifiedState",
  get: ({ get }) => {
    const currentTeam = get(currentTeamState);
    if (!currentTeam) throw new Error("currentTeam is not defined");
    return currentTeam;
  },
});

export const sessionInitialDateTimestamp = atom({
  key: "sessionInitialDateTimestamp",
  default: null,
});

export const encryptionKeyLengthState = atom({
  key: "encryptionKeyLengthState",
  default: null,
});

export const deletedUsersState = atom<UserInstance[]>({
  key: "deletedUsersState",
  default: [],
});

export const MINIMUM_ENCRYPTION_KEY_LENGTH = 8;
