import { test, expect } from "@playwright/test";
import { populate } from "./scripts/populate-db";
import { loginWith } from "./utils";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/fr";

dayjs.extend(utc);
dayjs.locale("fr");
test.beforeAll(async () => {
  await populate();
});

test("Transfer territory", async ({ page }) => {
  await loginWith(page, "admin1@example.org");

  // Create two territories
  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByRole("button", { name: "Créer un territoire" }).click();
  await page.getByLabel("Nom").fill("ancien territoire");
  await page.getByLabel("Périmètre").click();
  await page.getByLabel("Périmètre").fill("ancien périmètre");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();

  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByRole("button", { name: "Créer un territoire" }).click();
  await page.getByLabel("Nom").fill("nouveau territoire");
  await page.getByLabel("Périmètre").click();
  await page.getByLabel("Périmètre").fill("nouveau périmètre");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();

  // Create observations in the old territory
  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByRole("cell", { name: "ancien territoire" }).click();

  // Create first observation
  await page.getByRole("button", { name: "Nouvelle observation" }).click();
  await page.getByLabel("Nombre de personnes non connues hommes rencontrées").click();
  await page.getByLabel("Nombre de personnes non connues hommes rencontrées").fill("10");
  await page.getByLabel("Nombre de personnes non connues femmes rencontrées").click();
  await page.getByLabel("Nombre de personnes non connues femmes rencontrées").fill("5");
  await page.getByRole("dialog").getByLabel("Commentaire").fill("Première observation");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();

  // Create second observation
  await page.getByRole("button", { name: "Nouvelle observation" }).click();
  await page.getByLabel("Nombre de personnes non connues hommes rencontrées").click();
  await page.getByLabel("Nombre de personnes non connues hommes rencontrées").fill("20");
  await page.getByLabel("Nombre de personnes non connues femmes rencontrées").click();
  await page.getByLabel("Nombre de personnes non connues femmes rencontrées").fill("15");
  await page.getByRole("dialog").getByLabel("Commentaire").fill("Deuxième observation");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();

  // Verify observations are present
  await expect(page.getByText("Première observation")).toBeVisible();
  await expect(page.getByText("Commentaire: Deuxième observation")).toBeVisible();

  // Transfer territory data
  await page.getByRole("button", { name: "Transférer les données vers" }).click();
  await page.locator(".transfer-data-selected-territory__indicator").click();
  await page.locator("#react-select-territory-option-0").click();
  page.once("dialog", (dialog) => {
    console.log(`Dialog message: ${dialog.message()}`);
    dialog.accept();
  });
  await page.locator('[data-test-id="modal"]').getByRole("button", { name: "Transférer" }).click();

  await page.getByPlaceholder("nouveau territoire").fill("nouveau territoire");
  await page.locator('[data-test-id="button-delete-nouveau territoire"]').click();

  await page.getByText("Données transférées avec succès").click();

  // Verify the old territory is deleted
  await page.getByRole("link", { name: "Territoires" }).click();
  await expect(page.getByRole("cell", { name: "ancien territoire" })).not.toBeVisible();
  await expect(page.getByRole("cell", { name: "nouveau territoire" })).toBeVisible();

  // Verify observations were transferred
  await page.getByRole("cell", { name: "nouveau territoire" }).click();
  await expect(page.getByText("Première observation")).toBeVisible();
  await expect(page.getByText("Deuxième observation")).toBeVisible();
});
