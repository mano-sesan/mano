import { test, expect } from "@playwright/test";
import { populate } from "./scripts/populate-db";
import { changeReactSelectValue } from "./utils";

test.beforeAll(async () => {
  await populate();
});

test("test", async ({ page }) => {
  await page.goto("http://localhost:8090/auth");
  await page.getByLabel("Email").click();
  await page.getByLabel("Email").fill("admin1@example.org");
  await page.getByLabel("Email").press("Tab");
  await page.getByLabel("Mot de passe").fill("secret");
  await page.getByLabel("Mot de passe").press("Enter");
  await page.locator("#orgEncryptionKey").pressSequentially("plouf");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("button", { name: "Créer une personne" }).click();
  await page.getByLabel("Nom").click();
  await page.getByLabel("Nom").fill("test");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("link", { name: "Agenda" }).click();
  await page.getByRole("button", { name: "Créer une consultation" }).click();
  await changeReactSelectValue(page, "create-consultation-person-select", "test");
  await changeReactSelectValue(page, "consultation-modal-type", "Médicale");

  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Consultation Médicale", { exact: true }).click();
  await page.getByRole("button", { name: "Fermer" }).first().click();
  await page.getByText("Consultation Médicale").click();
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.getByLabel("Nom (facultatif)").fill("Avec un nom");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByRole("cell", { name: "Avec un nom Médicale" }).click();
  await page.getByRole("button", { name: "Historique" }).click();
  await page.locator('[data-test-id="Nom\\: \\"\\" ➔ \\"Avec un nom\\""]').click();
});
