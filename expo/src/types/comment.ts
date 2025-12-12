import { UUIDV4 } from "./uuid";

export interface CommentInstance {
  _id: string;
  comment: string;
  urgent: boolean;
  group: boolean;
  date: Date;
  person: UUIDV4;
  action: UUIDV4;
  team: UUIDV4;
  user: UUIDV4;
  organisation: UUIDV4;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  entityKey?: string;
}
