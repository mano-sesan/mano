import { type NavigatorScreenParams } from "@react-navigation/native";
import { ActionInstance, ActionStatus } from "./action";
import { PersonInstance, PersonPopulated } from "./person";
import { ConsultationInstance } from "./consultation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TreatmentInstance } from "./treatment";
import { PassageInstance } from "./passage";
import { RencontreInstance } from "./rencontre";
import { PlaceInstance } from "./place";
import { TerritoryInstance } from "./territory";
import { TerritoryObservationInstance } from "./territoryObs";
import { ReportInstance } from "./report";
import { StructureInstance } from "./structure";

/*
https://reactnavigation.org/docs/typescript/
The type containing the mappings must be a type alias (e.g. type RootStackParamList = { ... }). It cannot be an interface (e.g. interface RootStackParamList { ... }). It also shouldn't extend ParamListBase (e.g. interface RootStackParamList extends ParamListBase { ... }). Doing so will result in incorrect type checking where it allows you to pass incorrect route names.
*/

export type RootStackParamList = {
  LOGIN_STACK: NavigatorScreenParams<LoginStackParamsList>;
  TABS_STACK: NavigatorScreenParams<TabsParamsList>;
  ACTION_STACK: ActionScreenParams;
  ACTION_NEW_STACK?: { person: PersonInstance };
  ACTIONS_FOR_REPORT: { date: string; status: ActionStatus };
  ACTIONS_FILTER: undefined;
  PERSON: { person: PersonInstance; editable?: boolean };
  PERSON_NEW: undefined;
  COMMENT: { person: PersonInstance; commentTitle: string };
  COMMENTS_FOR_REPORT: { date: string };
  PLACE: { place: PlaceInstance; personName: string };
  PLACE_NEW: { person: PersonPopulated };
  TREATMENT: { personDB: PersonInstance; treatmentDB?: TreatmentInstance; duplicate?: boolean; editable?: boolean };
  TERRITORY: { territory: TerritoryInstance; editable?: boolean };
  TERRITORY_NEW: undefined;
  TERRITORY_OBSERVATION: {
    territory: TerritoryInstance;
    obs?: TerritoryObservationInstance;
    editable?: boolean;
    rencontresInProgress?: Array<RencontreInstance>;
  };
  TERRITORY_OBSERVATIONS_FOR_REPORT: { date: string };
  RENCONTRE: { rencontre?: RencontreInstance; person: PersonInstance };
  RENCONTRES_FOR_REPORT: { date: string };
  PASSAGE?: { passage?: PassageInstance; person?: PersonInstance };
  PASSAGES_FOR_REPORT: { date: string };
  COMPTES_RENDUS: undefined;
  COMPTE_RENDU: { report?: ReportInstance; day: string; editable?: boolean };
  COLLABORATIONS: { report?: ReportInstance; day: string };
  CONSULTATIONS_FOR_REPORT: { date: string; status: ActionStatus };
  CONSULTATION?: { personDB?: PersonInstance; consultationDB?: ConsultationInstance; duplicate?: boolean; editable?: boolean };
  SERVICES: { date: string };
  STRUCTURES: undefined;
  STRUCTURE_NEW: undefined;
  STRUCTURE: { structure: StructureInstance; editable?: boolean };
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
  ACTION: NativeStackScreenProps<RootStackParamList, "ACTION_STACK">;
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

export type FoldersStackParams = {
  FOLDERS_SUMMARY: undefined;
  DOCUMENTS_MANO: undefined;
  GROUP: undefined;
  MEDICAL_FILE: undefined;
  [key: string]: undefined;
};
