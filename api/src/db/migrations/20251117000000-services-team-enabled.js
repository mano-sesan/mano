"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Convert services from strings to objects with enabled and enabledTeams fields
    await queryInterface.sequelize.query(`
      UPDATE "mano"."Organisation"
      SET "groupedServices" = (
        SELECT jsonb_agg(
          jsonb_build_object(
            'groupTitle', group_obj->>'groupTitle',
            'services', (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'name', service_name,
                  'enabled', true,
                  'enabledTeams', '[]'::jsonb
                )
              )
              FROM jsonb_array_elements_text(group_obj->'services') AS service_name
            )
          )
        )
        FROM jsonb_array_elements("groupedServices") AS group_obj
      )
      WHERE "groupedServices" IS NOT NULL
      AND jsonb_typeof("groupedServices") = 'array'
      AND "groupedServices"::text != '[]'
      -- Only update if services are still strings (not already migrated)
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements("groupedServices") AS group_obj
        WHERE jsonb_typeof(group_obj->'services') = 'array'
        AND jsonb_array_length(group_obj->'services') > 0
        AND jsonb_typeof((group_obj->'services')->0) = 'string'
      );
    `);
  },

  async down(queryInterface) {
    // Convert services back from objects to strings
    await queryInterface.sequelize.query(`
      UPDATE "mano"."Organisation"
      SET "groupedServices" = (
        SELECT jsonb_agg(
          jsonb_build_object(
            'groupTitle', group_obj->>'groupTitle',
            'services', (
              SELECT jsonb_agg(service_obj->>'name')
              FROM jsonb_array_elements(group_obj->'services') AS service_obj
            )
          )
        )
        FROM jsonb_array_elements("groupedServices") AS group_obj
      )
      WHERE "groupedServices" IS NOT NULL
      AND jsonb_typeof("groupedServices") = 'array'
      AND "groupedServices"::text != '[]'
      -- Only update if services are objects (not already strings)
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements("groupedServices") AS group_obj
        WHERE jsonb_typeof(group_obj->'services') = 'array'
        AND jsonb_array_length(group_obj->'services') > 0
        AND jsonb_typeof((group_obj->'services')->0) = 'object'
      );
    `);
  },
};
