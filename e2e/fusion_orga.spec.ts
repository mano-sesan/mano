import { test, expect } from "@playwright/test";
import { populate } from "./scripts/populate-db";
import { changeReactSelectValue, loginWith } from "./utils";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/fr";

dayjs.extend(utc);
dayjs.locale("fr");
test.beforeAll(async () => {
  await populate();
});

test("Remplissage de la première organisation", async ({ page }) => {
  await loginWith(page, "admin1@example.org");
  await page.locator(".person-select-and-create-reception__input-container").click();
  await page.locator("#person-select-and-create-reception").fill("test");
  await page.getByText('Créer "test"').click();
  await page.getByText("Nouvelle personne ajoutée !").click();
  await page.getByRole("button", { name: "Passage", exact: true }).click();
  await page.getByRole("button", { name: "Passage anonyme" }).click();
  await page.getByRole("button", { name: "Action" }).click();
  await page.getByLabel("Nom de l'action").fill("test");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("button", { name: "Consultation" }).click();
  await page.locator(".consultation-modal-type__input-container").click();
  await page.getByText("Médicale", { exact: true }).click();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByRole("button", { name: "Créer un territoire" }).click();
  await page.getByLabel("Nom").fill("territoire orga 1");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("link", { name: "Contacts", exact: true }).click();
  await page.getByRole("button", { name: "Créer un contact" }).click();
  await page.getByLabel("Nom").fill("contact orga 1");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Contact créé !").click();
  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByText("territoire orga").click();
  await page.getByRole("button", { name: "Nouvelle observation" }).click();
  await page.getByRole("button", { name: "Rencontres" }).click();
  await page.getByRole("button", { name: "+ Rencontre" }).click();
  await page.locator('[data-test-id="modal-rencontre-create-edit-delete"]').locator(".person__input-container").click();
  await page.getByText("test", { exact: true }).click();
  await page.locator('[data-test-id="modal-rencontre-create-edit-delete"]').getByLabel("Commentaire").fill("depuis orga 1");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByText("Les rencontres ont également").click();
  await page.getByRole("link", { name: "Équipes" }).click();
  await page.getByRole("button", { name: "Créer une équipe" }).click();
  await page.getByLabel("Nom").fill("team test orga 1");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("link", { name: "Utilisateurs" }).click();
  await page.getByRole("link", { name: "Organisation" }).click();
  await page.getByRole("button", { name: "Accueil de jour" }).click();
  await page.getByPlaceholder("Ajouter un service").click();
  await page.getByPlaceholder("Ajouter un service").fill("service orga 1");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText("Service ajouté. Veuillez").click();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByPlaceholder("Ajouter une catégorie").click();
  await page.getByPlaceholder("Ajouter une catégorie").fill("catégorie orga 1");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText("Catégorie ajoutée. Veuillez").click();
  await page.getByRole("button", { name: "Contacts", exact: true }).click();
  await page.getByPlaceholder("Ajouter une catégorie").click();
  await page.getByPlaceholder("Ajouter une catégorie").fill("catégorie orga 1");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText("Catégorie ajoutée. Veuillez").click();
  await page.getByRole("button", { name: "Territoires", exact: true }).click();
  await page.getByPlaceholder("Ajouter un type").click();
  await page.getByPlaceholder("Ajouter un type").fill("type de territoire orga 1");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText("Type de territoire ajouté.").click();
  await page.getByRole("button", { name: "Ajouter un champ" }).click();
  await page.locator('[data-test-id="modal"]').getByLabel("Nom").fill("champ orga1");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mise à jour !").click();
  await page.getByRole("button", { name: "Passages/rencontres" }).click();
  await page.getByRole("button", { name: "Consultations" }).click();
  await page.getByRole("button", { name: "Ajouter un champ" }).click();
  await page.getByLabel("Nom").fill("medical orga 1");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("button", { name: "Ajouter un type de" }).click();
  await page.getByText("Mise à jour !").click();
  await page.getByPlaceholder("Titre du groupe").click();
  await page.getByPlaceholder("Titre du groupe").fill("type orga 1");
  await page.locator('[data-test-id="modal"]').getByRole("button", { name: "Ajouter" }).click();
  await page.getByText("Type de consultation ajouté").click();
  await page.getByRole("button", { name: "Co-interventions" }).click();
  await page.getByPlaceholder("Ajouter une co-intervention").click();
  await page.getByPlaceholder("Ajouter une co-intervention").fill("collab orga 1");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText("Co-intervention ajoutée").click();
  await page.getByRole("button", { name: "Personnes suivies", exact: true }).click();
  await page.locator('[id="Informations\\ de\\ santé"]').getByRole("button", { name: "Ajouter un champ" }).click();
  await page.getByLabel("Nom").fill("champ orga 1");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mise à jour !").click();
  await page.getByRole("button", { name: "Ajouter un groupe de champs" }).click();
  await page.getByPlaceholder("Titre du groupe").fill("groupe orga 1");
  await page.locator('[data-test-id="modal"]').getByRole("button", { name: "Ajouter" }).click();
  await page.getByText("Groupe ajouté").click();
  await page.locator("details").filter({ hasText: "groupe orga 1 (0)✏️Aucun élé" }).getByRole("button").click();
  await page.getByLabel("Nom").fill("champ dans groupe orga 1");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mise à jour !").click();
  await page.getByRole("button", { name: "Dossier Médical" }).click();
  await page.getByRole("button", { name: "Ajouter un champ" }).click();
  await page.getByLabel("Nom").fill("numéro orga1");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mise à jour !").click();
  await page.getByRole("button", { name: "Ajouter un groupe de champs" }).click();
  await page.getByPlaceholder("Titre du groupe").fill("groupe orga1");
  await page.locator('[data-test-id="modal"]').getByRole("button", { name: "Ajouter" }).click();
  await page.getByText("Groupe ajouté").click();
  await page.locator("details").filter({ hasText: "groupe orga1 (0)✏️Aucun élé" }).getByRole("button").click();
  await page.getByLabel("Nom").fill("groupe orga 1 medic");
  await page.getByLabel("Nom").press("Enter");
  await page.getByText("Mise à jour !").click();
  await page.locator("details").filter({ hasText: "groupe orga1 (1)" }).getByRole("button").click();
  await page.getByLabel("Nom").fill("cham prga 1 medic");
  await page.getByLabel("Nom").press("Enter");
  await page.getByText("Mise à jour !").click();
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByText("test", { exact: true }).click();
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.locator('[data-test-id="modal"]').getByText("Informations de santé").click();
  await page.getByLabel("champ orga").click();
  await page.getByLabel("champ orga").fill("valeur orga 1");
  await page.locator('[data-test-id="modal"]').getByText("groupe orga").click();
  await page.getByLabel("champ dans groupe orga").click();
  await page.getByLabel("champ dans groupe orga").fill("valeur groupe 1");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mis à jour !").click();
  await page.getByRole("button", { name: "Dossier Médical" }).click();
  await page.getByLabel("Éditer les dossier médical").click();
  await page.getByLabel("numéro orga1").click();
  await page.getByLabel("numéro orga1").fill("numéro");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mis à jour !").click();
});

