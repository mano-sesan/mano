"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mano."Recurrence" DROP CONSTRAINT IF EXISTS "Recurrence_organisation_fkey";
      ALTER TABLE mano."Recurrence" ADD CONSTRAINT "Recurrence_organisation_fkey" 
      FOREIGN KEY (organisation) REFERENCES mano."Organisation"(_id) ON UPDATE CASCADE ON DELETE CASCADE;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mano."Recurrence" DROP CONSTRAINT IF EXISTS "Recurrence_organisation_fkey";
      ALTER TABLE mano."Recurrence" ADD CONSTRAINT "Recurrence_organisation_fkey" 
      FOREIGN KEY (organisation) REFERENCES mano."Organisation"(_id);
    `);
  },
};
