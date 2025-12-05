/**
 * Consultation state and utilities
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import { capture } from "../services/sentry";
import type { ConsultationInstance } from "../types/consultation";
import type { CustomFieldsGroup } from "../types/field";
import type { UserInstance } from "../types/user";
import { encryptItem } from "../services/encryption";

// State reference for backward compatibility
export const consultationsState = { key: "consultation" };

const encryptedFields: Array<keyof ConsultationInstance> = [
  // Normal fields
  "name",
  "type",
  "person",
  "user",
  "teams",
  "documents",
  "comments",
  "history",
  // Medical constants
  "constantes-poids",
  "constantes-frequence-cardiaque",
  "constantes-taille",
  "constantes-saturation-o2",
  "constantes-temperature",
  "constantes-glycemie-capillaire",
  "constantes-frequence-respiratoire",
  "constantes-tension-arterielle-systolique",
  "constantes-tension-arterielle-diastolique",
];

export const excludeConsultationsFieldsFromSearch = new Set([
  "_id",
  "encryptedEntityKey",
  "entityKey",
  "createdBy",
  "documents",
  "user", // because it is an id
  "organisation", // because it is an id
  // "type",
  "person",
  "user",
  "teams",
  "documents",
  // "comments",
  "history",
  "constantes-poids",
  "constantes-frequence-cardiaque",
  "constantes-taille",
  "constantes-saturation-o2",
  "constantes-temperature",
  "constantes-glycemie-capillaire",
  "constantes-frequence-respiratoire",
  "constantes-tension-arterielle-systolique",
  "constantes-tension-arterielle-diastolique",
]);

// Selector functions
export const consultationFieldsSelector_fn = (state: { organisation: any }): CustomFieldsGroup[] => {
  return state.organisation?.consultations || [];
};

export const flattenedCustomFieldsConsultationsSelector_fn = (state: { organisation: any }) => {
  const sections = consultationFieldsSelector_fn(state);
  const result: any[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      result.push(field);
    }
  }
  return result;
};

export const consultationsFieldsIncludingCustomFieldsSelector_fn = (state: { organisation: any }) => {
  const flattenedCustom = flattenedCustomFieldsConsultationsSelector_fn(state);
  return [
    { name: "name", label: "Nom" },
    { name: "type", label: "Type" },
    { name: "onlyVisibleBy", label: "Seulement visible par moi" },
    { name: "person", label: "Personne suivie" },
    { name: "teams", label: ":Equipe(s) en charge" },
    { name: "completedAt", label: "Faite le" },
    { name: "dueAt", label: "À faire le" },
    { name: "status", label: "Statut" },
    ...flattenedCustom.map((f: any) => ({ name: f.name, label: f.label })),
  ];
};

export const prepareConsultationForEncryption =
  (customFieldsConsultations: CustomFieldsGroup[]) =>
  (consultation: ConsultationInstance, { checkRequiredFields = true } = {}) => {
    if (checkRequiredFields) {
      try {
        if (!looseUuidRegex.test(consultation.person)) {
          throw new Error("Consultation is missing person");
        }
        if (!looseUuidRegex.test(consultation.user)) {
          throw new Error("Consultation is missing user");
        }
      } catch (error) {
        toast.error(
          "La consultation n'a pas été sauvegardée car son format était incorrect. Vous pouvez vérifier son contenu et tenter de la sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
        );
        capture(error);
        throw error;
      }
    }
    const consultationTypeCustomFields = customFieldsConsultations.find((consult) => consult.name === consultation.type)?.fields || [];
    const encryptedFieldsIncludingCustom = [...consultationTypeCustomFields.map((f) => f.name), ...encryptedFields];
    const decrypted: any = {};
    for (const field of encryptedFieldsIncludingCustom) {
      decrypted[field] = consultation[field];
    }
    return {
      _id: consultation._id,
      organisation: consultation.organisation,
      createdAt: consultation.createdAt,
      updatedAt: consultation.updatedAt,
      deletedAt: consultation.deletedAt,

      completedAt: consultation.completedAt,
      dueAt: consultation.dueAt,
      status: consultation.status,
      onlyVisibleBy: consultation.onlyVisibleBy || [],

      decrypted,
      entityKey: consultation.entityKey,
    };
  };

export const encryptConsultation =
  (customFieldsConsultations: CustomFieldsGroup[]) =>
  (consultation: ConsultationInstance, { checkRequiredFields = true } = {}) => {
    return encryptItem(prepareConsultationForEncryption(customFieldsConsultations)(consultation, { checkRequiredFields }));
  };

export const defaultConsultationFields = { isConsultation: true, withTime: true };

export const formatConsultation = (consultation: ConsultationInstance) => {
  return { ...consultation, ...defaultConsultationFields };
};

export const disableConsultationRow = (actionOrConsultation: any, user: UserInstance) => {
  if (!actionOrConsultation.isConsultation) return false;
  if (!user.healthcareProfessional) return true;
  if (!actionOrConsultation.onlyVisibleBy?.length) return false;
  const isVisibleByUser = actionOrConsultation.onlyVisibleBy.includes(user._id);
  const isDisabled = !isVisibleByUser;
  return isDisabled;
};
