"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mano."Structure"
      ADD COLUMN IF NOT EXISTS email TEXT;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mano."Structure"
      DROP COLUMN IF EXISTS email;
    `);
  },
};
