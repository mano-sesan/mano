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

test("Replace me", async ({ page }) => {
  await loginWith(page, "admin1@example.org");

  await page.getByRole("link", { name: "Équipes" }).click();
  await page.getByRole("button", { name: "Créer une équipe" }).click();
  await page.getByLabel("Nom").click();
  await page.getByLabel("Nom").fill("autre équipe");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("button", { name: "Créer une personne" }).click();
  await page.getByLabel("Nom").fill("Toto");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByRole("button", { name: "Créer un territoire" }).click();
  await page.getByLabel("Nom").fill("mon territoire");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();

  await page.getByRole("link", { name: "Comptes rendus" }).click();
  await page.getByRole("button", { name: "Passer les passages en plein" }).click();
  await page.getByRole("button", { name: "Ajouter un passage" }).click();
  await page.getByLabel("Passage(s) anonyme(s) Cochez").check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Passages enregistrés !").click();
  await page.getByText("Fermer").click();

  await page
    .locator("div")
    .filter({ hasText: /^Café-\+$/ })
    .getByLabel("plus")
    .click();
  await page.getByRole("button", { name: "Passer les rencontres en" }).click();
  await page.getByRole("button", { name: "Ajouter une rencontre" }).click();
  await page.locator(".person__input-container").click();
  await page.getByLabel("Personnes(s) suivie(s)").fill("toto");
  await page.getByLabel("Personnes(s) suivie(s)").press("Enter");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByLabel("Fermer").first().click();
  await page.getByRole("link", { name: "Comptes rendus" }).click();
  await page.getByRole("button", { name: "Passer les observations en" }).click();
  await page.getByRole("button", { name: "Ajouter une observation" }).click();
  await page.getByLabel("Nombre de personnes non connues hommes rencontrées").fill("1");
  await page.locator(".observation-select-territory__indicator").click();
  await page.getByText("mon territoire", { exact: true }).click();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByRole("alert").click();
  await page.getByText("Fermer").click();

  await page.locator(".report-select-collaboration-Team-Test---12024-07-15__indicator").click();
  await page.locator("#report-select-collaboration-Team-Test---12024-07-15").fill("de");
  await page.getByText('Créer "de"').click();
  await page.getByText("Collaboration créée !").click();
  await page.getByRole("button", { name: "Ajouter une transmission" }).click();
  await page.getByPlaceholder("Entrez ici votre transmission").click();
  await page.getByPlaceholder("Entrez ici votre transmission").fill("tout va bien");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // TODO: action consultation commentaires
});
