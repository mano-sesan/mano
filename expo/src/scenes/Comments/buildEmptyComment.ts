import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { CommentInstance } from "@/types/comment";
import { UUIDV4 } from "@/types/uuid";

type BuildEmptyCommentArgs = {
  team: UUIDV4;
  user: UUIDV4;
  organisation: UUIDV4;
  type?: string;
};

export const buildEmptyComment = ({ team, user, organisation, type }: BuildEmptyCommentArgs): CommentInstance => ({
  _id: uuidv4(),
  comment: "",
  date: dayjs(),
  urgent: false,
  group: false,
  share: false,
  team,
  user,
  organisation,
  type,
});
