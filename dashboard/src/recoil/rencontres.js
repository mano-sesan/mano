/**
 * Rencontre state and utilities
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import { capture } from "../services/sentry";
import { encryptItem } from "../services/encryption";

// State reference for backward compatibility
export const rencontresState = { key: "rencontre" };

const encryptedFields = ["person", "team", "user", "date", "comment", "observation"];

export const prepareRencontreForEncryption = (rencontre, { checkRequiredFields = true } = {}) => {
  if (checkRequiredFields) {
    try {
      if (!looseUuidRegex.test(rencontre.person)) {
        throw new Error("Rencontre is missing person");
      }
      if (!looseUuidRegex.test(rencontre.team)) {
        throw new Error("Rencontre is missing team");
      }
      if (!looseUuidRegex.test(rencontre.user)) {
        throw new Error("Rencontre is missing user");
      }
    } catch (error) {
      toast.error(
        "La rencontre n'a pas été sauvegardée car son format était incorrect. Vous pouvez vérifier son contenu et tenter de la sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
      );
      capture(error);
      throw error;
    }
  }
  const decrypted = {};
  for (let field of encryptedFields) {
    decrypted[field] = rencontre[field];
  }
  return {
    _id: rencontre._id,
    createdAt: rencontre.createdAt,
    updatedAt: rencontre.updatedAt,
    deletedAt: rencontre.deletedAt,
    organisation: rencontre.organisation,

    decrypted,
    entityKey: rencontre.entityKey,
  };
};

export async function encryptRencontre(rencontre, { checkRequiredFields = true } = {}) {
  return encryptItem(prepareRencontreForEncryption(rencontre, { checkRequiredFields }));
}
