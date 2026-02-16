"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS mano."OrphanedFile" (
        _id uuid NOT NULL,
        "createdAt" timestamp with time zone NOT NULL,
        "updatedAt" timestamp with time zone NOT NULL,
        organisation uuid NOT NULL,
        "personId" uuid NOT NULL,
        filename text NOT NULL,
        "replacedAt" timestamp with time zone NOT NULL,
        PRIMARY KEY (_id),
        CONSTRAINT "OrphanedFile_organisation_fkey" FOREIGN KEY (organisation) REFERENCES mano."Organisation"(_id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE
      );
      CREATE INDEX IF NOT EXISTS "OrphanedFile_organisation_idx" ON mano."OrphanedFile" USING btree (organisation);
      CREATE INDEX IF NOT EXISTS "OrphanedFile_replacedAt_idx" ON mano."OrphanedFile" USING btree ("replacedAt");
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS mano."OrphanedFile";`);
  },
};
