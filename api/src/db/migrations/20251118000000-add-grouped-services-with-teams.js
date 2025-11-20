const { Sequelize } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new column groupedServicesWithTeams
    await queryInterface.addColumn("Organisation", "groupedServicesWithTeams", {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    
    console.log("✅ Added groupedServicesWithTeams column to Organisation table");

    // Migrate existing data from groupedServices to groupedServicesWithTeams
    const [organisations] = await queryInterface.sequelize.query(
      'SELECT "_id", "groupedServices" FROM "mano"."Organisation" WHERE "groupedServices" IS NOT NULL'
    );

    console.log(`Found ${organisations.length} organisations with groupedServices to migrate`);

    for (const org of organisations) {
      const groupedServices = org.groupedServices;
      if (!groupedServices || !Array.isArray(groupedServices)) continue;

      // Transform each group's services from strings to objects with team config
      const groupedServicesWithTeams = groupedServices.map((group) => {
        if (!group.services || !Array.isArray(group.services)) {
          return group;
        }

        return {
          groupTitle: group.groupTitle,
          services: group.services.map((service) => {
            // If already an object, keep it as-is
            if (typeof service === "object" && service.name) {
              return service;
            }
            // Convert string to service object
            return {
              name: typeof service === "string" ? service : String(service),
              enabled: true,
              enabledTeams: [],
            };
          }),
        };
      });

      // Update the organisation with the new structure
      await queryInterface.sequelize.query(
        'UPDATE "mano"."Organisation" SET "groupedServicesWithTeams" = :groupedServicesWithTeams WHERE "_id" = :id',
        {
          replacements: {
            groupedServicesWithTeams: JSON.stringify(groupedServicesWithTeams),
            id: org._id,
          },
        }
      );
    }

    console.log(`✅ Migrated ${organisations.length} organisations to groupedServicesWithTeams`);
  },

  async down(queryInterface) {
    // Remove the column
    await queryInterface.removeColumn("Organisation", "groupedServicesWithTeams");
    
    console.log("✅ Removed groupedServicesWithTeams column from Organisation table");
  },
};
