"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      {
        tableName: "Recurrence",
        schema: "mano",
      },
      {
        _id: {
          type: Sequelize.DataTypes.UUID,
          primaryKey: true,
          defaultValue: Sequelize.DataTypes.UUIDV4,
        },
        startDate: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
        },
        endDate: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
        },
        timeInterval: {
          type: Sequelize.DataTypes.INTEGER,
          allowNull: false,
        },
        timeUnit: {
          type: Sequelize.DataTypes.ENUM("day", "week", "month", "year"),
          allowNull: false,
        },
        selectedDays: {
          type: Sequelize.DataTypes.ARRAY(Sequelize.DataTypes.TEXT),
          allowNull: true,
        },
        recurrenceTypeForMonthAndYear: {
          type: Sequelize.DataTypes.ENUM("absolute", "relative", "relativeLast"),
          allowNull: true,
        },
        organisation: {
          type: Sequelize.DataTypes.UUID,
          allowNull: false,
          references: {
            model: {
              tableName: "Organisation",
              schema: "mano",
            },
            key: "_id",
          },
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable({
      tableName: "Recurrence",
      schema: "mano",
    });
  },
};
