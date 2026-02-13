import { test, expect } from "@playwright/test";
import { populate } from "./scripts/populate-db";
import { loginWith } from "./utils";
import pg from "pg";

test.beforeAll(async () => {
  await populate();
});

test("Suppression d'une organisation par un admin - vérification en base", async ({ page }) => {
  const orgName = "Orga Test - 11";

  // Récupérer l'ID de l'organisation en base
  const client = new pg.Client({
    connectionString: `${process.env.PGBASEURL}/manotest`,
  });
  await client.connect();
  const orgResult = await client.query(`SELECT _id FROM mano."Organisation" WHERE name = $1`, [orgName]);
  const orgId = orgResult.rows[0]._id;

  // Vérifier que des données existent avant suppression
  const userCountBefore = await client.query(`SELECT count(*)::int as count FROM mano."User" WHERE organisation = $1`, [orgId]);
  expect(userCountBefore.rows[0].count).toBeGreaterThan(0);
  const teamCountBefore = await client.query(`SELECT count(*)::int as count FROM mano."Team" WHERE organisation = $1`, [orgId]);
  expect(teamCountBefore.rows[0].count).toBeGreaterThan(0);

  // Se connecter en tant qu'admin de l'organisation 11
  await loginWith(page, "admin11@example.org");

  // Créer une personne
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("button", { name: "Créer une personne" }).click();
  await page.getByLabel("Nom").fill("Personne test suppression");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();

  // Créer une action pour cette personne
  await page.getByRole("link", { name: "Agenda" }).click();
  await page.getByRole("button", { name: "Créer une action" }).click();
  await page.getByLabel("Nom de l'action").fill("Action test suppression");
  await page.locator(".create-action-person-select__input-container").click();
  await page.locator(".create-action-person-select__menu").getByText("Personne test suppression").click();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();

  // Créer un territoire
  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByRole("button", { name: "Créer un territoire" }).click();
  await page.getByLabel("Nom").fill("Territoire test suppression");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();

  // Créer un contact (structure)
  await page.getByRole("link", { name: "Contacts", exact: true }).click();
  await page.getByRole("button", { name: "Créer un contact" }).click();
  await page.getByLabel("Nom").fill("Contact test suppression");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Contact créé !").click();

  // Vérifier que les données ont bien été créées
  const personCount = await client.query(`SELECT count(*)::int as count FROM mano."Person" WHERE organisation = $1`, [orgId]);
  expect(personCount.rows[0].count).toBeGreaterThan(0);
  const actionCount = await client.query(`SELECT count(*)::int as count FROM mano."Action" WHERE organisation = $1`, [orgId]);
  expect(actionCount.rows[0].count).toBeGreaterThan(0);
  const territoryCount = await client.query(`SELECT count(*)::int as count FROM mano."Territory" WHERE organisation = $1`, [orgId]);
  expect(territoryCount.rows[0].count).toBeGreaterThan(0);
  const structureCount = await client.query(`SELECT count(*)::int as count FROM mano."Structure" WHERE organisation = $1`, [orgId]);
  expect(structureCount.rows[0].count).toBeGreaterThan(0);

  // Naviguer vers les paramètres de l'organisation
  await page.getByRole("link", { name: "Organisation" }).click();

  // Supprimer l'organisation
  await page.getByRole("button", { name: "Supprimer" }).click();
  await page.getByPlaceholder(orgName).fill(orgName);
  await page.locator(`[data-test-id="button-delete-${orgName}"]`).click();

  // Après suppression, l'utilisateur est déconnecté et redirigé
  await expect(page).toHaveURL("http://localhost:8090/auth", { timeout: 10000 });

  // Vérifier que TOUTES les données de l'organisation sont supprimées en dur (pas de soft delete)
  const tables = [
    { table: "Organisation", column: "_id" },
    { table: "User", column: "organisation" },
    { table: "Team", column: "organisation" },
    { table: "RelUserTeam", column: "organisation" },
    { table: "Person", column: "organisation" },
    { table: "Action", column: "organisation" },
    { table: "Comment", column: "organisation" },
    { table: "Territory", column: "organisation" },
    { table: "TerritoryObservation", column: "organisation" },
    { table: "Structure", column: "organisation" },
    { table: "Passage", column: "organisation" },
    { table: "Rencontre", column: "organisation" },
    { table: "Consultation", column: "organisation" },
    { table: "MedicalFile", column: "organisation" },
    { table: "Treatment", column: "organisation" },
    { table: "Report", column: "organisation" },
    { table: "Place", column: "organisation" },
    { table: "RelPersonPlace", column: "organisation" },
    { table: "Service", column: "organisation" },
    { table: "Group", column: "organisation" },
    { table: "Recurrence", column: "organisation" },
    // { table: "UserLog", column: "organisation" }, NO: we WANT the logs to be kept for debugging purposes
    { table: "OrganisationLog", column: "organisation" },
  ];

  for (const { table, column } of tables) {
    const result = await client.query(`SELECT count(*)::int as count FROM mano."${table}" WHERE "${column}" = $1`, [orgId]);
    expect(result.rows[0].count, `La table ${table} ne devrait plus contenir de données pour cette organisation`).toBe(0);
  }

  await client.end();
});
