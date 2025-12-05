/**
 * Treatment state and utilities
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import { capture } from "../services/sentry";
import type { TreatmentInstance } from "../types/treatment";
import { encryptItem } from "../services/encryption";

// State reference for backward compatibility
export const treatmentsState = { key: "treatment" };

const encryptedFields: Array<keyof TreatmentInstance> = [
  "person",
  "user",
  "name",
  "dosage",
  "frequency",
  "indication",
  "startDate",
  "endDate",
  "documents",
  "comments",
  "history",
];

export const allowedTreatmentFieldsInHistory = [
  { name: "person", label: "Personne suivie" },
  { name: "name", label: "Nom du traitement" },
  { name: "startDate", label: "Date de début" },
  { name: "endDate", label: "Date de fin" },
  { name: "dosage", label: "Dosage" },
  { name: "frequency", label: "Fréquence" },
  { name: "indication", label: "Indication" },
];

export const prepareTreatmentForEncryption = (treatment: TreatmentInstance, { checkRequiredFields = true } = {}) => {
  if (checkRequiredFields) {
    try {
      if (!looseUuidRegex.test(treatment.person)) {
        throw new Error("Treatment is missing person");
      }
      if (!looseUuidRegex.test(treatment.user)) {
        throw new Error("Treatment is missing user");
      }
    } catch (error) {
      toast.error(
        "Le traitement n'a pas été sauvegardé car son format était incorrect. Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
      );
      capture(error);
      throw error;
    }
  }
  const decrypted: Record<string, any> = {};
  for (const field of encryptedFields) {
    decrypted[field] = treatment[field];
  }
  return {
    _id: treatment._id,
    organisation: treatment.organisation,
    createdAt: treatment.createdAt,
    updatedAt: treatment.updatedAt,
    deletedAt: treatment.deletedAt,

    decrypted,
    entityKey: treatment.entityKey,
  };
};

export async function encryptTreatment(treatment: TreatmentInstance, { checkRequiredFields = true } = {}) {
  return encryptItem(prepareTreatmentForEncryption(treatment, { checkRequiredFields }));
}
