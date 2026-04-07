"use strict";

// Palette figée (copie depuis dashboard/src/components/TagTeam.jsx au moment
// de l'écriture de la migration). Ne pas modifier : doit refléter ce que le
// dashboard affichait jusqu'à présent via le fallback basé sur l'index.
const TEAM_COLORS = [
  "#255c99",
  "#74776b",
  "#00c6a5",
  "#ff4b64",
  "#ef798a",
  "#a066ff",
  "#00e6d6",
  "#124660",
  "#ff4f38",
  "#1b9476",
  "#4dbac7",
  "#ffa500",
  "#e392db",
  "#28a428",
  "#f5d000",
];

module.exports = {
  async up(queryInterface) {
    // Un seul UPDATE : on calcule l'index (0-based) de chaque team au sein de
    // son organisation via ROW_NUMBER() trié par createdAt ASC — même ordre
    // que celui utilisé par les controllers pour renvoyer les teams au
    // dashboard (cf. api/src/controllers/team.js). L'index est calculé sur
    // toutes les teams de l'orga pour rester cohérent avec ce qui était
    // affiché via le fallback, mais seules celles sans couleur sont mises à
    // jour.
    await queryInterface.sequelize.query(
      `
      WITH ranked AS (
        SELECT "_id",
               (ROW_NUMBER() OVER (PARTITION BY "organisation" ORDER BY "createdAt" ASC) - 1) AS idx
        FROM mano."Team"
      )
      UPDATE mano."Team" t
      SET "color" = (ARRAY[:colors]::text[])[(ranked.idx % :paletteSize) + 1]
      FROM ranked
      WHERE t."_id" = ranked."_id"
        AND t."color" IS NULL
      `,
      { replacements: { colors: TEAM_COLORS, paletteSize: TEAM_COLORS.length } },
    );
  },

  async down() {
    // No-op : on ne peut pas distinguer les couleurs backfillées de celles
    // qui étaient déjà présentes avant la migration.
  },
};
