/**
 * Passage state and utilities
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import { capture } from "../services/sentry";
import { encryptItem } from "../services/encryption";

// State reference for backward compatibility
export const passagesState = { key: "passage" };

const encryptedFields = ["person", "team", "user", "date", "comment"];

export const preparePassageForEncryption = (passage, { checkRequiredFields = true } = {}) => {
  if (checkRequiredFields) {
    try {
      if (!looseUuidRegex.test(passage.team)) {
        throw new Error("Passage is missing team");
      }
      if (!looseUuidRegex.test(passage.user)) {
        throw new Error("Passage is missing user");
      }
    } catch (error) {
      toast.error(
        "Le passage n'a pas été sauvegardé car son format était incorrect. Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
      );
      capture(error);
      throw error;
    }
  }
  const decrypted = {};
  for (let field of encryptedFields) {
    decrypted[field] = passage[field];
  }
  return {
    _id: passage._id,
    createdAt: passage.createdAt,
    updatedAt: passage.updatedAt,
    deletedAt: passage.deletedAt,
    organisation: passage.organisation,

    decrypted,
    entityKey: passage.entityKey,
  };
};

export async function encryptPassage(passage, { checkRequiredFields = true } = {}) {
  return encryptItem(preparePassageForEncryption(passage, { checkRequiredFields }));
}
