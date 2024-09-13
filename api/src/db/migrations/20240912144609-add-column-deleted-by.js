"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Action" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."Action" ADD CONSTRAINT "Action_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."Action"("_id") ON DELETE SET NULL;`
    );
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Comment" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."Comment" ADD CONSTRAINT "Comment_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."Comment"("_id") ON DELETE SET NULL;`
    );
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Consultation" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."Consultation" ADD CONSTRAINT "Consultation_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."Consultation"("_id") ON DELETE SET NULL;`
    );
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Group" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."Group" ADD CONSTRAINT "Group_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."Group"("_id") ON DELETE SET NULL;`
    );
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."MedicalFile" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."MedicalFile" ADD CONSTRAINT "MedicalFile_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."MedicalFile"("_id") ON DELETE SET NULL;`
    );
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Passage" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."Passage" ADD CONSTRAINT "Passage_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."Passage"("_id") ON DELETE SET NULL;`
    );
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Person" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."Person" ADD CONSTRAINT "Person_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."Person"("_id") ON DELETE SET NULL;`
    );
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Place" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."Place" ADD CONSTRAINT "Place_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."Place"("_id") ON DELETE SET NULL;`
    );
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."RelPersonPlace" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."RelPersonPlace" ADD CONSTRAINT "RelPersonPlace_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."RelPersonPlace"("_id") ON DELETE SET NULL;`
    );
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Rencontre" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."Rencontre" ADD CONSTRAINT "Rencontre_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."Rencontre"("_id") ON DELETE SET NULL;`
    );
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Territory" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."Territory" ADD CONSTRAINT "Territory_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."Territory"("_id") ON DELETE SET NULL;`
    );
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."TerritoryObservation" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."TerritoryObservation" ADD CONSTRAINT "TerritoryObservation_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."TerritoryObservation"("_id") ON DELETE SET NULL;`
    );
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Treatment" ADD COLUMN "deletedBy" UUID;`);
    await queryInterface.sequelize.query(
      `ALTER TABLE "mano"."Treatment" ADD CONSTRAINT "Treatment_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "mano"."Treatment"("_id") ON DELETE SET NULL;`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Action" DROP COLUMN "deletedBy";`);
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Comment" DROP COLUMN "deletedBy";`);
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Consultation" DROP COLUMN "deletedBy";`);
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Group" DROP COLUMN "deletedBy";`);
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."MedicalFile" DROP COLUMN "deletedBy";`);
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Passage" DROP COLUMN "deletedBy";`);
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Person" DROP COLUMN "deletedBy";`);
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Place" DROP COLUMN "deletedBy";`);
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."RelPersonPlace" DROP COLUMN "deletedBy";`);
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Rencontre" DROP COLUMN "deletedBy";`);
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Territory" DROP COLUMN "deletedBy";`);
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."TerritoryObservation" DROP COLUMN "deletedBy";`);
    await queryInterface.sequelize.query(`ALTER TABLE "mano"."Treatment" DROP COLUMN "deletedBy";`);
  },
};
