"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "mano"."User"
      ADD COLUMN "gaveFeedbackSep2025" BOOLEAN DEFAULT FALSE;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "mano"."User"
      DROP COLUMN "gaveFeedbackSep2025";
    `);
  },
};
