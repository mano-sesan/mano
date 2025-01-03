import { setCacheItem } from "../services/dataManagement";
import { atom } from "recoil";
import { looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import { capture } from "../services/sentry";
import { encryptItem } from "../services/encryption";

const collectionName = "place";
export const placesState = atom({
  key: collectionName,
  default: [],
  effects: [({ onSet }) => onSet(async (newValue) => setCacheItem(collectionName, newValue))],
});

const encryptedFields = ["user", "name"];

export const preparePlaceForEncryption = (place, { checkRequiredFields = true } = {}) => {
  if (checkRequiredFields) {
    try {
      if (!place.name) {
        throw new Error("Place is missing name");
      }
      if (!looseUuidRegex.test(place.user)) {
        throw new Error("Place is missing user");
      }
    } catch (error) {
      toast.error(
        "Le lieu n'a pas été sauvegardé car son format était incorrect. Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
      );
      capture(error);
      throw error;
    }
  }
  const decrypted = {};
  for (let field of encryptedFields) {
    decrypted[field] = place[field];
  }
  return {
    _id: place._id,
    createdAt: place.createdAt,
    updatedAt: place.updatedAt,
    deletedAt: place.deletedAt,
    organisation: place.organisation,

    decrypted,
    entityKey: place.entityKey,
  };
};

export async function encryptPlace(place, { checkRequiredFields = true } = {}) {
  return encryptItem(preparePlaceForEncryption(place, { checkRequiredFields }));
}
