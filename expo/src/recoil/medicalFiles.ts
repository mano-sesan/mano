import { atom } from "jotai";
import { atomWithCache } from "@/store";
import { organisationState } from "./auth";
import { looseUuidRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { MedicalFileInstance, NewMedicalFileInstance } from "@/types/medicalFile";
import { CustomField } from "@/types/field";

export const medicalFileState = atomWithCache<MedicalFileInstance[]>("medical-file", []);

export const customFieldsMedicalFileSelector = atom((get) => {
  const organisation = get(organisationState)!;
  if (Array.isArray(organisation.customFieldsMedicalFile) && organisation.customFieldsMedicalFile.length) {
    return organisation.customFieldsMedicalFile;
  }
  return defaultMedicalFileCustomFields;
});

export const groupedCustomFieldsMedicalFileSelector = atom((get) => {
  const organisation = get(organisationState)!;
  if (Array.isArray(organisation.groupedCustomFieldsMedicalFile) && organisation.groupedCustomFieldsMedicalFile.length) {
    return organisation.groupedCustomFieldsMedicalFile;
  }
  return [{ name: "Groupe par défaut", fields: defaultMedicalFileCustomFields }];
});

const encryptedFields: Array<keyof MedicalFileInstance> = ["person", "documents", "comments", "history"];

export const prepareMedicalFileForEncryption =
  (customFieldsMedicalFile: CustomField[]) => (medicalFile: MedicalFileInstance | NewMedicalFileInstance) => {
    try {
      if (!looseUuidRegex.test(medicalFile.person)) {
        throw new Error("MedicalFile is missing person");
      }
    } catch (error) {
      Alert.alert(
        "Le dossier médical n'a pas été sauvegardé car son format était incorrect.",
        "Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif.",
      );
      capture(error);
      throw error;
    }
    const encryptedFieldsIncludingCustom = [...customFieldsMedicalFile.map((f) => f.name), ...encryptedFields];
    const decrypted: Record<string, any> = {};
    for (let field of encryptedFieldsIncludingCustom) {
      decrypted[field] = medicalFile[field];
    }
    return {
      _id: medicalFile._id,
      createdAt: medicalFile.createdAt,
      updatedAt: medicalFile.updatedAt,
      organisation: medicalFile.organisation,

      decrypted,
      entityKey: medicalFile.entityKey,
    };
  };

const defaultMedicalFileCustomFields: CustomField[] = [
  {
    name: "numeroSecuriteSociale",
    label: "Numéro de sécurité sociale",
    type: "text",
    options: undefined,
    enabled: true,
    required: false,
    showInStats: false,
  },
];
