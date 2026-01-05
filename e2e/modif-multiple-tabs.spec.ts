import { test, expect } from "@playwright/test";
import { nanoid } from "nanoid";
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

test("Modifications in multiple tabs should sync correctly", async ({ context }) => {
  const page = await context.newPage();

  // Création de deux personnes
  const personNameA = nanoid();
  const personNameB = nanoid();

  await loginWith(page, "admin1@example.org");
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("button", { name: "Créer une personne" }).click();
  await page.getByLabel("Nom").fill(personNameA);
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("button", { name: "Créer une personne" }).click();
  await page.getByLabel("Nom").fill(personNameB);
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();

  // Modification de la première personne dans un autre tab
  const pageTwo = await context.newPage();
  await pageTwo.goto("http://localhost:8090/auth");
  await pageTwo.locator("#orgEncryptionKey").pressSequentially("plouf");
  await pageTwo.getByRole("button", { name: "Se connecter" }).click();
  await pageTwo.getByRole("link", { name: "Personnes suivies" }).click();
  await pageTwo.getByRole("cell", { name: personNameA, exact: true }).click();
  await pageTwo.getByRole("button", { name: "Modifier" }).click();
  await pageTwo.getByLabel("Nom prénom ou Pseudonyme").fill(`${personNameA} modifié`);
  await pageTwo.getByRole("button", { name: "Enregistrer" }).click();

  // Vérification que la modification a été appliquée dans le premier tab
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await expect(page.getByRole("cell", { name: `${personNameA} modifié`, exact: true })).toBeVisible();

  // Modification de la deuxième personne dans le premier tab
  await page.getByRole("cell", { name: personNameB, exact: true }).click();
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.getByLabel("Nom prénom ou Pseudonyme").fill(`${personNameB} modifié`);
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // Vérification que la modification a été appliquée dans le deuxième tab
  await pageTwo.getByRole("link", { name: "Personnes suivies" }).click();
  await expect(pageTwo.getByRole("cell", { name: `${personNameB} modifié`, exact: true })).toBeVisible();

  // Fermeture de la deuxième page
  await pageTwo.close();
  await page.close();

  // Ouverture d'une nouvelle page, connexion et vérification que les modifications sont appliquées
  const pageThree = await context.newPage();
  await pageThree.goto("http://localhost:8090/auth");
  await pageThree.locator("#orgEncryptionKey").pressSequentially("plouf");
  await pageThree.getByRole("button", { name: "Se connecter" }).click();
  await pageThree.getByRole("link", { name: "Personnes suivies" }).click();
  await expect(pageThree.getByRole("cell", { name: `${personNameA} modifié`, exact: true })).toBeVisible();
  await expect(pageThree.getByRole("cell", { name: `${personNameB} modifié`, exact: true })).toBeVisible();
  await pageThree.close();
});
