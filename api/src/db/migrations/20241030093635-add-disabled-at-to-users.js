"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "mano"."User"
      ADD COLUMN "disabledAt" TIMESTAMP WITH TIME ZONE;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "mano"."User"
      DROP COLUMN "disabledAt";
    `);
  },
};
