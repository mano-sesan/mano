"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "mano"."User"
      SET "gaveFeedbackSep2025" = FALSE;
    `);
  },

  async down(queryInterface) {
    // No rollback needed as per request
  },
};
