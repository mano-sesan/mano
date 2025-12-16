import { atomWithCache } from "@/store";
import { looseUuidRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { RelPersonPlaceInstance } from "@/types/place";

export const relsPersonPlaceState = atomWithCache<RelPersonPlaceInstance[]>("relPersonPlace", []);

const encryptedFields = ["place", "person", "user"];

export const prepareRelPersonPlaceForEncryption = (relPersonPlace: Partial<RelPersonPlaceInstance>) => {
  try {
    if (!looseUuidRegex.test(relPersonPlace.person!)) {
      throw new Error("RelPersonPlace is missing person");
    }
    if (!looseUuidRegex.test(relPersonPlace.place!)) {
      throw new Error("RelPersonPlace is missing place");
    }
    if (!looseUuidRegex.test(relPersonPlace.user!)) {
      throw new Error("RelPersonPlace is missing user");
    }
  } catch (error) {
    Alert.alert(
      "La relation entre le lieu et la personne n'a pas été sauvegardée car son format était incorrect.",
      "Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
    );
    capture(error);
    throw error;
  }
  const decrypted: Record<string, any> = {};
  for (let field of encryptedFields) {
    decrypted[field] = relPersonPlace[field as keyof RelPersonPlaceInstance];
  }
  return {
    _id: relPersonPlace._id,
    createdAt: relPersonPlace.createdAt,
    updatedAt: relPersonPlace.updatedAt,
    organisation: relPersonPlace.organisation,

    decrypted,
    entityKey: relPersonPlace.entityKey,
  };
};
