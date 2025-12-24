import { atomWithCache } from "@/store";
import { looseUuidRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { PlaceInstance } from "@/types/place";

export const placesState = atomWithCache<PlaceInstance[]>("place", []);

const encryptedFields = ["user", "name"];

export const preparePlaceForEncryption = (place: Partial<PlaceInstance>) => {
  try {
    if (!place.name!) {
      throw new Error("Place is missing name");
    }
    if (!looseUuidRegex.test(place.user!)) {
      throw new Error("Place is missing user");
    }
  } catch (error) {
    Alert.alert(
      "Le lieu n'a pas été sauvegardé car son format était incorrect.",
      "Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
    );
    capture(error);
    throw error;
  }
  const decrypted: Record<string, any> = {};
  for (let field of encryptedFields) {
    decrypted[field] = place[field as keyof PlaceInstance];
  }
  return {
    _id: place._id,
    createdAt: place.createdAt,
    updatedAt: place.updatedAt,
    organisation: place.organisation,

    decrypted,
    entityKey: place.entityKey,
  };
};
