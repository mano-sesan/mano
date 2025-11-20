"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Check if services column exists before migrating
    const [results] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'mano' 
        AND table_name = 'Organisation' 
        AND column_name = 'services';
    `);

    // If services column doesn't exist, skip migration
    if (results.length === 0) {
      console.log('Column "services" does not exist, skipping migration');
      return;
    }

    // Migrate services to groupedServices
    // Rule 1: If both are null, set groupedServices to empty array
    await queryInterface.sequelize.query(`
      UPDATE mano."Organisation"
      SET "groupedServices" = '[]'::jsonb
      WHERE "services" IS NULL AND "groupedServices" IS NULL;
    `);

    // Rule 2: If groupedServices is null but services is not, transform services to groupedServices
    await queryInterface.sequelize.query(`
      UPDATE mano."Organisation"
      SET "groupedServices" = jsonb_build_array(
        jsonb_build_object(
          'groupTitle', 'Tous mes services',
          'services', COALESCE("services", ARRAY[]::text[])
        )
      )
      WHERE "services" IS NOT NULL AND "groupedServices" IS NULL;
    `);

    // Rule 3: If services is null but groupedServices is not, or both are filled, do nothing
    // (no query needed for this case)
  },

  async down() {
    // No down migration
  },
};
