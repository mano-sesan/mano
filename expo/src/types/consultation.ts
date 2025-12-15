import { UUIDV4 } from "./uuid";
import { Document, Folder } from "./document";
import { Dayjs } from "dayjs";

export type PossibleDate = string | Date | Dayjs | null;

export interface ConsultationInstance {
  _id: string;
  person: UUIDV4;
  organisation: UUIDV4;
  user: UUIDV4;
  teams: UUIDV4[];
  name: string;
  dosage: string;
  frequency: string;
  indication: string;
  documents: Array<Document | Folder>;
  comments: any[];
  history: any[];
  dueAt: PossibleDate;
  createdAt: PossibleDate;
  updatedAt: Date;
  [key: string]: any;
}
