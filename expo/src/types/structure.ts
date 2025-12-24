import { UUIDV4 } from "./uuid";

export type StructureInstance = {
  _id: UUIDV4;
  organisation: UUIDV4;
  name: string;
  adresse: string;
  postcode: string;
  city: string;
  phone: string;
  description?: string;
  categories?: string[];
};
