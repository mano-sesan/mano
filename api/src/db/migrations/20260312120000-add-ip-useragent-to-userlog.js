"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mano."UserLog"
      ADD COLUMN IF NOT EXISTS ip TEXT,
      ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mano."UserLog"
      DROP COLUMN IF EXISTS ip,
      DROP COLUMN IF EXISTS "userAgent";
    `);
  },
};
