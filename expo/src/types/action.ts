import { UUIDV4 } from "./uuid";
import { Document, Folder } from "./document";
import { Dayjs } from "dayjs";

export type ActionStatus = "A FAIRE" | "FAIT" | "ANNULEE";
export type PossibleDate = string | Date | Dayjs | null;

// TODO: séparer la notion de consultation chiffrée, préparée pour le chiffrement et non chiffrée
// + créer un type action ou consultation
// + c'est vraiment le bazar, une action ça peut être plein de choses selon le moment.
export interface ActionInstance {
  _id: string;
  status: ActionStatus;
  person?: UUIDV4;
  organisation: UUIDV4;
  user: UUIDV4;
  category?: string;
  categories: string[];
  team?: UUIDV4;
  teams: UUIDV4[];
  group?: UUIDV4 | boolean; // Trop bizarre, à revoir
  documents?: Array<Document | Folder>;
  comments?: any[];
  structure?: UUIDV4;
  name: string;
  description: string;
  withTime: boolean;
  urgent: boolean;
  history: any[];
  dueAt?: PossibleDate;
  entityKey?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  completedAt?: PossibleDate;
  isConsultation?: boolean;
  recurrence?: UUIDV4;
}
