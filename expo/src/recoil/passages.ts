import { atomWithCache } from "@/store";
import { looseUuidRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { PassageInstance } from "@/types/passage";

export const passagesState = atomWithCache<PassageInstance[]>("passage", []);

const encryptedFields = ["person", "team", "user", "date", "comment"];

export const preparePassageForEncryption = (passage: Partial<PassageInstance>) => {
  try {
    // we don't check the presence of a person because passage can be anonymous
    if (!looseUuidRegex.test(passage.team!)) {
      throw new Error("Passage is missing team");
    }
    if (!looseUuidRegex.test(passage.user!)) {
      throw new Error("Passage is missing user");
    }
    if (!passage.date) {
      throw new Error("Passage is missing date");
    }
  } catch (error) {
    Alert.alert(
      "Le passage n'a pas été sauvegardé car son format était incorrect.",
      "Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
    );
    capture(error);
    throw error;
  }
  const decrypted: Record<string, any> = {};
  for (let field of encryptedFields) {
    decrypted[field] = passage[field as keyof PassageInstance];
  }
  return {
    _id: passage._id,
    createdAt: passage.createdAt,
    updatedAt: passage.updatedAt,
    organisation: passage.organisation,

    decrypted,
    entityKey: passage.entityKey,
  };
};
