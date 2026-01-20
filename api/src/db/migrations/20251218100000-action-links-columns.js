"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "mano"."Action"
        ADD COLUMN IF NOT EXISTS "person" UUID REFERENCES mano."Person"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "user" UUID REFERENCES mano."User"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "team" UUID REFERENCES mano."Team"(_id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "teams" UUID[];
    `);
  },

  async down(queryInterface) {
    // Keep down lightweight; these columns are additive and safe to keep.
    await queryInterface.sequelize.query(`
      ALTER TABLE "mano"."Action"
        DROP COLUMN IF EXISTS "teams",
        DROP COLUMN IF EXISTS "team",
        DROP COLUMN IF EXISTS "user",
        DROP COLUMN IF EXISTS "person";
    `);
  },
};
