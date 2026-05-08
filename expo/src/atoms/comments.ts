import { atom } from "jotai";
import { looseUuidRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { CommentInstance } from "@/types/comment";

export const commentsState = atom<CommentInstance[]>([]);

const encryptedFields = ["comment", "person", "group", "action", "team", "user", "date", "urgent"];

export const allowedCommentFieldsInHistory = [
  { name: "comment", label: "Commentaire", type: "textarea" },
  { name: "person", label: "Personne" },
  { name: "group", label: "Famille" },
  { name: "action", label: "Action" },
  { name: "team", label: "Équipe" },
  { name: "user", label: "Auteur" },
  { name: "date", label: "Date", type: "date-with-time" },
  { name: "urgent", label: "Urgent", type: "boolean" },
];

export const prepareCommentForEncryption = (comment: Partial<CommentInstance>) => {
  try {
    if (!looseUuidRegex.test(comment.person!) && !looseUuidRegex.test(comment.action!)) {
      throw new Error("Comment is missing person or action");
    }
    if (!looseUuidRegex.test(comment.team!)) {
      throw new Error("Comment is missing team");
    }
    if (!looseUuidRegex.test(comment.user!)) {
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
