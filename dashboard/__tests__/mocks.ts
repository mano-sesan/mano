import dayjs from "dayjs";
import type { CustomOrPredefinedField } from "../src/types/field";
import type { PersonInstance, PersonPopulated } from "../src/types/person";
import type { UserInstance } from "../src/types/user";
import type { ReportInstance } from "../src/types/report";

export const personBase: PersonInstance = {
  _id: "1",
  organisation: "XXX",
  createdAt: dayjs("2023-01-01").toDate(),
  updatedAt: dayjs("2024-04-01").toDate(),
  deletedAt: undefined,
  name: "John Doe",
  outOfActiveList: false,
  user: "XXX",
  alertness: false,
  assignedTeams: [],
  birthdate: dayjs("1990-01-01").toDate(),
  description: "Description",
};

const userBase: UserInstance = {
  _id: "XXX",
  email: "xxx@xx.xx",
  name: "John Doe",
  organisation: "XXX",
  cgusAccepted: new Date(),
  role: "normal",
  healthcareProfessional: false,
  termsAccepted: new Date(),
  createdAt: new Date(),
  lastLoginAt: new Date(),
  phone: "0123456789",
};

export const personPopulated: PersonPopulated = {
  ...personBase,
  userPopulated: userBase,
  formattedBirthDate: "01/01/1990",
  age: 32,
  followSinceMonths: 3,
  formattedPhoneNumber: "01 23 45 67 89",
  interactions: [dayjs("2023-01-01").toDate()],
  lastUpdateCheckForGDPR: new Date(),
  forTeamFiltering: [],
};

