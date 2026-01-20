const { Model, Deferrable } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organisation: { type: DataTypes.UUID, references: { model: "Organisation", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    status: DataTypes.TEXT,
    dueAt: DataTypes.DATE,
    completedAt: DataTypes.DATE,
    // Phase 1 (links migration): store links outside encrypted blob (dual-write from clients)
    person: { type: DataTypes.UUID, allowNull: true, references: { model: "Person", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    user: { type: DataTypes.UUID, allowNull: true, references: { model: "User", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    team: { type: DataTypes.UUID, allowNull: true, references: { model: "Team", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    teams: { type: DataTypes.ARRAY(DataTypes.UUID) },
    encrypted: { type: DataTypes.TEXT },
    encryptedEntityKey: { type: DataTypes.TEXT },
    recurrence: { type: DataTypes.UUID, allowNull: true, references: { model: "Recurrence", key: "_id" } },
  };

  class Action extends Model {
    static associate({ Organisation, Action, Recurrence, Person, User, Team }) {
      Action.belongsTo(Organisation, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
      Organisation.hasMany(Action, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
      Action.belongsTo(Recurrence, { foreignKey: { type: DataTypes.UUID, name: "recurrence", field: "recurrence" } });
      Recurrence.hasMany(Action, { foreignKey: { type: DataTypes.UUID, name: "recurrence", field: "recurrence" } });

      // Optional associations for new link columns
      Action.belongsTo(Person, { foreignKey: { type: DataTypes.UUID, name: "person", field: "person" } });
      Action.belongsTo(User, { foreignKey: { type: DataTypes.UUID, name: "user", field: "user" } });
      Action.belongsTo(Team, { foreignKey: { type: DataTypes.UUID, name: "team", field: "team" } });
    }
  }

  Action.init(schema, { sequelize, modelName: "Action", freezeTableName: true, timestamps: true, paranoid: true });
  return Action;
};
