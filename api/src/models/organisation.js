const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: DataTypes.TEXT,
    orgId: DataTypes.TEXT, // for superadmin
    city: { type: DataTypes.TEXT, default: "" }, // for superadmin
    region: DataTypes.TEXT, // for superadmin
    responsible: DataTypes.TEXT,
    emailDpo: DataTypes.TEXT,
    emailDirection: DataTypes.TEXT,
    actionsGroupedCategories: {
      type: DataTypes.JSONB, // example: [{"groupTitle": "médical", categories: ["seringue", "pansement"]}, { "groupTitle": "local", "categories": ["entretien", "lavage"]}]
    },
    structuresGroupedCategories: {
      type: DataTypes.JSONB,
      // example: [{"groupTitle": "lala", categories: ["carud", "mairie"]}, { "groupTitle": "lolo", "categories": ["entretien", "lavage"]}]
    },
    territoriesGroupedTypes: {
      type: DataTypes.JSONB,
      // example: [{"groupTitle": "Tous mes types", "types": ["Lieu de conso", "Lieu de deal", "Carrefour de passage", "Campement", "Lieu de vie", "Prostitution", "Errance", "Mendicité", "Loisir", "Rassemblement communautaire", "Historique"]}]
    },
    defaultPersonsFolders: { type: DataTypes.JSONB, defaultValue: [] },
    defaultMedicalFolders: { type: DataTypes.JSONB, defaultValue: [] },
    collaborations: { type: [DataTypes.ARRAY(DataTypes.TEXT)], defaultValue: [] },
    consultations: DataTypes.JSONB,
    encryptionEnabled: { type: DataTypes.BOOLEAN },
    encryptionLastUpdateAt: DataTypes.DATE,
    encryptedVerificationKey: DataTypes.TEXT,
    encrypting: { type: DataTypes.BOOLEAN, default: false },
    lockedForEncryption: { type: DataTypes.BOOLEAN, default: false },
    lockedBy: DataTypes.TEXT,
    receptionEnabled: { type: DataTypes.BOOLEAN },
    territoriesEnabled: { type: DataTypes.BOOLEAN },
    groupsEnabled: { type: DataTypes.BOOLEAN },
    passagesEnabled: { type: DataTypes.BOOLEAN },
    rencontresEnabled: { type: DataTypes.BOOLEAN },
    groupedServices: {
      type: DataTypes.JSONB, // example: [{"groupTitle": "injection", services: ["Garrot"]}]
    },
    groupedCustomFieldsObs: DataTypes.JSONB,
    fieldsPersonsCustomizableOptions: DataTypes.JSONB,
    customFieldsPersons: DataTypes.JSONB,
    groupedCustomFieldsMedicalFile: DataTypes.JSONB,
    checkboxShowAllOrgaPersons: { type: DataTypes.BOOLEAN, default: true },
    migrating: { type: DataTypes.BOOLEAN, default: false },
    migrations: DataTypes.ARRAY(DataTypes.TEXT),
    migrationLastUpdateAt: DataTypes.DATE,
    disabledAt: DataTypes.DATE,
  };

  class Organisation extends Model {
    static associate() {
      // See other models
    }
  }

  Organisation.init(schema, {
    sequelize,
    modelName: "Organisation",
    freezeTableName: true,
    hooks: {
      beforeUpdate: async (instance, options) => {
        // Get the current user from either transaction metadata or request context
        const userId = options?.transaction?.userId || options?.context?.userId;
        if (!userId) return;

        const OrganisationLog = require("./organisationLog")(sequelize, sequelize.constructor.DataTypes);
        const changes = instance.changed();

        if (!changes) return;

        // Log each changed field
        for (const field of changes) {
          await OrganisationLog.create(
            {
              organisation: instance._id,
              user: userId,
              field,
              oldValue: instance.previous(field),
              newValue: instance.get(field),
            },
            { transaction: options.transaction }
          );
        }
      },
    },
  });
  return Organisation;
};