test("Remplissage de la deuxième organisation", async ({ page }) => {
  await loginWith(page, "admin2@example.org");
  await page.locator(".person-select-and-create-reception__input-container").click();
  await page.locator("#person-select-and-create-reception").fill("test orga 2");
  await page.getByText('Créer "test orga 2"').click();
  await page.getByText("Nouvelle personne ajoutée !").click();
  await page.getByRole("button", { name: "Passage", exact: true }).click();
  await page.getByRole("button", { name: "Passage anonyme" }).click();
  await page.getByRole("button", { name: "Action" }).click();
  await page.getByLabel("Nom de l'action").fill("test");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("button", { name: "Consultation" }).click();
  await page.locator(".consultation-modal-type__input-container").click();
  await page.getByText("Médicale", { exact: true }).click();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByRole("button", { name: "Créer un territoire" }).click();
  await page.getByLabel("Nom").fill("territoire orga 2");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("link", { name: "Contacts", exact: true }).click();
  await page.getByRole("button", { name: "Créer un contact" }).click();
  await page.getByLabel("Nom").fill("contact orga 2");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Contact créé !").click();
  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByText("territoire orga").click();
  await page.getByRole("button", { name: "Nouvelle observation" }).click();
  await page.getByRole("button", { name: "Rencontres" }).click();
  await page.getByRole("button", { name: "+ Rencontre" }).click();
  await page.locator('[data-test-id="modal-rencontre-create-edit-delete"]').locator(".person__input-container").click();
  await page.getByText("test orga 2", { exact: true }).click();
  await page.locator('[data-test-id="modal-rencontre-create-edit-delete"]').getByLabel("Commentaire").fill("depuis orga 2");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByText("Les rencontres ont également").click();
  await page.getByRole("link", { name: "Équipes" }).click();
  await page.getByRole("button", { name: "Créer une équipe" }).click();
  await page.getByLabel("Nom").fill("team test orga 2");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("link", { name: "Utilisateurs" }).click();
  await page.getByRole("link", { name: "Organisation" }).click();
  await page.getByRole("button", { name: "Accueil de jour" }).click();
  await page.getByPlaceholder("Ajouter un service").click();
  await page.getByPlaceholder("Ajouter un service").fill("service orga 2");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText("Service ajouté. Veuillez").click();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByPlaceholder("Ajouter une catégorie").click();
  await page.getByPlaceholder("Ajouter une catégorie").fill("catégorie orga 2");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText("Catégorie ajoutée. Veuillez").click();
  await page.getByRole("button", { name: "Contacts", exact: true }).click();
  await page.getByPlaceholder("Ajouter une catégorie").click();
  await page.getByPlaceholder("Ajouter une catégorie").fill("catégorie orga 2");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText("Catégorie ajoutée. Veuillez").click();
  await page.getByRole("button", { name: "Territoires", exact: true }).click();
  await page.getByPlaceholder("Ajouter un type").click();
  await page.getByPlaceholder("Ajouter un type").fill("type de territoire orga 2");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText("Type de territoire ajouté.").click();
  await page.getByRole("button", { name: "Ajouter un champ" }).click();
  await page.locator('[data-test-id="modal"]').getByLabel("Nom").fill("champ orga2");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mise à jour !").click();
  await page.getByRole("button", { name: "Passages/rencontres" }).click();
  await page.getByRole("button", { name: "Consultations" }).click();
  await page.getByRole("button", { name: "Ajouter un champ" }).click();
  await page.getByLabel("Nom").fill("medical orga 2");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("button", { name: "Ajouter un type de" }).click();
  await page.getByText("Mise à jour !").click();
  await page.getByPlaceholder("Titre du groupe").click();
  await page.getByPlaceholder("Titre du groupe").fill("type orga 2");
  await page.locator('[data-test-id="modal"]').getByRole("button", { name: "Ajouter" }).click();
  await page.getByText("Type de consultation ajouté").click();
  await page.getByRole("button", { name: "Co-interventions" }).click();
  await page.getByPlaceholder("Ajouter une co-intervention").click();
  await page.getByPlaceholder("Ajouter une co-intervention").fill("collab orga 2");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText("Co-intervention ajoutée").click();
  await page.getByRole("button", { name: "Personnes suivies", exact: true }).click();
  await page.locator('[id="Informations\\ de\\ santé"]').getByRole("button", { name: "Ajouter un champ" }).click();
  await page.getByLabel("Nom").fill("champ orga 2");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mise à jour !").click();
  await page.getByRole("button", { name: "Ajouter un groupe de champs" }).click();
  await page.getByPlaceholder("Titre du groupe").fill("groupe orga 2");
  await page.locator('[data-test-id="modal"]').getByRole("button", { name: "Ajouter" }).click();
  await page.getByText("Groupe ajouté").click();
  await page.locator("details").filter({ hasText: "groupe orga 2 (0)✏️Aucun élé" }).getByRole("button").click();
  await page.getByLabel("Nom").fill("champ dans groupe orga 2");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mise à jour !").click();
  await page.getByRole("button", { name: "Dossier Médical" }).click();
  await page.getByRole("button", { name: "Ajouter un champ" }).click();
  await page.getByLabel("Nom").fill("numéro orga2");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mise à jour !").click();
  await page.getByRole("button", { name: "Ajouter un groupe de champs" }).click();
  await page.getByPlaceholder("Titre du groupe").fill("groupe orga2");
  await page.locator('[data-test-id="modal"]').getByRole("button", { name: "Ajouter" }).click();
  await page.getByText("Groupe ajouté").click();
  await page.locator("details").filter({ hasText: "groupe orga2 (0)✏️Aucun élé" }).getByRole("button").click();
  await page.getByLabel("Nom").fill("groupe orga 2 medic");
  await page.getByLabel("Nom").press("Enter");
  await page.getByText("Mise à jour !").click();
  await page.locator("details").filter({ hasText: "groupe orga2 (1)✏️groupe orga" }).getByRole("button").click();
  await page.getByLabel("Nom").fill("cham prga 2 medic");
  await page.getByLabel("Nom").press("Enter");
  await page.getByText("Mise à jour !").click();
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByText("test orga 2", { exact: true }).click();
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.locator('[data-test-id="modal"]').getByText("Informations de santé").click();
  await page.getByLabel("champ orga").click();
  await page.getByLabel("champ orga").fill("valeur orga 2");
  await page.locator('[data-test-id="modal"]').getByText("groupe orga").click();
  await page.getByLabel("champ dans groupe orga").click();
  await page.getByLabel("champ dans groupe orga").fill("valeur groupe 2");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mis à jour !").click();
  await page.getByRole("button", { name: "Dossier Médical" }).click();
  await page.getByLabel("Éditer les dossier médical").click();
  await page.getByLabel("numéro orga2").click();
  await page.getByLabel("numéro orga2").fill("numéro");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mis à jour !").click();
});

