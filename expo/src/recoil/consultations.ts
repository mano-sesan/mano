import { atom } from "jotai";
import { atomWithCache } from "@/store";
import { looseUuidRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { organisationState } from "./auth";
import { ConsultationInstance } from "@/types/consultation";
import { CustomFieldsGroup } from "@/types/field";
import { UserInstance } from "@/types/user";

export const consultationsState = atomWithCache<ConsultationInstance[]>("consultation", []);

export const encryptedFields: Array<keyof ConsultationInstance> = [
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

export const consultationFieldsSelector = atom((get) => {
  const organisation = get(organisationState);
  return organisation?.consultations || [];
});

export const flattenedCustomFieldsConsultationsSelector = atom((get) => {
  const customFieldsConsultationsSections = get(consultationFieldsSelector);
  const customFieldsConsultations = [];
  for (const section of customFieldsConsultationsSections) {
    for (const field of section.fields) {
      customFieldsConsultations.push(field);
    }
  }
  return customFieldsConsultations;
});

/* Other utils atom */

export const consultationsFieldsIncludingCustomFieldsSelector = atom((get) => {
  const flattenedCustomFieldsConsultations = get(flattenedCustomFieldsConsultationsSelector);
  return [
    { name: "name", label: "Nom" },
    { name: "type", label: "Type" },
    { name: "onlyVisibleBy", label: "Seulement visible par moi" },
    { name: "person", label: "Personne suivie" },
    { name: "teams", label: ":Equipe(s) en charge" },
    { name: "completedAt", label: "Faite le" },
    { name: "dueAt", label: "À faire le" },
    { name: "status", label: "Status" },
    ...flattenedCustomFieldsConsultations.map((f) => {
      return {
        name: f.name,
        label: f.label,
      };
    }),
  ];
});

export const prepareConsultationForEncryption = (customFieldsConsultations: CustomFieldsGroup[]) => (consultation: Partial<ConsultationInstance>) => {
  try {
    if (!looseUuidRegex.test(consultation.person || "")) {
      throw new Error("Consultation is missing person");
    }
    if (!looseUuidRegex.test(consultation.user || "")) {
      throw new Error("Consultation is missing user");
    }
    // we don't force the team (yet) because it's blocking with automatic updates of consultation
    // like merge people + change custom fields
    // if (!looseUuidRegex.test(consultation.teams)) {
    //   throw new Error('Consultation is missing teams');
    // }
  } catch (error) {
    Alert.alert(
      "La consultation n'a pas été sauvegardée car son format était incorrect.",
      "Vous pouvez vérifier son contenu et tenter de la sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif.",
    );
    capture(error);
    throw error;
  }
  const consultationTypeCustomFields = customFieldsConsultations.find((consult) => consult.name === consultation.type)?.fields || [];
  const encryptedFieldsIncludingCustom = [...consultationTypeCustomFields.map((f) => f.name), ...encryptedFields];
  const decrypted: Record<string, any> = {};
  for (let field of encryptedFieldsIncludingCustom) {
    decrypted[field] = consultation[field];
  }
  return {
    _id: consultation._id,
    organisation: consultation.organisation,
    createdAt: consultation.createdAt,
    updatedAt: consultation.updatedAt,

    completedAt: consultation.completedAt,
    dueAt: consultation.dueAt,
    status: consultation.status,
    onlyVisibleBy: consultation.onlyVisibleBy,

    decrypted,
    entityKey: consultation.entityKey,
  };
};

export const defaultConsultationFields = { isConsultation: true, withTime: true };

export const formatConsultation = (consultation: ConsultationInstance) => {
  return { ...consultation, ...defaultConsultationFields };
};

export const disableConsultationRow = (actionOrConsultation: any, user: UserInstance) => {
  if (!actionOrConsultation.isConsultation) return false;
  if (!user.healthcareProfessional) return true;
  if (!actionOrConsultation.onlyVisibleBy?.length) return false;
  return !actionOrConsultation.onlyVisibleBy.includes(user._id);
};

export const consultationIsVisibleByMe = (consultation: ConsultationInstance, me: UserInstance) => {
  if (!me?.healthcareProfessional) return false;
  if (!consultation?.onlyVisibleBy?.length) return true;
  return consultation.onlyVisibleBy.includes(me._id);
};
