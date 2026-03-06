import { test, expect } from "@playwright/test";
import { populate } from "./scripts/populate-db";
import { changeReactSelectValue, loginWith } from "./utils";
import pg from "pg";

test.beforeAll(async () => {
  await populate();
});

async function loginAsSuperadmin(page) {
  await page.goto("http://localhost:8090/auth");
  await page.getByLabel("Email").fill("superadmin@example.org");
  await page.getByLabel("Mot de passe").fill("secret");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("button", { name: "Fusionner deux orgas" })).toBeVisible();
}

async function attemptMerge(page, mainOrgLabel: string, secondaryOrgLabel: string, passphrase: string) {
  await page.getByRole("button", { name: "Fusionner deux orgas" }).click();
  await changeReactSelectValue(page, "organisation-merge-main", mainOrgLabel);
  await changeReactSelectValue(page, "organisation-merge-secondary", secondaryOrgLabel);
  await page.locator("input.tailwindui").fill(passphrase);
  page.once("dialog", async (dialog) => await dialog.accept());
  await page.getByRole("button", { name: "Valider" }).click();
}

async function changeEncryptionKey(page, passphrase: string) {
  await page.getByRole("link", { name: "Organisation" }).click();
  await page.getByRole("button", { name: "Chiffrement" }).click();
  await page.getByRole("button", { name: "Changer la clé de chiffrement" }).click();
  await page.locator('[data-test-id="encryption-modal"]').getByLabel("Clé de chiffrement", { exact: true }).fill(passphrase);
  await page.locator('[data-test-id="encryption-modal"]').getByLabel("Confirmez la clé de chiffrement").fill(passphrase);
  await page.locator('[data-test-id="encryption-modal"]').getByRole("button", { name: "Changer la clé de chiffrement" }).click();
  await page.getByText("Données chiffrées ! Veuillez noter la clé puis vous reconnecter").click();
}

// On utilise les orgas 3, 4 et 5 pour ne pas interférer avec les autres tests.
// Les orgas créées par populate() ont toutes encryptionEnabled=true, passphrase="plouf", et customSalt=false.

test.describe.serial("Fusion d'organisations - edge cases de sel de chiffrement", () => {
  test("Fusion bloquée avec mauvaise clé de chiffrement", async ({ page }) => {
    await loginAsSuperadmin(page);
    await attemptMerge(page, "Orga Test - 3 (Id: undefined)", "Orga Test - 4 (Id: undefined)", "mauvaise_cle");
    await expect(page.getByText("La clé de l'organisation principale n'est pas valide")).toBeVisible();
  });

  test("Activer customSalt sur l'orga 3 en changeant sa clé de chiffrement", async ({ page }) => {
    await loginWith(page, "admin3@example.org");
    await changeEncryptionKey(page, "plouf");
  });

  test("Fusion bloquée : orga principale avec customSalt, secondaire sans", async ({ page }) => {
    await loginAsSuperadmin(page);
    // Orga 3 a maintenant customSalt=true, orga 4 non
    await attemptMerge(page, "Orga Test - 3 (Id: undefined)", "Orga Test - 4 (Id: undefined)", "plouf");
    // La vérification de l'orga secondaire doit échouer car les sels sont différents
    await expect(page.getByText("ne correspond pas")).toBeVisible({ timeout: 10000 });
  });

  test("Fusion bloquée : orga principale sans customSalt, secondaire avec", async ({ page }) => {
    await loginAsSuperadmin(page);
    // Orga 4 n'a pas customSalt, orga 3 en a
    await attemptMerge(page, "Orga Test - 4 (Id: undefined)", "Orga Test - 3 (Id: undefined)", "plouf");
    // La clé de l'orga principale est vérifiée avec le sel par défaut (OK),
    // mais l'orga secondaire (3) a été chiffrée avec un sel personnalisé -> échec
    await expect(page.getByText("ne correspond pas")).toBeVisible({ timeout: 10000 });
  });

  test("Activer customSalt sur l'orga 5 en changeant sa clé de chiffrement", async ({ page }) => {
    await loginWith(page, "admin5@example.org");
    await changeEncryptionKey(page, "plouf");
  });

  test("Fusion bloquée : deux orgas avec customSalt mais sels différents", async ({ page }) => {
    await loginAsSuperadmin(page);
    // Orga 3 et 5 ont customSalt=true mais des orgIds différents donc des sels différents
    await attemptMerge(page, "Orga Test - 3 (Id: undefined)", "Orga Test - 5 (Id: undefined)", "plouf");
    await expect(page.getByText("ne correspond pas")).toBeVisible({ timeout: 10000 });
  });

  test("Configurer mergeWithOrgId sur l'orga 5 et réaligner la clé", async ({ page }) => {
    // Récupérer l'ID de l'orga 3
    const client = new pg.Client({ connectionString: `${process.env.PGBASEURL}/manotest` });
    await client.connect();
    const res = await client.query(`SELECT _id FROM mano."Organisation" WHERE name = 'Orga Test - 3'`);
    const org3Id = res.rows[0]._id;
    await client.query(`UPDATE mano."Organisation" SET "mergeWithOrgId" = $1 WHERE name = 'Orga Test - 5'`, [org3Id]);
    await client.end();

    // L'admin de l'orga 5 doit changer la clé pour dériver avec le nouveau sel (celui de l'orga 3)
    await loginWith(page, "admin5@example.org");
    await changeEncryptionKey(page, "plouf");
  });

  test("Fusion bloquée : orga principale avec mergeWithOrgId configuré", async ({ page }) => {
    await loginAsSuperadmin(page);
    // Orga 5 a mergeWithOrgId → ne peut pas être l'org principale
    await attemptMerge(page, "Orga Test - 5 (Id: undefined)", "Orga Test - 3 (Id: undefined)", "plouf");
    await expect(page.getByText("mergeWithOrgId")).toBeVisible({ timeout: 10000 });
  });

  test("Fusion réussie : deux orgas avec customSalt et même sel via mergeWithOrgId", async ({ page }) => {
    await loginAsSuperadmin(page);
    // Orga 3 (main, sans mergeWithOrgId) et orga 5 (secondary, mergeWithOrgId → orga 3) ont le même sel
    await attemptMerge(page, "Orga Test - 3 (Id: undefined)", "Orga Test - 5 (Id: undefined)", "plouf");
    await expect(page.getByText("Fusion réussie")).toBeVisible({ timeout: 15000 });
  });
});
