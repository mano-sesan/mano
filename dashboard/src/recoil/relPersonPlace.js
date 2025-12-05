/**
 * RelPersonPlace state and utilities
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import { capture } from "../services/sentry";
import { encryptItem } from "../services/encryption";

// State reference for backward compatibility
export const relsPersonPlaceState = { key: "relPersonPlace" };

const encryptedFields = ["person", "place", "user"];

export const prepareRelPersonPlaceForEncryption = (relPersonPlace, { checkRequiredFields = true } = {}) => {
  if (checkRequiredFields) {
    try {
      if (!looseUuidRegex.test(relPersonPlace.person)) {
        throw new Error("RelPersonPlace is missing person");
      }
      if (!looseUuidRegex.test(relPersonPlace.place)) {
        throw new Error("RelPersonPlace is missing place");
      }
      if (!looseUuidRegex.test(relPersonPlace.user)) {
        throw new Error("RelPersonPlace is missing user");
      }
    } catch (error) {
      toast.error(
        "La relation personne-lieu n'a pas été sauvegardée car son format était incorrect. Vous pouvez vérifier son contenu et tenter de la sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
      );
      capture(error);
      throw error;
    }
  }
  const decrypted = {};
  for (let field of encryptedFields) {
    decrypted[field] = relPersonPlace[field];
  }
  return {
    _id: relPersonPlace._id,
    createdAt: relPersonPlace.createdAt,
    updatedAt: relPersonPlace.updatedAt,
    deletedAt: relPersonPlace.deletedAt,
    organisation: relPersonPlace.organisation,

    decrypted,
    entityKey: relPersonPlace.entityKey,
  };
};

export async function encryptRelPersonPlace(relPersonPlace, { checkRequiredFields = true } = {}) {
  return encryptItem(prepareRelPersonPlaceForEncryption(relPersonPlace, { checkRequiredFields }));
}
