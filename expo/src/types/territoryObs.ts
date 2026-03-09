import { UUIDV4 } from "./uuid";
import { Document, Folder } from "./document";

export interface TerritoryObservationInstance {
  _id: UUIDV4;
  organisation?: UUIDV4;
  entityKey?: string;
  createdAt?: string | Date;
  deletedAt?: string | Date;
  updatedAt?: string | Date;

  territory?: UUIDV4;
  user: UUIDV4;
  team: UUIDV4;
  observedAt: Date;
  documents?: Array<Document | Folder>;

  [key: string]: any; // custom fields
}

export interface ReadyToEncryptTerritoryObservationInstance {
  _id: string;
  organisation: UUIDV4;
  entityKey: string;
  createdAt?: string | Date;
  deletedAt?: string | Date;
  updatedAt?: string | Date;

  decrypted: {
    territory?: UUIDV4;
    user?: UUIDV4;
    team?: UUIDV4;
    observedAt?: Date;
    [key: string]: any; // custom fields
  };
}
