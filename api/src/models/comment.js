const { Model, Deferrable } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organisation: { type: DataTypes.UUID, references: { model: "Organisation", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    // Phase 1 (links migration): optional clear link fields (dual-write from clients)
    person: { type: DataTypes.UUID, allowNull: true, references: { model: "Person", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    action: { type: DataTypes.UUID, allowNull: true, references: { model: "Action", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    team: { type: DataTypes.UUID, allowNull: true, references: { model: "Team", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    user: { type: DataTypes.UUID, allowNull: true, references: { model: "User", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    encrypted: { type: DataTypes.TEXT },
    encryptedEntityKey: { type: DataTypes.TEXT },
  };

  class Comment extends Model {
    static associate({ Organisation, Comment, Person, Action, Team, User }) {
      Comment.belongsTo(Organisation, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
      Organisation.hasMany(Comment, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });

      Comment.belongsTo(Person, { foreignKey: { type: DataTypes.UUID, name: "person", field: "person" } });
      Comment.belongsTo(Action, { foreignKey: { type: DataTypes.UUID, name: "action", field: "action" } });
      Comment.belongsTo(Team, { foreignKey: { type: DataTypes.UUID, name: "team", field: "team" } });
      Comment.belongsTo(User, { foreignKey: { type: DataTypes.UUID, name: "user", field: "user" } });
    }
  }

  Comment.init(schema, { sequelize, modelName: "Comment", freezeTableName: true, timestamps: true, paranoid: true });
  return Comment;
};
