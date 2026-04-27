import { Folder } from "./document";
import { CustomField, PredefinedField, CustomFieldsGroup } from "./field";
import { UUIDV4 } from "./uuid";

interface GroupedCategories {
  groupTitle: string;
  categories: string[];
}

// Legacy shape, exposé en sortie d'API tant que les vieux mobiles ne sont pas tous migrés.
interface GroupedServices {
  groupTitle: string;
  services: string[];
}

// Format réel stocké côté backend (cf. `groupedServicesWithTeams`). Chaque service porte sa propre
// visibilité par équipe, sur le pattern des champs personnalisés filtrés.
export interface ServiceItem {
  name: string;
  enabled: boolean;
  enabledTeams: UUIDV4[];
}

export interface ServiceGroup {
  groupTitle: string;
  services: ServiceItem[];
}

interface GroupedTypes {
  groupTitle: string;
  types: string[];
}

export interface OrganisationInstance {
  _id: string;
  orgId: string;
  name: string;
  city: string;
  region: string;

  createdAt?: Date;
  updatedAt?: Date;

  lockedForEncryption?: boolean;

  collaborations?: string[];

  encryptionEnabled?: boolean;
  encryptionLastUpdateAt?: Date;
  encryptedVerificationKey?: string;
  encrypting?: boolean;

  migrating?: boolean;
  migrations?: string[];
  migrationLastUpdateAt?: Date;

  receptionEnabled?: boolean;
  territoriesEnabled?: boolean;
  groupsEnabled?: boolean;
  passagesEnabled?: boolean;
  rencontresEnabled?: boolean;
  checkboxShowAllOrgaPersons?: boolean;

  /** @deprecated Projection legacy émise par l'API ; utiliser `groupedServicesWithTeams`. */
  groupedServices?: GroupedServices[];
  groupedServicesWithTeams?: ServiceGroup[];

  customFieldsObs: CustomField[];
  groupedCustomFieldsObs?: CustomFieldsGroup[];
  customFieldsPersonsSocial: CustomField[]; // deprecated
  customFieldsPersonsMedical: CustomField[]; // deprecated
  personFields: PredefinedField[];
  customFieldsPersons: CustomFieldsGroup[];
  customFieldsMedicalFile: CustomField[];
  groupedCustomFieldsMedicalFile?: CustomFieldsGroup[];
  fieldsPersonsCustomizableOptions: CustomField[];
  consultations: CustomFieldsGroup[];

  categories?: string[]; // deprecated
  actionsGroupedCategories?: GroupedCategories[];
  structuresGroupedCategories?: GroupedCategories[];
  territoriesGroupedTypes?: GroupedTypes[];

  defaultPersonsFolders: Folder[];
  defaultMedicalFolders: Folder[];

  responsible?: string;
  emailDirection?: string;
  emailDpo?: string;
}
