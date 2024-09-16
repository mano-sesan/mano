"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mano."Organisation"
      ADD COLUMN "emailDirection" TEXT,
      ADD COLUMN "emailDpo" TEXT;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mano."Organisation"
      DROP COLUMN "emailDirection",
      DROP COLUMN "emailDpo";
    `);
  },
};
