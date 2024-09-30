const { Model, Deferrable } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organisation: { type: DataTypes.UUID, references: { model: "Organisation", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    startDate: { type: DataTypes.DATE, allowNull: false },
    endDate: { type: DataTypes.DATE, allowNull: false },
    timeInterval: { type: DataTypes.INTEGER, allowNull: false },
    timeUnit: { type: DataTypes.ENUM("day", "week", "month", "year"), allowNull: false },
    selectedDays: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: true },
    recurrenceTypeForMonthAndYear: { type: DataTypes.ENUM("absolute", "relative", "relativeLast"), allowNull: true },
  };

  class Recurrence extends Model {
    static associate({ Organisation, Recurrence, Action }) {
      Recurrence.belongsTo(Organisation, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
      Organisation.hasMany(Recurrence, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
      Recurrence.hasMany(Action, { foreignKey: { type: DataTypes.UUID, name: "recurrence", field: "recurrence" } });
    }
  }

  Recurrence.init(schema, { sequelize, modelName: "Recurrence", freezeTableName: true });
  return Recurrence;
};
