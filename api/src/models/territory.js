const { Model, Deferrable } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organisation: { type: DataTypes.UUID, references: { model: "Organisation", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    // Phase 1 (links migration): optional clear link fields (dual-write from clients)
    user: { type: DataTypes.UUID, allowNull: true, references: { model: "User", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    encrypted: { type: DataTypes.TEXT },
    encryptedEntityKey: { type: DataTypes.TEXT },
  };

  class Territory extends Model {
    static associate({ Organisation, Territory, User }) {
      Territory.belongsTo(Organisation, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
      Organisation.hasMany(Territory, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });

      Territory.belongsTo(User, { foreignKey: { type: DataTypes.UUID, name: "user", field: "user" } });
    }
  }

  Territory.init(schema, { sequelize, modelName: "Territory", freezeTableName: true, timestamps: true, paranoid: true });
  return Territory;
};
