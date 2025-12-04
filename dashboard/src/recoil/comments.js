import { atom } from "recoil";
import { looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import { capture } from "../services/sentry";
import { encryptItem } from "../services/encryption";

const collectionName = "comment";
export const commentsState = atom({
  key: collectionName,
  default: [],
});

const encryptedFields = ["comment", "person", "action", "group", "team", "user", "date", "urgent"];

export const prepareCommentForEncryption = (comment, { checkRequiredFields = true } = {}) => {
  if (checkRequiredFields) {
    try {
      if (!looseUuidRegex.test(comment.person) && !looseUuidRegex.test(comment.action)) {
        throw new Error("Comment is missing person or action");
      }
      if (!looseUuidRegex.test(comment.team)) {
        throw new Error("Comment is missing team");
      }
      if (!looseUuidRegex.test(comment.user)) {
        throw new Error("Comment is missing user");
      }
    } catch (error) {
      toast.error(
        "Le commentaire n'a pas été sauvegardé car son format était incorrect. Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
      );
      capture(error);
      throw error;
    }
  }
  const decrypted = {};
  for (let field of encryptedFields) {
    decrypted[field] = comment[field];
  }
  return {
    _id: comment._id,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    deletedAt: comment.deletedAt,
    organisation: comment.organisation,

    decrypted,
    entityKey: comment.entityKey,
  };
};

export async function encryptComment(comment, { checkRequiredFields = true } = {}) {
  return encryptItem(prepareCommentForEncryption(comment, { checkRequiredFields }));
}

export const sortComments = (sortBy, sortOrder) => (a, b) => {
  if (sortBy === "urgentOrGroup") {
    if (sortOrder === "ASC") {
      if (a.urgent && !b.urgent) return -1;
      if (!a.urgent && b.urgent) return 1;
      if (a.group && !b.group) return -1;
      if (!a.group && b.group) return 1;
    } else {
      if (a.urgent && !b.urgent) return 1;
      if (!a.urgent && b.urgent) return -1;
      if (a.group && !b.group) return 1;
      if (!a.group && b.group) return -1;
    }
  }
  if (sortBy === "comment") {
    return sortOrder === "ASC" ? (a.comment || "").localeCompare(b.comment || "") : (b.comment || "").localeCompare(a.comment || "");
  }
  if (sortBy === "type") {
    return sortOrder === "ASC" ? (a.type || "").localeCompare(b.type || "") : (b.type || "").localeCompare(a.type || "");
  }
  // sortBy is always `date` for now
  return sortOrder === "ASC" ? new Date(b.date).getTime() - new Date(a.date).getTime() : new Date(a.date).getTime() - new Date(b.date).getTime();
};
