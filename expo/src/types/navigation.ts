import { type NavigatorScreenParams } from "@react-navigation/native";
import { ActionInstance, ActionStatus } from "./action";
import { PersonInstance } from "./person";
import { ConsultationInstance } from "./consultation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

/*
https://reactnavigation.org/docs/typescript/
The type containing the mappings must be a type alias (e.g. type RootStackParamList = { ... }). It cannot be an interface (e.g. interface RootStackParamList { ... }). It also shouldn't extend ParamListBase (e.g. interface RootStackParamList extends ParamListBase { ... }). Doing so will result in incorrect type checking where it allows you to pass incorrect route names.
*/

export type RootStackParamList = {
  LOGIN_STACK: NavigatorScreenParams<LoginStackParamsList>;
  TABS_STACK: NavigatorScreenParams<TabsParamsList>;
  ACTION: ActionScreenParams;
  ACTION_NEW_STACK?: { person: PersonInstance };
  ACTIONS: undefined;
  ACTIONS_FILTER: undefined;
  PERSON: { person: PersonInstance; editable?: boolean };
  PERSON_NEW: undefined;
  COMMENT: { person: PersonInstance; commentTitle: string };
  COMMENTS: undefined;
  PLACE: undefined;
  PLACE_NEW: { person: PersonInstance };
  TREATMENT: undefined;
  TERRITORY: undefined;
  TERRITORY_NEW: undefined;
  TERRITORY_OBSERVATION: undefined;
  TERRITORY_OBSERVATIONS: undefined;
  TERRITORY_OBSERVATION_RENCONTRE: undefined;
  RENCONTRE: { person: PersonInstance };
  RENCONTRES: undefined;
  PASSAGE: { person: PersonInstance };
  PASSAGES: undefined;
  COMPTES_RENDUS: undefined;
  COMPTE_RENDU: undefined;
  COLLABORATIONS: undefined;
  CONSULTATIONS: undefined;
  CONSULTATION?: { personDB?: PersonInstance; consultationDB?: ConsultationInstance; duplicate?: boolean; editable?: boolean };
  SERVICES?: { date: string };
  STRUCTURES: undefined;
  STRUCTURE_NEW: undefined;
  STRUCTURE: undefined;
  SOLIGUIDE: undefined;
  CHANGE_PASSWORD: undefined;
  CHANGE_TEAM: undefined;
  LEGAL: undefined;
  PRIVACY: undefined;
  CGU: undefined;
  CHARTE: undefined;
};

export type TabsParamsList = {
  AGENDA: undefined;
  TERRITOIRES: undefined;
  PERSONNES: undefined;
  PRIORITÉS: undefined;
  MENU: undefined;
};

export type LoginStackParamsList = {
  LOGIN: undefined;
  TEAM_SELECTION: undefined;
  CHARTE_ACCEPTANCE: undefined;
  CGUS_ACCEPTANCE: undefined;
  FORCE_CHANGE_PASSWORD: undefined;
  FORGET_PASSWORD: undefined;
  ORGANISATION_DESACTIVEE: undefined;
};

interface ActionScreenParams {
  action?: ActionInstance;
  actions?: ActionInstance[];
  person?: PersonInstance;
  persons?: PersonInstance[];
  editable?: boolean;
  duplicate?: boolean;
}

export type ActionsScreenTopTabParams = {
  ["A FAIRE"]: ActionsScreenSubTabParams;
  ["FAIT"]: ActionListParams;
  ["ANNULEE"]: ActionListParams;
};

export type ActionsScreenSubTabParams = {
  PASSED: ActionListParams;
  TODAY: ActionListParams;
  INCOMINGDAYS: ActionListParams;
};

export type ActionListParams = {
  status: ActionStatus;
  timeframe: "TODAY" | "PASSED" | "INCOMINGDAYS";
};

export type ActionStackParams = {
  ACTION: NativeStackScreenProps<RootStackParamList, "ACTION">;
  PERSONS_SEARCH: undefined;
  PERSON_NEW: undefined;
};

export type ActionNewStackParams = {
  PERSONS_SEARCH: undefined;
  PERSON_NEW: undefined;
  ACTION_NEW?: { person: PersonInstance };
};

export type PersonStackParams = {
  PERSON: { person: PersonInstance };
  PERSON_OUT_OF_ACTIVE_LIST_REASON: { person: PersonInstance };
};

export type ConsultationStackParams = {
  CONSULTATION: NativeStackScreenProps<RootStackParamList, "CONSULTATION">;
  PERSONS_SEARCH: undefined;
  PERSON_NEW: undefined;
};
