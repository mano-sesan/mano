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

test("Transfer team", async ({ page }) => {
  await loginWith(page, "admin1@example.org");
  await page.getByRole("link", { name: "Équipes" }).click();
  await page.getByRole("button", { name: "Créer une équipe" }).click();
  await page.getByLabel("Nom").fill("ancienne");
  await page.getByText("Non").click();
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("button", { name: "Créer une équipe" }).click();
  await page.getByLabel("Nom").fill("nouvelle");
  await page.getByText("Non").click();
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await page.getByText("Création réussie !").click();
  // Personne suivie
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("button", { name: "Créer une personne" }).click();
  await page.getByLabel("Nom").fill("personne test");
  await page.locator(".person-select-assigned-team__input-container").click();
  await page.getByText("ancienne", { exact: true }).click();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  // Action avec commentaire
  await page.getByLabel("Ajouter une action").click();
  await page.getByLabel("Nom de l'action").click();
  await page.getByLabel("Nom de l'action").fill("action test");
  await page.locator(".create-action-team-select__indicator").click();
  await page.locator("#react-select-name-option-1").click();
  await page.getByRole("button", { name: "Commentaires" }).click();
  await page.getByRole("button", { name: "＋ Ajouter un commentaire" }).click();
  await page.getByLabel("Créé le / Concerne le").click();
  await page
    .locator("div")
    .filter({ hasText: /^Commentaire$/ })
    .locator("div")
    .first()
    .click();
  await page.getByLabel("Commentaire", { exact: true }).fill("commentaire test");
  await page.locator(".observation-select-team__indicator").click();
  await page.locator("#react-select-team-option-1").click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  // Passage
  await page.getByLabel("Ajouter un passage").click();
  await page.locator(".update-passage-team-select__indicator").click();
  await page.locator("#react-select-8-option-1").click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Passage enregistré").click();
  // Rencontre
  await page.getByRole("button", { name: "Rencontres (0)" }).click();
  await page.getByLabel("Ajouter une rencontre").click();
  await page.locator(".update-rencontre-team-select__indicator").click();
  await page.locator("#react-select-9-option-1").click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Rencontre enregistrée").click();
  // Consultation
  await page.getByRole("button", { name: "Dossier Médical" }).click();
  await page.getByLabel("Ajouter une consultation").click();
  await page.locator(".create-consultation-team-select__indicator").click();
  await page.locator("#react-select-name-option-1").click();
  await page.locator(".consultation-modal-type__indicator").click();
  await page.getByText("Médicale", { exact: true }).click();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  // Territoire
  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByRole("button", { name: "Créer un territoire" }).click();
  await page.getByLabel("Nom").click();
  await page.getByLabel("Nom").fill("terter");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("button", { name: "Nouvelle observation" }).click();
  await page.getByLabel("Nombre de personnes non connues hommes rencontrées").click();
  await page.getByLabel("Nombre de personnes non connues hommes rencontrées").fill("123");
  await page.locator(".observation-select-team__indicator").click();
  await page.getByText("ancienne", { exact: true }).click();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  // Comptes rendus
  await page.getByRole("link", { name: "Comptes rendus" }).click();
  // On ajoute d'abord une transmission dans l'équipe nouvelle pour vérifier la fusion
  await page.getByLabel("Remove Team Test -").click();
  await page.locator(".report-team-select__indicator").click();
  await page.getByText("nouvelle", { exact: true }).click();
  await page.getByRole("button", { name: "Ajouter une transmission" }).click();
  await page.getByPlaceholder("Entrez ici votre transmission").click();
  await page.getByPlaceholder("Entrez ici votre transmission").fill("ligne1");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // Puis on refait une transmission sur l'ancienne équipe
  await page.getByLabel("Remove nouvelle").click();
  await page.locator(".report-team-select__indicator").click();
  await page.getByText("ancienne", { exact: true }).click();
  await page
    .locator("div")
    .filter({ hasText: /^Café-\+$/ })
    .getByLabel("plus")
    .click();
  await page.locator("#Douche-add").click();
  await page.getByRole("button", { name: "Ajouter une transmission" }).click();
  await page.getByPlaceholder("Entrez ici votre transmission").click();
  await page.getByPlaceholder("Entrez ici votre transmission").fill("ligne2");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // Utilisateurs
  await page.getByRole("link", { name: "Utilisateurs" }).click();
  await page.getByRole("button", { name: "Créer un utilisateur" }).click();
  await page.getByPlaceholder("email@truc.fr").click();
  await page.getByPlaceholder("email@truc.fr").fill("test@example.org");
  await page.getByLabel("Remove Team Test -").click();
  await page.getByLabel("Remove nouvelle").click();
  await page.getByRole("button", { name: "Créer et fermer" }).click();
  await page.getByText("Création réussie !").click();

  // Transfert
  await page.getByRole("link", { name: "Équipes" }).click();
  await page.getByRole("cell", { name: "ancienne" }).click();
  await page.getByRole("button", { name: "Transférer les données vers" }).click();
  await page.locator(".transfer-data-selected-team__indicator").click();
  await page.getByText("nouvelle", { exact: true }).click();
  page.once("dialog", (dialog) => {
    console.log(`Dialog message: ${dialog.message()}`);
    dialog.accept();
  });
  await page.locator('[data-test-id="modal"]').getByRole("button", { name: "Transférer" }).click();

  await page.getByPlaceholder("nouvelle").fill("nouvelle");
  await page.locator('[data-test-id="button-delete-nouvelle"]').click();

  await page.getByText("Données transférées avec succès").click();

  // Vérification
  await page.getByRole("link", { name: "Comptes rendus" }).click();
  await page.locator(".report-team-select__indicator").click();
  await page.getByText("nouvelle", { exact: true }).nth(1).click();
  await page.getByText("1passagePassages (1)Ajouter").click();
  await page.getByText("1rencontreRencontres (1)").click();
  await page.getByText("1personne crééePersonnes créé").click();
  await page.getByText("1observationObservations de").click();
  await page.getByRole("group").getByText("ligne1ligne2").click();
  await page.getByRole("button", { name: "Actions (1)" }).click();
  await page.getByRole("button", { name: "Consultations (1)" }).click();
  await page.locator('[data-test-id="nouvelle-Café-1"]').click();
  await page.locator('[data-test-id="nouvelle-Douche-1"]').click();
  await page.getByRole("button", { name: "Commentaires (1)" }).click();
  await page.getByRole("link", { name: "Utilisateurs" }).click();
  await page.getByText("test@example.org").click();
  await page.getByText("nouvelle").nth(1).click();
});
