const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Organisation", "statsV2Enabled", {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("Organisation", "statsV2Enabled");
  },
};
