/**
 * Medical File state and utilities
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import { capture } from "../services/sentry";
import type { MedicalFileInstance, NewMedicalFileInstance } from "../types/medicalFile";
import { encryptItem } from "../services/encryption";
import { CustomField } from "../types/field";

// State reference for backward compatibility
export const medicalFileState = { key: "medical-file" };

const encryptedFields: Array<keyof MedicalFileInstance> = ["person", "documents", "comments"];
export const prepareMedicalFileForEncryption =
  (customFieldsMedicalFile: CustomField[]) =>
  (medicalFile: MedicalFileInstance | NewMedicalFileInstance, { checkRequiredFields = true } = {}) => {
    if (checkRequiredFields) {
      try {
        if (!looseUuidRegex.test(medicalFile.person)) {
          throw new Error("MedicalFile is missing person");
        }
      } catch (error) {
        toast.error(
          "Le dossier médical n'a pas été sauvegardé car son format était incorrect. Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
        );
        capture(error);
        throw error;
      }
    }
    const encryptedFieldsIncludingCustom = [...customFieldsMedicalFile.map((f) => f.name), ...encryptedFields];
    const decrypted: any = {};
    for (const field of encryptedFieldsIncludingCustom) {
      decrypted[field] = medicalFile[field];
    }
    return {
      _id: medicalFile._id,
      createdAt: medicalFile.createdAt,
      updatedAt: medicalFile.updatedAt,
      deletedAt: medicalFile.deletedAt,
      organisation: medicalFile.organisation,

      decrypted,
      entityKey: medicalFile.entityKey,
    };
  };

export const encryptMedicalFile =
  (customFieldsMedicalFile: CustomField[]) =>
  (medicalFile: MedicalFileInstance | NewMedicalFileInstance, { checkRequiredFields = true } = {}) => {
    return encryptItem(prepareMedicalFileForEncryption(customFieldsMedicalFile)(medicalFile, { checkRequiredFields }));
  };