test("Fusion des organisations", async ({ page }) => {
  await page.goto("http://localhost:8090/auth");
  await page.getByLabel("Email").fill("superadmin@example.org");
  await page.getByLabel("Mot de passe").fill("secret");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await page.getByRole("button", { name: "Fusionner deux orgas" }).click();
  await changeReactSelectValue(page, "organisation-merge-main", "Orga Test - 1 (Id: undefined)");
  await changeReactSelectValue(page, "organisation-merge-secondary", "Orga Test - 2 (Id: undefined)");

  await page.getByRole("textbox").fill("plouf");
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Valider" }).click();
  await page.getByText("Fusion réussie, vérifiez").click();
});

test("Vérification", async ({ page }) => {
  await loginWith(page, "admin1@example.org");
  await page.getByRole("button", { name: "Team Test -" }).click();
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByText("test orga").click();
  await page.getByRole("button", { name: "Passages (1)" }).click();
  await page.getByRole("button", { name: "Rencontres (1)" }).click();
  await page.getByRole("heading", { name: "Actions (1)" }).click();
  await page.getByRole("heading", { name: "Commentaires (1)" }).click();
  await page.getByText("champ orga 1").click();
  await page.getByText("champ orga 2 (fusion Orga").click();
  await page.getByRole("heading", { name: "groupe orga 1" }).click();
  await page.getByText("champ dans groupe orga 1").click();
  await page.getByRole("heading", { name: "groupe orga 2" }).click();
  await page.getByText("champ dans groupe orga 2").click();
  await page.getByText("valeur groupe").click();
  await page.getByRole("button", { name: "Dossier Médical" }).click();
  await page.getByRole("heading", { name: "Consultations (1)" }).click();
  await page.getByText("numéro orga1").click();
  await page.getByText("numéro orga2 (fusion Orga").click();
  await page.getByText("groupe orga 1 medic").click();
  await page.getByText("cham prga 1 medic").click();
  await page.getByRole("heading", { name: "groupe orga1" }).click();
  await page.getByRole("heading", { name: "groupe orga2" }).click();
  await page.getByText("groupe orga 2 medic").click();
  await page.getByText("cham prga 2 medic").click();
  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByText("territoire orga 1").click();
  await page.getByRole("cell", { name: "User Admin Test - 1" }).click();
  await page.getByRole("button", { name: "Annuler" }).click();
  await page.getByText("Retour").click();
  await page.getByText("territoire orga 2").click();
  await page.getByText("User Admin Test - 2").click();
  await page.getByRole("button", { name: "Annuler" }).click();
  await page.getByRole("link", { name: "Comptes rendus" }).click();
  await page.getByLabel("Comptes rendus de toute l'").check();
  await page.getByText("4passagesPassages (4)").click();
  await page.getByText("2rencontresRencontres (2)").click();
  await page.getByText("2observationsObservations de").click();
  await page.getByText("2personnes crééesPersonnes cr").click();
  await page.getByRole("button", { name: "Consultations (2)" }).click();
  await page.getByRole("button", { name: "Actions (2)" }).click();
  await page.getByRole("link", { name: "Équipes" }).click();
  await page.getByRole("cell", { name: "team test orga 1" }).click();
  await page.getByText("Retour").click();
  await page.getByRole("cell", { name: "team test orga 2" }).click();
  await page.getByText("Retour").click();
  await page.getByRole("link", { name: "Utilisateurs" }).click();
  await page.getByText("admin2@example.org").click();
  await page.getByText("Retour").click();
  await page.getByText("admin1@example.org").click();
  await page.getByText("Retour").click();
  await page.getByRole("link", { name: "Accueil" }).click();
  await page.getByText("service orga 1").click();
  await page.getByText("service orga 2").click();
});
