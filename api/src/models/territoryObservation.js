const { Model, Deferrable } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organisation: { type: DataTypes.UUID, references: { model: "Organisation", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    // Phase 1 (links migration): optional clear link fields (dual-write from clients)
    territory: { type: DataTypes.UUID, allowNull: true, references: { model: "Territory", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    team: { type: DataTypes.UUID, allowNull: true, references: { model: "Team", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    user: { type: DataTypes.UUID, allowNull: true, references: { model: "User", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    encrypted: { type: DataTypes.TEXT },
    encryptedEntityKey: { type: DataTypes.TEXT },
  };

  class TerritoryObservation extends Model {
    static associate({ Organisation, TerritoryObservation, Territory, Team, User }) {
      TerritoryObservation.belongsTo(Organisation, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
      Organisation.hasMany(TerritoryObservation, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });

      TerritoryObservation.belongsTo(Territory, { foreignKey: { type: DataTypes.UUID, name: "territory", field: "territory" } });
      TerritoryObservation.belongsTo(Team, { foreignKey: { type: DataTypes.UUID, name: "team", field: "team" } });
      TerritoryObservation.belongsTo(User, { foreignKey: { type: DataTypes.UUID, name: "user", field: "user" } });
    }
  }

  TerritoryObservation.init(schema, { sequelize, modelName: "TerritoryObservation", freezeTableName: true, timestamps: true, paranoid: true });
  return TerritoryObservation;
};
