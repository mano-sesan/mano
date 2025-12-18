const { Model, Deferrable } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organisation: { type: DataTypes.UUID, references: { model: "Organisation", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    // Phase 1 (links migration): optional clear link fields (dual-write from clients)
    person: { type: DataTypes.UUID, allowNull: true, references: { model: "Person", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    team: { type: DataTypes.UUID, allowNull: true, references: { model: "Team", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    user: { type: DataTypes.UUID, allowNull: true, references: { model: "User", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    encrypted: { type: DataTypes.TEXT },
    encryptedEntityKey: { type: DataTypes.TEXT },
  };

  class Passage extends Model {
    static associate({ Organisation, Passage, Person, Team, User }) {
      Passage.belongsTo(Organisation, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
      Organisation.hasMany(Passage, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });

      Passage.belongsTo(Person, { foreignKey: { type: DataTypes.UUID, name: "person", field: "person" } });
      Passage.belongsTo(Team, { foreignKey: { type: DataTypes.UUID, name: "team", field: "team" } });
      Passage.belongsTo(User, { foreignKey: { type: DataTypes.UUID, name: "user", field: "user" } });
    }
  }

  Passage.init(schema, { sequelize, modelName: "Passage", freezeTableName: true, timestamps: true, paranoid: true });
  return Passage;
};
