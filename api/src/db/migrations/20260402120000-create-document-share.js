"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS mano."DocumentShare" (
        "_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organisation" UUID NOT NULL REFERENCES mano."Organisation"("_id") ON DELETE CASCADE,
        "person" UUID NOT NULL,
        "createdBy" UUID NOT NULL REFERENCES mano."User"("_id"),
        "token" TEXT UNIQUE NOT NULL,
        "salt" TEXT NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "downloadCount" INTEGER NOT NULL DEFAULT 0,
        "maxDownloads" INTEGER NOT NULL DEFAULT 5,
        "lockedAt" TIMESTAMP WITH TIME ZONE,
        "accessedAt" TIMESTAMP WITH TIME ZONE,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "filename" TEXT NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "DocumentShare_token_idx" ON mano."DocumentShare" ("token");
      CREATE INDEX IF NOT EXISTS "DocumentShare_organisation_idx" ON mano."DocumentShare" ("organisation");
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS mano."DocumentShare";
    `);
  },
};
