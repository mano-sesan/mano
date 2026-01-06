"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."Person" ADD COLUMN IF NOT EXISTS "updatedBy" UUID REFERENCES mano."User"(_id) ON DELETE SET NULL;`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Person" DROP COLUMN IF EXISTS "updatedBy";`);
  },
};
