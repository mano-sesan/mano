const { Model, Deferrable } = require("sequelize");
const { getRequestUserId } = require("../utils/requestContext");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organisation: { type: DataTypes.UUID, references: { model: "Organisation", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    encrypted: { type: DataTypes.TEXT },
    encryptedEntityKey: { type: DataTypes.TEXT },
    deletedBy: { type: DataTypes.UUID, references: { model: "User", key: "_id" } },
    updatedBy: { type: DataTypes.UUID, references: { model: "User", key: "_id" } },
  };

  class Person extends Model {
    static associate({ Organisation, Person }) {
      Person.belongsTo(Organisation, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
      Organisation.hasMany(Person, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
    }
  }

  function resolveUserId(options) {
    // Prefer explicit context, then transaction metadata, then request-scoped context.
    return options?.context?.userId || options?.transaction?.userId || getRequestUserId();
  }

  Person.init(schema, {
    sequelize,
    modelName: "Person",
    freezeTableName: true,
    timestamps: true,
    paranoid: true,
    hooks: {
      beforeCreate: (instance, options) => {
        const userId = resolveUserId(options);
        if (!userId) return;
        instance.updatedBy = userId;
      },
      beforeBulkCreate: (instances, options) => {
        const userId = resolveUserId(options);
        if (!userId) return;
        for (const instance of instances) {
          instance.updatedBy = userId;
        }
      },
      beforeUpdate: (instance, options) => {
        if (options?.silent) return;
        const userId = resolveUserId(options);
        if (!userId) return;
        instance.updatedBy = userId;
      },
      beforeBulkUpdate: (options) => {
        if (options?.silent) return;
        const userId = resolveUserId(options);
        if (!userId) return;
        options.attributes = options.attributes || {};
        options.attributes.updatedBy = userId;
      },
    },
  });
  return Person;
};
