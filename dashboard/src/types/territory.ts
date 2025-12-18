// types/user.ts
import { UUIDV4 } from "./uuid";

type TerritoryType =
  | "Lieu de conso"
  | "Lieu de deal"
  | "Carrefour de passage"
  | "Campement"
  | "Lieu de vie"
  | "Prostitution"
  | "Errance"
  | "Mendicité"
  | "Loisir"
  | "Rassemblement communautaire"
  | "Historique";

export type TerritoryInstance = {
  _id: UUIDV4;
  organisation: UUIDV4;

  entityKey: string;
  createdAt: string; // ISO date
  deletedAt?: string; // ISO date
  updatedAt: string; // ISO date

  name: string;
  perimeter: string;
  description?: string;
  types: Array<TerritoryType>;
  user: UUIDV4;
};

export type ReadyToEncryptTerritoryInstance = {
  _id: UUIDV4;
  organisation: UUIDV4;

  entityKey: string;
  createdAt: string; // ISO date
  deletedAt?: string; // ISO date
  updatedAt: string; // ISO date

  // Phase 1 (links migration): dual-write links outside encrypted blob.
  // Optional for retro-compat / older cached items.
  user?: UUIDV4;

  decrypted: {
    name?: string;
    perimeter?: string;
    description?: string;
    types?: Array<TerritoryType>;
    user?: UUIDV4;
  };
};
