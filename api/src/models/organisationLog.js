const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organisation: { type: DataTypes.UUID, allowNull: false },
    user: { type: DataTypes.UUID, allowNull: false },
    field: { type: DataTypes.TEXT, allowNull: false },
    oldValue: { type: DataTypes.JSONB },
    newValue: { type: DataTypes.JSONB },
  };

  class OrganisationLog extends Model {
    static associate(models) {
      this.belongsTo(models.Organisation, { foreignKey: "organisation" });
      this.belongsTo(models.User, { foreignKey: "user" });
    }
  }

  OrganisationLog.init(schema, { sequelize, modelName: "OrganisationLog", freezeTableName: true });
  return OrganisationLog;
};
