"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "mano"."User"
      ADD COLUMN "otp" TEXT DEFAULT NULL,
      ADD COLUMN "lastOtpAt" TIMESTAMP WITH TIME ZONE;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "mano"."User"
      DROP COLUMN "otp",
      DROP COLUMN "lastOtpAt";
    `);
  },
};
