const { defaultMedicalFileCustomFields } = require("./custom-fields/medicalFile");
const { defaultObservationFields } = require("./custom-fields/observation");
const { fieldsPersonsCustomizableOptions, personFields } = require("./custom-fields/person");

function serializeOrganisation(organisation) {
  const defaultGroupedMedicalFileCustomFields = [
    {
      name: "Groupe par défaut",
      fields: defaultMedicalFileCustomFields,
    },
  ];
  return {
    _id: organisation._id,
    name: organisation.name,
    orgId: organisation.orgId,
    city: organisation.city,
    region: organisation.region,
    responsible: organisation.responsible,
    emailDpo: organisation.emailDpo,
    emailDirection: organisation.emailDirection,
    createdAt: organisation.createdAt,
    updatedAt: organisation.updatedAt,
    encryptionEnabled: organisation.encryptionEnabled,
    encryptionLastUpdateAt: organisation.encryptionLastUpdateAt,
    receptionEnabled: organisation.receptionEnabled,
    territoriesEnabled: organisation.territoriesEnabled,
    passagesEnabled: organisation.passagesEnabled,
    checkboxShowAllOrgaPersons: organisation.checkboxShowAllOrgaPersons,
    lockedForEncryption: organisation.lockedForEncryption,
    lockedBy: organisation.lockedBy,
    rencontresEnabled: organisation.rencontresEnabled,
    encryptedVerificationKey: organisation.encryptedVerificationKey,
    migrations: organisation.migrations,
    migrationLastUpdateAt: organisation.migrationLastUpdateAt,
    disabledAt: organisation.disabledAt,

    /* for family/groups */
    groupsEnabled: organisation.groupsEnabled,

    // Cela peut rester dans le doute pour le front, mais c'est l'ancienne facçon d'appeler les
    // actionsGroupedCategories. La colonne n'exite plus dans la base de données.
    categories: (organisation.actionsGroupedCategories || []).reduce(
      (flattenedCategories, group) => [...flattenedCategories, ...group.categories],
      []
    ),
    actionsGroupedCategories: organisation.actionsGroupedCategories || [{ groupTitle: "Toutes mes catégories", categories: [] }],
    structuresGroupedCategories: organisation.structuresGroupedCategories || [{ groupTitle: "Toutes mes catégories", categories: [] }],
    territoriesGroupedTypes: organisation.territoriesGroupedTypes || [
      {
        groupTitle: "Tous mes types",
        types: [
          "Lieu de conso",
          "Lieu de deal",
          "Carrefour de passage",
          "Campement",
          "Lieu de vie",
          "Prostitution",
          "Errance",
          "Mendicité",
          "Loisir",
          "Rassemblement communautaire",
          "Historique",
        ],
      },
    ],
    defaultPersonsFolders: organisation.defaultPersonsFolders || [],
    defaultMedicalFolders: organisation.defaultMedicalFolders || [],

    /* services settings */
    groupedServices: organisation.groupedServices || [{ groupTitle: "Tous mes services", services: organisation.services || [] }],
    // eslint-disable-next-line no-extra-boolean-cast
    services: !!organisation.groupedServices
      ? organisation.groupedServices.reduce((flattenedServices, group) => [...flattenedServices, ...group.services], [])
      : organisation.services,

    /* collaborations */
    collaborations: organisation.collaborations,

    /* custom fields consultations */
    consultations: organisation.consultations,
    /* custom fields observations */
    groupedCustomFieldsObs: organisation.groupedCustomFieldsObs?.length ? organisation.groupedCustomFieldsObs : defaultObservationFields,
    // This works as usual (before the migration) because the default group is the only one
    // Autrement dit, si quelqu'un n'a pas mis à jour l'app ou le dashboard, il a tous ses champs
    // d'observation en vrac comme avant.
    customFieldsObs: (organisation.groupedCustomFieldsObs || []).reduce((flattenedFields, group) => [...flattenedFields, ...group.fields], []),
    /* fixed fields persons */
    personFields: personFields,
    /* custom fields persons: fields with customizavble options only */
    fieldsPersonsCustomizableOptions: organisation.fieldsPersonsCustomizableOptions || fieldsPersonsCustomizableOptions,
    /* custom fields persons */
    customFieldsPersons: organisation.customFieldsPersons || [],
    /* kept for retro-compatibility */
    customFieldsPersonsSocial: (organisation.customFieldsPersons || []).find(({ name }) => name === "Informations sociales")?.fields || [],
    customFieldsPersonsMedical: (organisation.customFieldsPersons || []).find(({ name }) => name === "Informations de santé")?.fields || [],
    groupedCustomFieldsMedicalFile: organisation.groupedCustomFieldsMedicalFile || defaultGroupedMedicalFileCustomFields,
    // See above (groupedCustomFieldsObs and customFieldsObs) for explanation
    customFieldsMedicalFile: (organisation.groupedCustomFieldsMedicalFile || defaultGroupedMedicalFileCustomFields).reduce(
      (flattenedFields, group) => [...flattenedFields, ...group.fields],
      []
    ),
  };
}

function serializeTeam(team) {
  return {
    _id: team._id,
    name: team.name,
    organisation: team.organisation,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    nightSession: team.nightSession,
  };
}

function serializeUserWithTeamsAndOrganisation(user, teams, organisation, orgTeams) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    role: user.role,
    healthcareProfessional: user.healthcareProfessional,
    lastChangePasswordAt: user.lastChangePasswordAt,
    termsAccepted: user.termsAccepted,
    cgusAccepted: user.cgusAccepted,
    teams: teams.map(serializeTeam),
    orgTeams: orgTeams.map(serializeTeam),
    organisation: serializeOrganisation(organisation),
  };
}

module.exports = {
  serializeOrganisation,
  serializeTeam,
  serializeUserWithTeamsAndOrganisation,
};
