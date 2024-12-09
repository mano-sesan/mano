"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "mano"."User"
      SET "cgusAccepted" = NULL;
    `);
  },

  async down() {
    // No down migration needed since we can't restore previous acceptance dates
  },
};
