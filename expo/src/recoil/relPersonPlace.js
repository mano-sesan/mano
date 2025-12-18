import { atomWithCache } from "@/store";
import { looseUuidRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";

export const relsPersonPlaceState = atomWithCache("relPersonPlace", []);

const encryptedFields = ["place", "person", "user"];

export const prepareRelPersonPlaceForEncryption = (relPersonPlace) => {
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
    Alert.alert(
      "La relation entre le lieu et la personne n'a pas été sauvegardée car son format était incorrect.",
      "Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
    );
    capture(error);
    throw error;
  }
  const decrypted = {};
  for (let field of encryptedFields) {
    decrypted[field] = relPersonPlace[field];
  }
  return {
    _id: relPersonPlace._id,
    createdAt: relPersonPlace.createdAt,
    updatedAt: relPersonPlace.updatedAt,
    organisation: relPersonPlace.organisation,

    // Phase 1 (links migration): dual-write links outside encrypted blob.
    person: relPersonPlace.person,
    place: relPersonPlace.place,
    user: relPersonPlace.user,

    decrypted,
    entityKey: relPersonPlace.entityKey,
  };
};
