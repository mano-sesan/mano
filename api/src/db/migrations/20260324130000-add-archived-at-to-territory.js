"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mano."Territory"
      ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP WITH TIME ZONE;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mano."Territory"
      DROP COLUMN IF EXISTS "archivedAt";
    `);
  },
};
