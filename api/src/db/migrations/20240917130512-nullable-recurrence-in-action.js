"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."Action" ADD COLUMN IF NOT EXISTS "recurrence" UUID REFERENCES mano."Recurrence"(_id) ON DELETE SET NULL;`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Action" DROP COLUMN "recurrence";`);
  },
};
