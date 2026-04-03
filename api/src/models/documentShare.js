const { Model, Deferrable } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const schema = {
    _id: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organisation: { type: DataTypes.UUID, references: { model: "Organisation", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    person: { type: DataTypes.UUID, allowNull: false },
    createdBy: { type: DataTypes.UUID, references: { model: "User", key: "_id", deferrable: Deferrable.INITIALLY_IMMEDIATE } },
    token: { type: DataTypes.TEXT, allowNull: false, unique: true },
    salt: { type: DataTypes.TEXT, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    downloadCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    maxDownloads: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    lockedAt: { type: DataTypes.DATE },
    accessedAt: { type: DataTypes.DATE },
    revokedAt: { type: DataTypes.DATE },
    filename: { type: DataTypes.TEXT, allowNull: false },
  };

  class DocumentShare extends Model {
    static associate({ Organisation, User }) {
      DocumentShare.belongsTo(Organisation, { foreignKey: { type: DataTypes.UUID, name: "organisation", field: "organisation" } });
      DocumentShare.belongsTo(User, { foreignKey: { type: DataTypes.UUID, name: "createdBy", field: "createdBy" } });
    }
  }

  DocumentShare.init(schema, {
    sequelize,
    modelName: "DocumentShare",
    freezeTableName: true,
    timestamps: true,
  });

  return DocumentShare;
};
