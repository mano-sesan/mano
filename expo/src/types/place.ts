import { UUIDV4 } from "./uuid";

export interface PlaceInstance {
  _id: UUIDV4;
  organisation?: UUIDV4;
  entityKey?: string;
  createdAt?: string | Date;
  deletedAt?: string | Date;
  updatedAt?: string | Date;

  user: UUIDV4;

  name?: string;
}

export interface ReadyToEncryptPlaceInstance {
  _id?: string;
  organisation?: UUIDV4;
  entityKey?: string;
  createdAt?: string | Date;
  deletedAt?: string | Date;
  updatedAt?: string | Date;

  decrypted: {
    person: UUIDV4;
    user: UUIDV4;
    team: UUIDV4;
    comment?: string;
  };
}

export interface RelPersonPlaceInstance {
  _id?: string;
  organisation?: UUIDV4;
  entityKey?: string;
  createdAt?: string | Date;
  deletedAt?: string | Date;
  updatedAt?: string | Date;

  place: UUIDV4;
  person: UUIDV4;
  user: UUIDV4;
}
