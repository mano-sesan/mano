import { atomWithCache } from "@/store";
import { looseUuidRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { CommentInstance } from "@/types/comment";

export const commentsState = atomWithCache<CommentInstance[]>("comment", []);

const encryptedFields = ["comment", "person", "group", "action", "team", "user", "date", "urgent"];

export const prepareCommentForEncryption = (comment: CommentInstance) => {
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
    Alert.alert(
      "Le commentaire n'a pas été sauvegardé car son format était incorrect.",
      "Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
    );
    capture(error);
    throw error;
  }
  const decrypted: Record<string, any> = {};
  for (let field of encryptedFields) {
    decrypted[field] = comment[field as keyof CommentInstance];
  }
  return {
    _id: comment._id,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    organisation: comment.organisation,

    decrypted,
    entityKey: comment.entityKey,
  };
};
