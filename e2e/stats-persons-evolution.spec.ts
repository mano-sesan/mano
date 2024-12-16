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

test("Stats changement des personnes", async ({ page }) => {
  // On est en 2020
  await page.clock.setFixedTime(new Date("2020-02-01T00:00:00Z"));
  await loginWith(page, "admin1@example.org");

  // La personne est d'abord un homme isolé (en février 2020)
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("button", { name: "Créer une personne" }).click();
  await page.getByLabel("Nom").fill("Personne Test");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.locator('[data-test-id="modal"]').getByText("Informations sociales").click();
  await page.locator(".person-custom-select-situation-personnelle__indicator").click();
  await page.getByText("Homme isolé", { exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mis à jour !").click();

  // On passe en 2021 (un an plus tard)
  await page.clock.setFixedTime(new Date("2021-02-01T00:00:00Z"));
  await page.getByRole("button", { name: "User Admin Test - 1" }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter", exact: true }).click();
  await loginWith(page, "admin1@example.org");

  // La personne devient une femme isolée (en février 2021)
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByText("Personne Test").click();
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.locator('[data-test-id="modal"]').getByText("Informations sociales").click();
  await page.locator(".person-custom-select-situation-personnelle__input-container").click();
  await page.getByText("Femme isolée", { exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mis à jour !").click();

  // On vérifie l'historique
  await page.getByRole("button", { name: "Historique" }).click();
  await page.getByText("/02/2020").click();
  await page.getByText("/02/2021").click();
  await page.getByRole("link", { name: "Statistiques" }).click();

  // Maintenant on vérifie dans les statistiques.
  // Note de Raph : ça me parait un peu incohérent mais ça semble être le comportement actuel
  await page.getByRole("button", { name: "Entre... et le..." }).click();
  await page.getByRole("button", { name: "2020" }).click();
  await page.getByRole("button", { name: "Personnes suivies", exact: true }).click();
  await page.locator('[data-test-id="nombre-de-personnes-suivies-1"]').click();
  await page.getByRole("button", { name: "+ Ajouter un filtre" }).click();
  await page.locator(".filter-field-1__input-container").click();
  await page.locator("#filter-field-1").fill("Situation personnelle");
  await page.locator("#react-select-10-option-23").click();
  await page.locator(".filter-value-1__indicator").click();
  await page.locator("#react-select-12-option-1").click();
  await page.locator('[data-test-id="nombre-de-personnes-suivies-1"]').click();
  await page.getByLabel("Remove Homme isolé").click();
  await page.locator(".filter-value-1__indicator").click();
  await page.locator("#react-select-12-option-8").click();
  await page.getByLabel("Remove Non renseigné").click();
  await page.getByRole("button", { name: "2020" }).click();
  await page.getByRole("button", { name: "2021" }).click();
  await page.locator(".filter-value-1__indicator").click();
  await page.locator("#react-select-12-option-2").click();
  await page.locator('[data-test-id="nombre-de-personnes-suivies-1"]').click();
  await page.getByLabel("Remove Femme isolée").click();
  await page.locator(".filter-value-1__indicator").click();
  await page.locator("#react-select-12-option-1").click();
  await page.locator('[data-test-id="nombre-de-personnes-suivies-0"]').click();
});
