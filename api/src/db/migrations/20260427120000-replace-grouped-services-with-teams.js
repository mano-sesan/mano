"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (t) => {
      // Add the new column if it does not yet exist
      await queryInterface.sequelize.query(
        `
        ALTER TABLE "mano"."Organisation"
        ADD COLUMN IF NOT EXISTS "groupedServicesWithTeams" jsonb;
        `,
        { transaction: t }
      );

      // Check if the legacy "groupedServices" column still exists
      const [legacyColumn] = await queryInterface.sequelize.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'mano'
          AND table_name = 'Organisation'
          AND column_name = 'groupedServices';
        `,
        { transaction: t }
      );

      if (legacyColumn.length > 0) {
        // Derive the new column from the legacy one for rows where the new column is still null.
        // Each legacy entry { groupTitle, services: string[] } becomes
        //   { groupTitle, services: [{ name, enabled: true, enabledTeams: [] }] }
        // The legacy column itself is left in place (frozen snapshot) and will be dropped in a
        // later cleanup migration once we have stopped reading from it everywhere.
        await queryInterface.sequelize.query(
          `
          UPDATE mano."Organisation"
          SET "groupedServicesWithTeams" = COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'groupTitle', g->>'groupTitle',
                  'services', COALESCE(
                    (
                      SELECT jsonb_agg(
                        jsonb_build_object(
                          'name', svc,
                          'enabled', true,
                          'enabledTeams', '[]'::jsonb
                        )
                      )
                      FROM jsonb_array_elements_text(g->'services') AS svc
                    ),
                    '[]'::jsonb
                  )
                )
              )
              FROM jsonb_array_elements(COALESCE("groupedServices", '[]'::jsonb)) AS g
            ),
            '[]'::jsonb
          )
          WHERE "groupedServicesWithTeams" IS NULL;
          `,
          { transaction: t }
        );
      } else {
        // Legacy column already absent: just ensure rows have a non-null value for the new column
        await queryInterface.sequelize.query(
          `
          UPDATE mano."Organisation"
          SET "groupedServicesWithTeams" = '[]'::jsonb
          WHERE "groupedServicesWithTeams" IS NULL;
          `,
          { transaction: t }
        );
      }
    });
  },

  async down() {
    // No down migration: legacy column is preserved untouched, the new column can be dropped manually if needed.
  },
};
