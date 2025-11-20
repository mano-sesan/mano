import { Folder } from "./document";
import { CustomField, PredefinedField, CustomFieldsGroup } from "./field";

interface GroupedCategories {
  groupTitle: string;
  categories: string[];
}

export interface ServiceConfig {
  name: string;
  enabled: boolean;
  enabledTeams: string[];
}

export interface GroupedServices {
  groupTitle: string;
  services: (string | ServiceConfig)[]; // Support both legacy string format and new object format
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

  groupedServices?: GroupedServices[];
  groupedServicesWithTeams?: GroupedServices[]; // New field with team configuration
  services?: string[]; // deprecated

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

  defaultPersonsFolders?: Folder[];
  defaultMedicalFolders?: Folder[];

  responsible?: string;
  emailDirection?: string;
  emailDpo?: string;
}
