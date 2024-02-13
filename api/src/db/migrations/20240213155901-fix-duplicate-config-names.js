"use strict";

const { QueryTypes } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    let organisations = await queryInterface.sequelize.query(
      'SELECT _id, "customFieldsMedicalFile" FROM "mano"."Organisation" WHERE "customFieldsMedicalFile" IS NOT NULL',
      { type: QueryTypes.SELECT }
    );

    for (const org of organisations) {
      if (org.customFieldsMedicalFile && org.customFieldsMedicalFile.length) {
        let hasDuplicates = false;
        let nameCounter = {};

        for (const field of org.customFieldsMedicalFile) {
          if (field.name) {
            nameCounter[field.name] = (nameCounter[field.name] || 0) + 1;
            if (nameCounter[field.name] > 1) hasDuplicates = true;
          }
        }

        if (hasDuplicates) {
          for (const field of org.customFieldsMedicalFile) {
            if (field.name && nameCounter[field.name] > 1) {
              field.name += "-" + uuidv4();
              nameCounter[field.name] = nameCounter[field.name] - 1;
            }
          }

          await queryInterface.sequelize.query(
            'UPDATE "mano"."Organisation" SET "customFieldsMedicalFile" = :customFields, "updatedAt" = NOW() WHERE _id = :id',
            {
              replacements: {
                customFields: JSON.stringify(org.customFieldsMedicalFile),
                id: org._id,
              },
              type: QueryTypes.UPDATE,
            }
          );
        }
      }
    }

    organisations = await queryInterface.sequelize.query(
      'SELECT _id, "customFieldsObs" FROM "mano"."Organisation" WHERE "customFieldsObs" IS NOT NULL',
      {
        type: QueryTypes.SELECT,
      }
    );

    for (const org of organisations) {
      if (org.customFieldsObs && org.customFieldsObs.length) {
        let hasDuplicates = false;
        let nameCounter = {};

        for (const field of org.customFieldsObs) {
          if (field.name) {
            nameCounter[field.name] = (nameCounter[field.name] || 0) + 1;
            if (nameCounter[field.name] > 1) hasDuplicates = true;
          }
        }

        if (hasDuplicates) {
          for (const field of org.customFieldsObs) {
            if (field.name && nameCounter[field.name] > 1) {
              field.name += "-" + uuidv4();
              nameCounter[field.name] = nameCounter[field.name] - 1;
            }
          }

          await queryInterface.sequelize.query(
            'UPDATE "mano"."Organisation" SET "customFieldsObs" = :customFields, "updatedAt" = NOW() WHERE _id = :id',
            {
              replacements: {
                customFields: JSON.stringify(org.customFieldsObs),
                id: org._id,
              },
              type: QueryTypes.UPDATE,
            }
          );
        }
      }
    }

    organisations = await queryInterface.sequelize.query(
      'SELECT _id, "customFieldsPersons" FROM "mano"."Organisation" WHERE "customFieldsPersons" IS NOT NULL',
      {
        type: QueryTypes.SELECT,
      }
    );

    for (const org of organisations) {
      if (org.customFieldsPersons && org.customFieldsPersons.length) {
        let needsUpdate = false;

        for (const personField of org.customFieldsPersons) {
          if (personField.fields && personField.fields.length) {
            let hasDuplicates = false;
            let nameCounter = {};

            for (const field of personField.fields) {
              if (field.name) {
                nameCounter[field.name] = (nameCounter[field.name] || 0) + 1;
                if (nameCounter[field.name] > 1) hasDuplicates = true;
              }
            }

            if (hasDuplicates) {
              for (const field of personField.fields) {
                if (field.name && nameCounter[field.name] > 1) {
                  field.name += "-" + uuidv4();
                  nameCounter[field.name] = nameCounter[field.name] - 1;
                  needsUpdate = true;
                }
              }
            }
          }
        }

        if (needsUpdate) {
          await queryInterface.sequelize.query(
            'UPDATE "mano"."Organisation" SET "customFieldsPersons" = :customFields, "updatedAt" = NOW() WHERE _id = :id',
            {
              replacements: {
                customFields: JSON.stringify(org.customFieldsPersons),
                id: org._id,
              },
              type: QueryTypes.UPDATE,
            }
          );
        }
      }
    }

    organisations = await queryInterface.sequelize.query('SELECT _id, consultations FROM "mano"."Organisation" WHERE consultations IS NOT NULL', {
      type: QueryTypes.SELECT,
    });

    for (const org of organisations) {
      if (org.consultations && org.consultations.length) {
        let needsUpdate = false;

        for (const consultationField of org.consultations) {
          if (consultationField.fields && consultationField.fields.length) {
            let hasDuplicates = false;
            let nameCounter = {};

            for (const field of consultationField.fields) {
              if (field.name) {
                nameCounter[field.name] = (nameCounter[field.name] || 0) + 1;
                if (nameCounter[field.name] > 1) hasDuplicates = true;
              }
            }

            if (hasDuplicates) {
              for (const field of consultationField.fields) {
                if (field.name && nameCounter[field.name] > 1) {
                  field.name += "-" + uuidv4();
                  nameCounter[field.name] = nameCounter[field.name] - 1;
                  needsUpdate = true;
                }
              }
            }
          }
        }

        if (needsUpdate) {
          await queryInterface.sequelize.query(
            'UPDATE "mano"."Organisation" SET consultations = :customFields, "updatedAt" = NOW() WHERE _id = :id',
            {
              replacements: {
                customFields: JSON.stringify(org.consultations),
                id: org._id,
              },
              type: QueryTypes.UPDATE,
            }
          );
        }
      }
    }
  },
};
