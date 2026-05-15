"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "mano"."User"
      ADD COLUMN "pscSubjectNameIdHash" TEXT UNIQUE;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "mano"."User"
      DROP COLUMN "pscSubjectNameIdHash";
    `);
  },
};
