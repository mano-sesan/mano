export interface ShareOptions {
  // Infos générales
  includeGeneralInfo: boolean;
  generalInfoFields: Record<string, boolean>; // Champs prédéfinis (name, birthdate, gender, etc.)

  // Champs personnalisés (par section et par champ)
  customFieldsSections: Record<string, boolean>;
  customFieldsFields: Record<string, boolean>;

  // Actions
  includeActions: boolean;
  actionCategories: string[];
  actionFields: Record<string, boolean>; // name, status, description, dueAt, team, categories, urgent

  // Consultations (si healthcareProfessional)
  includeConsultations: boolean;
  consultationTypes: string[];
  consultationFields: Record<string, Record<string, boolean>>; // Par type de consultation, puis par champ

  // Traitements (si healthcareProfessional)
  includeTreatments: boolean;
  treatmentFields: Record<string, boolean>; // name, dosage, frequency, indication, startDate, endDate

  // Commentaires (opt-in, non cochés par défaut)
  includeComments: boolean;
  includeCommentsMedical: boolean;

  // Passages (opt-in)
  includePassages: boolean;
  passageFields: Record<string, boolean>; // date, user, team, comment

  // Rencontres (opt-in)
  includeRencontres: boolean;
  rencontreFields: Record<string, boolean>; // date, user, team, comment

  // Textes libres
  headerSummary: string;
  headerMedical: string;
  footer: string;
}

// Champs prédéfinis pour les informations générales
export const GENERAL_INFO_FIELDS = [
  { name: "name", label: "Nom" },
  { name: "otherNames", label: "Autres noms" },
  { name: "birthdate", label: "Date de naissance" },
  { name: "gender", label: "Genre" },
  { name: "phone", label: "Téléphone" },
  { name: "email", label: "Email" },
  { name: "address", label: "Adresse" },
  { name: "followedSince", label: "Suivi·e depuis le" },
  { name: "assignedTeams", label: "Équipes assignées" },
  { name: "outOfActiveList", label: "Sortie de file active" },
  { name: "outOfActiveListReasons", label: "Motif(s) de sortie" },
  { name: "outOfActiveListDate", label: "Date de sortie" },
] as const;

// Champs prédéfinis pour les actions
export const ACTION_FIELDS = [
  { name: "name", label: "Nom de l'action" },
  { name: "status", label: "Statut" },
  { name: "dueAt", label: "Date d'échéance" },
  { name: "completedAt", label: "Date de réalisation" },
  { name: "categories", label: "Catégories" },
  { name: "teams", label: "Équipe(s) en charge" },
  { name: "description", label: "Description" },
  { name: "urgent", label: "Action urgente" },
  { name: "person", label: "Personne concernée" },
] as const;

// Champs prédéfinis pour les traitements
export const TREATMENT_FIELDS = [
  { name: "name", label: "Nom du médicament" },
  { name: "dosage", label: "Dosage" },
  { name: "frequency", label: "Fréquence" },
  { name: "indication", label: "Indication" },
  { name: "startDate", label: "Date de début" },
  { name: "endDate", label: "Date de fin" },
] as const;

// Champs prédéfinis pour les passages
export const PASSAGE_FIELDS = [
  { name: "date", label: "Date" },
  { name: "user", label: "Créé par" },
  { name: "team", label: "Équipe" },
  { name: "comment", label: "Commentaire" },
] as const;

// Champs prédéfinis pour les rencontres
export const RENCONTRE_FIELDS = [
  { name: "date", label: "Date" },
  { name: "user", label: "Créé par" },
  { name: "team", label: "Équipe" },
  { name: "comment", label: "Commentaire" },
] as const;

export function getDefaultShareOptions(): ShareOptions {
  // Par défaut, tous les champs sont sélectionnés
  const generalInfoFields: Record<string, boolean> = {};
  for (const field of GENERAL_INFO_FIELDS) {
    generalInfoFields[field.name] = true;
  }

  const actionFields: Record<string, boolean> = {};
  for (const field of ACTION_FIELDS) {
    actionFields[field.name] = true;
  }

  const treatmentFields: Record<string, boolean> = {};
  for (const field of TREATMENT_FIELDS) {
    treatmentFields[field.name] = true;
  }

  const passageFields: Record<string, boolean> = {};
  for (const field of PASSAGE_FIELDS) {
    passageFields[field.name] = true;
  }

  const rencontreFields: Record<string, boolean> = {};
  for (const field of RENCONTRE_FIELDS) {
    rencontreFields[field.name] = true;
  }

  return {
    includeGeneralInfo: true,
    generalInfoFields,
    customFieldsSections: {},
    customFieldsFields: {},
    includeActions: true,
    actionCategories: [],
    actionFields,
    includeConsultations: true,
    consultationTypes: [],
    consultationFields: {},
    includeTreatments: true,
    treatmentFields,
    includeComments: false,
    includeCommentsMedical: false,
    includePassages: false,
    passageFields,
    includeRencontres: false,
    rencontreFields,
    headerSummary: "",
    headerMedical: "",
    footer: "",
  };
}
