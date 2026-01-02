// types/user.ts
import { UUIDV4 } from "./uuid";

export type ServiceInstance = {
  _id: UUIDV4;
  organisation: UUIDV4;

  createdAt: string; // ISO date
  deletedAt?: string; // ISO date
  updatedAt: string; // ISO date

  team: UUIDV4;
  date: string; // YYYY-MM-DD
  service: string;
  count: number;
};