export const mockedEvolutiveStatsIndicatorsBase: Array<CustomOrPredefinedField> = [
  {
    name: "gender",
    type: "enum",
    label: "Genre",
    encrypted: true,
    importable: true,
    filterable: true,
    enabled: true,
    options: ["Aucun", "Homme", "Femme", "Homme transgenre", "Femme transgenre", "Non binaire", "Autre"],
  },
  {
    name: "alertness",
    type: "boolean",
    label: "Personne très vulnérable",
    encrypted: true,
    importable: true,
    filterable: true,
    enabled: true,
  },
  {
    name: "outOfActiveList",
    type: "boolean",
    label: "Sortie de file active",
    encrypted: true,
    importable: true,
    options: ["Oui", "Non"],
    filterable: true,
    enabled: true,
  },
  {
    name: "outOfActiveListReasons",
    type: "multi-choice",
    label: "Motif(s) de sortie de file active",
    encrypted: true,
    importable: true,
    options: [
      "Incarcération",
      "Départ vers autre région",
      "Décès",
      "Relai vers autre structure",
      "Perdu de vue",
      "Autre",
      "Ne sait pas",
      "Insertion",
      "Orientation vers une autre structure",
      "Exclusion temporaiure",
      "Exclusion définitive",
    ],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2024-02-01T11-51-11-380Z",
    type: "boolean",
    label: "Endetté",
    encrypted: true,
    importable: true,
    options: [],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2024-01-09T16-08-32-284Z",
    type: "multi-choice",
    label: "Tranche de dette",
    encrypted: true,
    importable: true,
    options: ["100-200", "300_500", "600-1000"],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2023-12-21T14-16-15-807Z",
    type: "multi-choice",
    label: "Suivi SPIP",
    encrypted: true,
    importable: true,
    options: ["Oui", "Non", "NSP", "Autre"],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2023-12-15T09-40-16-722Z",
    type: "enum",
    label: "Situation personnelle",
    encrypted: true,
    importable: true,
    options: ["Isolé.e", "Couple avec enfant(s)"],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2023-06-16T08-50-52-737Z",
    type: "enum",
    label: "Nationalité",
    encrypted: true,
    importable: true,
    options: ["Française", "UE", "Hors UE", "Apatride", "Non communiqué"],
    filterable: true,
    enabled: true,
  },
  {
    name: "resources",
    type: "multi-choice",
    label: "Ressources",
    encrypted: true,
    importable: true,
    options: [
      "SANS",
      "ARE",
      "RSA",
      "AAH",
      "ADA",
      "ATA",
      "Retraite",
      "Salaire",
      "Allocation Chômage",
      "Indemnités journalières",
      "Mendicité",
      "Aide financière CCAS",
      "Revenus de Formations",
      "Pension d'invalidité",
      "Contrat d'engagement jeune",
      "Contrat jeune majeur",
      "Autre",
    ],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2023-12-20T16-33-12-516Z",
    type: "enum",
    label: "Sortie fil active",
    encrypted: true,
    importable: true,
    options: ["ACT", "HLM"],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2024-01-05T10-06-05-490Z",
    type: "multi-choice",
    label: "Produits consommés",
    encrypted: true,
    importable: true,
    options: ["Crack", "Mdma"],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2024-01-25T08-58-25-139Z",
    type: "yes-no",
    label: "A été en catalogne ?",
    encrypted: true,
    importable: true,
    options: [],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2023-06-16T09-12-47-771Z",
    type: "multi-choice",
    label: "Emploi",
    encrypted: true,
    importable: true,
    options: ["DPH", "CDD", "CDI", "CDDI", "Intérim", "Bénévolat", "Sans activité", "Étudiant", "Non déclaré", "Autre"],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2023-12-04T10-37-00-230Z",
    type: "multi-choice",
    label: "Couverture(s) médicale(s)",
    encrypted: true,
    importable: true,
    options: ["Aucune", "Régime général", "PUMa", "CSS", "AME", "Avec ALD", "Sans ALD"],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2023-12-19T10-35-39-717Z",
    type: "multi-choice",
    label: "Mode de consommation",
    encrypted: true,
    importable: true,
    options: ["Inhalation", "Injection", "Sniff"],
    filterable: true,
    enabled: true,
  },
  {
    name: "reasons",
    type: "multi-choice",
    label: "Motif de la situation en rue",
    encrypted: true,
    importable: true,
    options: [
      "Sortie d'hébergement",
      "Expulsion de logement/hébergement",
      "Départ du pays d'origine",
      "Départ de région",
      "Rupture familiale",
      "Perte d'emploi",
      "Sortie d'hospitalisation",
      "Problème de santé",
      "Sortie d'ASE",
      "Sortie de détention",
      "Rupture de soins",
      "Autre",
    ],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2023-11-08T12-52-47-263Z",
    type: "multi-choice",
    label: "Vulnérabilités",
    encrypted: true,
    importable: true,
    options: ["Pathologie chronique", "Psychologique", "Injecteur", "Handicap"],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2023-06-16T09-14-54-982Z",
    type: "multi-choice",
    label: "Consommations",
    encrypted: true,
    importable: true,
    options: [
      "Alcool",
      "Tabac",
      "Cannabis",
      "Amphétamines/MDMA/Ecstasy",
      "Benzodiazépine",
      "Buprénorphine/Subutex",
      "Cocaïne",
      "Crack",
      "Héroïne",
      "Lyrica",
      "Méthadone",
      "Moscantin/Skenan",
      "Tramadol",
      "Autre",
    ],
    filterable: true,
    enabled: true,
  },
  {
    name: "caseHistoryTypes",
    type: "multi-choice",
    label: "Catégorie d'antécédents",
    encrypted: true,
    importable: true,
    options: [
      "Gastro-enterologie",
      "Psychiatrie",
      "Dermatologie",
      "Neurologie",
      "Pulmonaire",
      "Rhumatologie",
      "Cardio-vasculaire",
      "Ophtalmologie",
      "ORL",
      "Dentaire",
      "Traumatologie",
      "Endocrinologie",
      "Uro-gynéco",
      "Cancer",
      "Addiction alcool",
      "Addiction autres",
      "Hospitalisation",
    ],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2024-01-05T14-03-25-969Z",
    type: "enum",
    label: "logement",
    encrypted: true,
    importable: true,
    options: [
      "indépendant",
      "locataire dans une structure durable",
      "locataire provisoire dans une structure d'hébergement",
      "en colocation",
      "dans voiture/camion/camping car",
      "hébergé",
      "en squat",
      "sans domicile",
    ],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2023-12-21T11-31-21-081Z",
    type: "enum",
    label: "Nombre de pers dans la famille",
    encrypted: true,
    importable: true,
    options: ["1", "2", "3", "4", "5", "6"],
    filterable: true,
    enabled: true,
  },
  {
    name: "custom-2023-12-21T11-31-51-780Z",
    type: "number",
    label: "Nombre d'enfants a charge",
    encrypted: true,
    importable: true,
    options: [],
    filterable: true,
    enabled: true,
  },
];

export const reportMock: ReportInstance = {
  _id: "1",
  organisation: "XXX",

  entityKey: "XXX",
  createdAt: "2023-01-01",
  updatedAt: "2023-01-01",

  team: "TEAM_A_ID",
  date: "2023-01-01",
};
