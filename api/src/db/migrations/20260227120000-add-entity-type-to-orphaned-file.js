"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mano."OrphanedFile" ADD COLUMN IF NOT EXISTS "entityType" text NOT NULL DEFAULT 'person';
      ALTER TABLE mano."OrphanedFile" RENAME COLUMN "personId" TO "entityId";
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mano."OrphanedFile" RENAME COLUMN "entityId" TO "personId";
      ALTER TABLE mano."OrphanedFile" DROP COLUMN IF EXISTS "entityType";
    `);
  },
};
