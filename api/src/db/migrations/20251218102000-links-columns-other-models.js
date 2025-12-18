"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      -- Comment links
      ALTER TABLE "mano"."Comment"
        ADD COLUMN IF NOT EXISTS "person" UUID REFERENCES mano."Person"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "action" UUID REFERENCES mano."Action"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "team" UUID REFERENCES mano."Team"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "user" UUID REFERENCES mano."User"(_id) ON DELETE SET NULL;

      -- Passage links
      ALTER TABLE "mano"."Passage"
        ADD COLUMN IF NOT EXISTS "person" UUID REFERENCES mano."Person"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "team" UUID REFERENCES mano."Team"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "user" UUID REFERENCES mano."User"(_id) ON DELETE SET NULL;

      -- Rencontre links
      ALTER TABLE "mano"."Rencontre"
        ADD COLUMN IF NOT EXISTS "person" UUID REFERENCES mano."Person"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "team" UUID REFERENCES mano."Team"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "user" UUID REFERENCES mano."User"(_id) ON DELETE SET NULL;

      -- Consultation links
      ALTER TABLE "mano"."Consultation"
        ADD COLUMN IF NOT EXISTS "person" UUID REFERENCES mano."Person"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "user" UUID REFERENCES mano."User"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "teams" UUID[];

      -- Treatment links
      ALTER TABLE "mano"."Treatment"
        ADD COLUMN IF NOT EXISTS "person" UUID REFERENCES mano."Person"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "user" UUID REFERENCES mano."User"(_id) ON DELETE SET NULL;

      -- MedicalFile links
      ALTER TABLE "mano"."MedicalFile"
        ADD COLUMN IF NOT EXISTS "person" UUID REFERENCES mano."Person"(_id) ON DELETE SET NULL;

      -- TerritoryObservation links
      ALTER TABLE "mano"."TerritoryObservation"
        ADD COLUMN IF NOT EXISTS "territory" UUID REFERENCES mano."Territory"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "team" UUID REFERENCES mano."Team"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "user" UUID REFERENCES mano."User"(_id) ON DELETE SET NULL;

      -- Territory links
      ALTER TABLE "mano"."Territory"
        ADD COLUMN IF NOT EXISTS "user" UUID REFERENCES mano."User"(_id) ON DELETE SET NULL;

      -- Place links
      ALTER TABLE "mano"."Place"
        ADD COLUMN IF NOT EXISTS "user" UUID REFERENCES mano."User"(_id) ON DELETE SET NULL;

      -- RelPersonPlace links
      ALTER TABLE "mano"."RelPersonPlace"
        ADD COLUMN IF NOT EXISTS "person" UUID REFERENCES mano."Person"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "place" UUID REFERENCES mano."Place"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "user" UUID REFERENCES mano."User"(_id) ON DELETE SET NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "mano"."RelPersonPlace"
        DROP COLUMN IF EXISTS "user",
        DROP COLUMN IF EXISTS "place",
        DROP COLUMN IF EXISTS "person";

      ALTER TABLE "mano"."Place"
        DROP COLUMN IF EXISTS "user";

      ALTER TABLE "mano"."Territory"
        DROP COLUMN IF EXISTS "user";

      ALTER TABLE "mano"."TerritoryObservation"
        DROP COLUMN IF EXISTS "user",
        DROP COLUMN IF EXISTS "team",
        DROP COLUMN IF EXISTS "territory";

      ALTER TABLE "mano"."MedicalFile"
        DROP COLUMN IF EXISTS "person";

      ALTER TABLE "mano"."Treatment"
        DROP COLUMN IF EXISTS "user",
        DROP COLUMN IF EXISTS "person";

      ALTER TABLE "mano"."Consultation"
        DROP COLUMN IF EXISTS "teams",
        DROP COLUMN IF EXISTS "user",
        DROP COLUMN IF EXISTS "person";

      ALTER TABLE "mano"."Rencontre"
        DROP COLUMN IF EXISTS "user",
        DROP COLUMN IF EXISTS "team",
        DROP COLUMN IF EXISTS "person";

      ALTER TABLE "mano"."Passage"
        DROP COLUMN IF EXISTS "user",
        DROP COLUMN IF EXISTS "team",
        DROP COLUMN IF EXISTS "person";

      ALTER TABLE "mano"."Comment"
        DROP COLUMN IF EXISTS "user",
        DROP COLUMN IF EXISTS "team",
        DROP COLUMN IF EXISTS "action",
        DROP COLUMN IF EXISTS "person";
    `);
  },
};
