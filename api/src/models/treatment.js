const { Model, Deferrable } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organisation: { type: DataTypes.UUID, references: { model: "Organisation", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    // Phase 1 (links migration): optional clear link fields (dual-write from clients)
    person: { type: DataTypes.UUID, allowNull: true, references: { model: "Person", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    user: { type: DataTypes.UUID, allowNull: true, references: { model: "User", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    encrypted: { type: DataTypes.TEXT },
    encryptedEntityKey: { type: DataTypes.TEXT },
  };

  class Treatment extends Model {
    static associate({ Organisation, Treatment, Person, User }) {
      Treatment.belongsTo(Organisation, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
      Organisation.hasMany(Treatment, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });

      Treatment.belongsTo(Person, { foreignKey: { type: DataTypes.UUID, name: "person", field: "person" } });
      Treatment.belongsTo(User, { foreignKey: { type: DataTypes.UUID, name: "user", field: "user" } });
    }
  }

  Treatment.init(schema, { sequelize, modelName: "Treatment", freezeTableName: true, timestamps: true, paranoid: true });
  return Treatment;
};
