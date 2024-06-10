import { test, expect } from "@playwright/test";
import { populate } from "./scripts/populate-db";
import { loginWith } from "./utils";

test.beforeAll(async () => {
  await populate();
});

test("Try to login and fail", async ({ page }) => {
  await loginWith(page, "admin1@example.org");
  await page.getByRole("button", { name: "Verrouiller/Recharger" }).click();
  await page.getByRole("heading", { name: "Veuillez saisir votre clé de" }).click();
  await expect(page.locator('[data-test-id="lock-modal"]')).toBeVisible();
  await page.locator('[data-test-id="lock-modal"]').getByLabel("Clé de chiffrement d'organisation").click();
  await page.locator('[data-test-id="lock-modal"]').getByLabel("Clé de chiffrement d'organisation").fill("lol");
  await page.getByRole("button", { name: "Se reconnecter" }).click();
  await page.getByText("Clé de chiffrement invalide").click();
  await page.locator('[data-test-id="lock-modal"]').getByLabel("Clé de chiffrement d'organisation").click();
  await page.locator('[data-test-id="lock-modal"]').getByLabel("Clé de chiffrement d'organisation").fill("plouf");
  await page.getByRole("button", { name: "Se reconnecter" }).click();
  await expect(page.locator('[data-test-id="lock-modal"]')).not.toBeVisible();
});
