"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS mano."OrganisationLog" (
        _id uuid NOT NULL,
        "createdAt" timestamp with time zone NOT NULL,
        "updatedAt" timestamp with time zone NOT NULL,
        organisation uuid NOT NULL,
        "user" uuid NOT NULL,
        field text NOT NULL,
        "oldValue" jsonb,
        "newValue" jsonb,
        PRIMARY KEY (_id),
        CONSTRAINT "OrganisationLog_organisation_fkey" FOREIGN KEY (organisation) REFERENCES mano."Organisation"(_id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE,
        CONSTRAINT "OrganisationLog_user_fkey" FOREIGN KEY ("user") REFERENCES mano."User"(_id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE
      );
      CREATE INDEX IF NOT EXISTS "OrganisationLog_organisation_idx" ON mano."OrganisationLog" USING btree (organisation);
      CREATE INDEX IF NOT EXISTS "OrganisationLog_user_idx" ON mano."OrganisationLog" USING btree ("user");
      CREATE INDEX IF NOT EXISTS "OrganisationLog_createdAt_idx" ON mano."OrganisationLog" USING btree ("createdAt");
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS mano."OrganisationLog";`);
  },
};
