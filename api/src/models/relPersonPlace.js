const { Model, Deferrable } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organisation: { type: DataTypes.UUID, references: { model: "Organisation", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    // Phase 1 (links migration): optional clear link fields (dual-write from clients)
    person: { type: DataTypes.UUID, allowNull: true, references: { model: "Person", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    place: { type: DataTypes.UUID, allowNull: true, references: { model: "Place", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    user: { type: DataTypes.UUID, allowNull: true, references: { model: "User", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    encrypted: { type: DataTypes.TEXT },
    encryptedEntityKey: { type: DataTypes.TEXT },
  };

  class RelPersonPlace extends Model {
    static associate({ Organisation, RelPersonPlace, Person, Place, User }) {
      RelPersonPlace.belongsTo(Organisation, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
      Organisation.hasMany(RelPersonPlace, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });

      RelPersonPlace.belongsTo(Person, { foreignKey: { type: DataTypes.UUID, name: "person", field: "person" } });
      RelPersonPlace.belongsTo(Place, { foreignKey: { type: DataTypes.UUID, name: "place", field: "place" } });
      RelPersonPlace.belongsTo(User, { foreignKey: { type: DataTypes.UUID, name: "user", field: "user" } });
    }
  }

  RelPersonPlace.init(schema, { sequelize, modelName: "RelPersonPlace", freezeTableName: true, timestamps: true, paranoid: true });
  return RelPersonPlace;
};
