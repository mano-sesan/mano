const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organisation: { type: DataTypes.UUID, allowNull: false },
    entityId: { type: DataTypes.UUID, allowNull: false },
    filename: { type: DataTypes.TEXT, allowNull: false },
    entityType: { type: DataTypes.TEXT, defaultValue: "person" },
    replacedAt: { type: DataTypes.DATE, allowNull: false },
  };

  class OrphanedFile extends Model {
    static associate(models) {
      this.belongsTo(models.Organisation, { foreignKey: "organisation" });
    }
  }

  OrphanedFile.init(schema, { sequelize, modelName: "OrphanedFile", freezeTableName: true });
  return OrphanedFile;
};
