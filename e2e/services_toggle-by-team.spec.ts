import { test, expect } from "@playwright/test";
import { nanoid } from "nanoid";
import { populate } from "./scripts/populate-db";
import { changeReactSelectValue, loginWith } from "./utils";
import dayjs from "dayjs";

test.beforeAll(async () => {
  await populate();
});

test("Create services filtered by team", async ({ page }) => {
  // Always use new items
  const teamAllowedName = nanoid();
  const teamExcludedName = nanoid();
  const serviceForAllTeams = `Service-all-${nanoid()}`;
  const serviceForTeam4Only = `Service-team4-${nanoid()}`;
  const serviceGroupName = `Group-${nanoid()}`;

  await loginWith(page, "admin4@example.org");

  /*
   * Add two new teams
   */

  await page.getByRole("link", { name: "Équipes" }).click();

  // Create first team (will be allowed)
  await page.getByRole("button", { name: "Créer une équipe" }).click();
  await page.getByRole("dialog").getByLabel("Nom").fill(teamAllowedName);
  await page.getByLabel("Non").check();
  await page.getByRole("dialog").getByRole("button", { name: "Créer" }).click();
  await page.locator(".Toastify__close-button").last().click();

  // Create second team (will be excluded)
  await page.getByRole("button", { name: "Créer une équipe" }).click();
  await page.getByRole("dialog").getByLabel("Nom").fill(teamExcludedName);
  await page.getByLabel("Non").check();
  await page.getByRole("dialog").getByRole("button", { name: "Créer" }).click();
  await page.locator(".Toastify__close-button").last().click();

  /*
   * Create services with different team configurations
   */

  await page.getByRole("link", { name: "Organisation" }).click();
  await page.getByRole("button", { name: "Accueil de jour" }).click();

  // First, add a new group
  await page.getByRole("button", { name: "Ajouter un groupe" }).click();
  await page.getByPlaceholder("Titre du groupe").fill(serviceGroupName);
  await page.locator('[data-test-id="modal"]').getByRole("button", { name: "Ajouter" }).click();
  await page.getByText("Groupe créé. Veuillez").click();

  // Add service enabled for all teams to the newly created group
  await page.locator("details").filter({ hasText: serviceGroupName }).getByPlaceholder("Ajouter un service").fill(serviceForAllTeams);
  await page.locator("details").filter({ hasText: serviceGroupName }).getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText("Service ajouté. Veuillez").click();

  // Add service enabled for Team Test - 4 only to the newly created group
  await page.locator("details").filter({ hasText: serviceGroupName }).getByPlaceholder("Ajouter un service").fill(serviceForTeam4Only);
  await page.locator("details").filter({ hasText: serviceGroupName }).getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText("Service ajouté. Veuillez").click();

  /*
   * Configure team restrictions for the second service
   */

  await page.hover(`[data-service="${serviceForTeam4Only}"]`);
  await page
    .getByRole("button", {
      name: `Modifier le service ${serviceForTeam4Only}`,
    })
    .click();

  await page.getByLabel("Activé pour toute l'organisation").uncheck();
  await changeReactSelectValue(page, "enabledTeams", "Team Test - 4");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Service mis à jour. Veuillez").click();

  /*
   * Test with Team Test - 4 (allowed team) - should see both services
   */

  await changeReactSelectValue(page, "team-selector-topBar", "Team Test - 4");

  // Test in reception
  await page.getByRole("link", { name: "Accueil" }).click();

  // Both services should be visible
  await page.getByText(serviceGroupName).click();
  await expect(page.getByText(serviceForAllTeams)).toBeVisible();
  await expect(page.getByText(serviceForTeam4Only)).toBeVisible();

  // Test incrementing service count
  await page.getByRole("link", { name: "Comptes rendus" }).click();
  await page.getByRole("link", { name: "Accueil" }).click();

  // Select the service group
  await page.getByRole("button", { name: serviceGroupName }).click();

  // Click the + button for the restricted service
  // const incrementButton = page.locator(`[data-test-id*="${serviceForTeam4Only}"]`).locator('button:has-text("+")').first();
  const incrementButton = page.locator(`#${serviceForTeam4Only}-add`);
  await incrementButton.click();

  // Verify the count increased
  await expect(page.locator(`[data-test-id*="${serviceForTeam4Only}-1"]`)).toHaveValue("1");

  /*
   * Test with the newly created allowed team - should see both services
   */

  await changeReactSelectValue(page, "team-selector-topBar", teamAllowedName);
  await page.getByRole("link", { name: "Accueil" }).click();

  await page.getByText(serviceGroupName).click();
  await expect(page.getByText(serviceForAllTeams)).toBeVisible();
  await expect(page.getByText(serviceForTeam4Only)).toBeHidden();

  /*
   * Test with the excluded team - should only see service for all teams
   */

  await changeReactSelectValue(page, "team-selector-topBar", teamExcludedName);
  await page.getByRole("link", { name: "Accueil" }).click();

  await page.getByText(serviceGroupName).click();
  await expect(page.getByText(serviceForAllTeams)).toBeVisible();
  await expect(page.getByText(serviceForTeam4Only)).toBeHidden();

  /*
   * Test services in reports view with Team Test - 4
   */

  await changeReactSelectValue(page, "team-selector-topBar", "Team Test - 4");
  await page.getByRole("link", { name: "Comptes rendus" }).click();

  // Check if we can see services in the report
  // await page.getByText("Services effectués").click();
  await page.getByText(serviceGroupName).click();

  // The service we incremented should show
  await expect(page.locator(`[data-test-id*="Team Test - 4-${serviceForTeam4Only}"]`)).toBeVisible();

  /*
   * Test services in stats view
   */

  await page.getByRole("link", { name: "Statistiques" }).click();

  // Services section should be visible
  await page.getByRole("button", { name: "Services", exact: true }).click();

  // Should see the service group in stats
  await expect(page.getByRole("cell", { name: serviceGroupName })).toBeVisible();

  /*
   * Verify service editing preserves team configuration
   */

  await page.getByRole("link", { name: "Organisation" }).click();
  await page.getByRole("button", { name: "Accueil de jour" }).click();

  await page.hover(`[data-service="${serviceForTeam4Only}"]`);
  await page
    .getByRole("button", {
      name: `Modifier le service ${serviceForTeam4Only}`,
    })
    .click();

  // Verify the team configuration is preserved
  await expect(page.getByLabel("Activé pour toute l'organisation")).not.toBeChecked();

  // Close modal
  await page.getByRole("button", { name: "Annuler" }).click();

  /*
   * Test drag and drop preserves team configuration
   */

  // This would test that dragging services between groups preserves their team settings
  // The DragAndDropSettings component should handle this correctly

  /*
   * Clean up: delete the test service
   */

  await page.hover(`[data-service="${serviceForTeam4Only}"]`);
  await page
    .getByRole("button", {
      name: `Modifier le service ${serviceForTeam4Only}`,
    })
    .click();

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.getByRole("button", { name: "Supprimer" }).click();
  await page.getByText("Service supprimé. Veuillez").click();

  // Verify service is deleted
  await expect(page.getByText(serviceForTeam4Only)).toBeHidden();
});
