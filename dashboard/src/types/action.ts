import { UUIDV4 } from "./uuid";
import { Document, Folder } from "./document";

export type ActionStatus = "A FAIRE" | "FAIT" | "ANNULEE";

// TODO: séparer la notion de consultation chiffrée, préparée pour le chiffrement et non chiffrée
// + créer un type action ou consultation
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
  group?: UUIDV4;
  documents?: Array<Document | Folder>;
  structure?: UUIDV4;
  name: string;
  description: string;
  withTime: boolean;
  urgent: boolean;
  history: any[];
  dueAt?: Date;
  entityKey?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  completedAt: Date | undefined;
  isConsultation?: boolean;
}
