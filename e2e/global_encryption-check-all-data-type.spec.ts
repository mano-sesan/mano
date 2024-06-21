import { test, expect } from "@playwright/test";
import { nanoid } from "nanoid";
import { populate } from "./scripts/populate-db";
import { logOut, loginWith } from "./utils";
import dayjs from "dayjs";

test.beforeAll(async () => {
  await populate();
});
test.setTimeout(120000);

test("test", async ({ page }) => {
  const premier = "premier-" + nanoid();
  const deuxieme = "deuxieme-" + nanoid();
  const monAction = "monAction-" + nanoid();
  const testTerritoire = "testTerritoire-" + nanoid();

  await loginWith(page, "admin1@example.org", "secret", "plouf");
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("button", { name: "Créer une personne" }).click();
  await page.getByLabel("Nom").click();
  await page.getByLabel("Nom").fill(premier);
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("button", { name: "Créer une personne" }).click();
  await page.getByLabel("Nom").click();
  await page.getByLabel("Nom").fill(deuxieme);
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("link", { name: "Organisation" }).click();
  await page.getByRole("button", { name: "Personnes suivies", exact: true }).click();
  await page
    .getByLabel(
      'Activer la possibilité d\'ajouter des liens familiaux entre personnes. Un onglet "Famille" sera rajouté dans les personnes, et vous pourrez créer des actions, des commentaires et des documents visibles pour toute la famille.'
    )
    .check();
  await page.getByRole("button", { name: "Mettre à jour" }).first().click();
  await page.getByText("Mise à jour !").click();
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByText(premier).click();
  await page.getByRole("button", { name: "Ajouter un commentaire" }).first().click();
  await page.getByRole("textbox", { name: "Commentaire" }).fill("commentaire test");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Commentaire enregistré").click();
  await page.getByRole("button", { name: "Ajouter une action" }).click();
  await page.getByLabel("Nom de l'action").fill(monAction);
  await page.getByRole("button", { name: "Commentaires", exact: true }).click();
  await page.getByRole("dialog", { name: "Ajouter une action" }).getByRole("button", { name: "＋ Ajouter un commentaire" }).click();
  await page.getByLabel("Commentaire", { exact: true }).fill("Avec un commentaire");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("button", { name: "Éditer les informations sociales" }).click();
  await page.getByLabel("Structure de suivi social").click();
  await page.getByLabel("Structure de suivi social").fill("SUIVI HOP");
  await page.getByText("Informations de santé+").click();
  await page.getByLabel("Structure de suivi médical").click();
  await page.getByLabel("Structure de suivi médical").fill("MDEIDAL");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mis à jour !").click();
  await page.getByRole("button", { name: "Ajouter un passage" }).click();
  await page.getByRole("dialog").getByLabel("Commentaire").fill("le passage");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Passage enregistré !").click();
  await page.getByRole("button", { name: "Rencontres (0)" }).click();
  await page.getByRole("button", { name: "Ajouter une rencontre" }).click();
  await page.getByRole("dialog").getByLabel("Commentaire").fill("La rencontre");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Rencontre enregistrée").click();
  await page.getByRole("button", { name: "Dossier Médical" }).click();
  await page.getByRole("button", { name: "Ajouter une consultation" }).click();
  await page.getByLabel("Nom (facultatif)").fill("La consultation");
  await page.locator(".consultation-modal-type__input-container").click();
  await page.locator("#react-select-type-option-0").click();
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByRole("button", { name: "Ajouter un traitement" }).click();
  await page.getByPlaceholder("Amoxicilline").click();
  await page.getByPlaceholder("Amoxicilline").fill("le traitement");
  await page.getByPlaceholder("1mg").click();
  await page.getByPlaceholder("1mg").fill("1mg");
  await page.getByPlaceholder("1 fois par jour").click();
  await page.getByPlaceholder("1 fois par jour").fill("12 fois");
  await page.getByPlaceholder("Angine").click();
  await page.getByPlaceholder("Angine").fill("Rhume");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Traitement créé !").click();
  await page.getByRole("button", { name: "Éditer les dossier médical" }).click();
  await page.getByLabel("Numéro de sécurité sociale").click();
  await page.getByLabel("Numéro de sécurité sociale").fill("12345");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Mis à jour !").click();
  await page.getByRole("button", { name: "Lieux fréquentés (0)" }).click();
  await page.getByRole("button", { name: "Ajouter un lieu" }).click();
  await page.getByRole("combobox", { name: "Lieu" }).fill("test lieu");
  await page.getByText('Créer "test lieu"').click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Le lieu a été ajouté").click();
  await page.getByRole("button", { name: "Liens familiaux (0)" }).click();
  await page.getByRole("button", { name: "Ajouter un lien" }).click();
  await page.locator(".person-family-relation__input-container").click();
  await page.locator("#person-family-relation").fill("deu");
  await page.locator("#react-select-personId-option-0").click();
  await page.getByPlaceholder("Père/fille, mère/fils...").fill("père");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Le lien familial a été ajouté").click();
  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByRole("button", { name: "Créer un territoire" }).click();
  await page.getByLabel("Nom").click();
  await page.getByLabel("Nom").fill(testTerritoire);
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("button", { name: "Nouvelle observation" }).click();
  await page.getByRole("dialog").getByLabel("Commentaire").fill("Un commentaire");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
  await page.getByRole("link", { name: "Structures" }).click();
  await page.getByRole("button", { name: "Créer une structure" }).click();
  await page.getByLabel("Nom").fill("Une structure");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Structure créée !").click();
  await page.getByRole("link", { name: "Comptes rendus" }).click();
  await page.getByRole("link", { name: "Organisation" }).click();
  await page.getByRole("link", { name: "Agenda" }).click();
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("link", { name: "Organisation" }).click();
  await page.getByRole("button", { name: "Chiffrement" }).click();
  await page.getByRole("button", { name: "Changer la clé de chiffrement" }).click();
  await page.locator("#encryptionKey").click();
  await page.locator("#encryptionKey").fill("plaf plaf plaf");
  await page.getByLabel("Confirmez la clé de chiffrement").click();
  await page.getByLabel("Confirmez la clé de chiffrement").fill("plaf plaf plaf");
  await page.locator('[data-test-id="encryption-modal"]').getByRole("button", { name: "Changer la clé de chiffrement" }).click();
  await page.getByText("Données chiffrées ! Veuillez noter la clé puis vous reconnecter").click();
  await page.locator('[data-test-id="encryption-modal"]').getByLabel("Fermer").first().click();
  await logOut(page, "User Admin Test - 1");
  await loginWith(page, "admin1@example.org", "secret", "plaf plaf plaf");
  await page.getByRole("link", { name: "Agenda" }).click();
  await page.getByText("La consultation").click();
  await page.getByRole("button", { name: "Fermer" }).first().click();
  await page.locator('[data-test-id="La consultation"]').getByText(premier).click();
  await page.getByRole("button", { name: "Dossier Médical" }).click();
  await page.getByText("le traitement - Rhume - 1mg - 12 fois").click();
  await page.getByRole("button", { name: "Fermer" }).first().click();
  await page.getByText("La consultation- Médicale").click();
  await page.getByRole("button", { name: "Fermer" }).first().click();
  await page.getByText("MDEIDAL").click();
  await page.getByText("12345").click();
  await page.getByRole("button", { name: "Lieux fréquentés (1)" }).click();
  await page.locator('[data-test-id="test lieu"]').click();
  await page.getByRole("button", { name: "Liens familiaux (1)" }).click();
  await page.getByRole("cell", { name: premier + " et " + deuxieme }).click();
  await page.getByRole("button", { name: "Résumé" }).click();
  await page.getByText("SUIVI HOP").click();
  await page.getByText("MDEIDAL").click();
  await page.getByText("le passage").first().click();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Rencontres (1)" }).click();
  await page.getByText("La rencontre").first().click();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("link", { name: "Territoires" }).click();
  await page.getByText(testTerritoire).click();
  await page.getByText("Un commentaire").click();
  await page.getByRole("button", { name: "Annuler" }).click();
  await page.getByRole("link", { name: "Agenda" }).click();
  await page.getByText(monAction).click();
  await page.getByRole("button", { name: "Commentaires (1)" }).click();
  await expect(page.getByText("Avec un commentaire")).toBeVisible();
  await page.getByRole("button", { name: "Fermer" }).first().click();
  await page.getByRole("link", { name: "Comptes rendus" }).click();
  await page.getByRole("link", { name: "Organisation" }).click();
  await page.getByRole("button", { name: "Chiffrement" }).click();
  await page.getByRole("button", { name: "Changer la clé de chiffrement" }).click();
  await page.locator("#encryptionKey").click();
  await page.locator("#encryptionKey").fill("plouf plouf plouf");
  await page.getByLabel("Confirmez la clé de chiffrement").click();
  await page.getByLabel("Confirmez la clé de chiffrement").fill("plouf plouf plouf");
  await page.locator('[data-test-id="encryption-modal"]').getByRole("button", { name: "Changer la clé de chiffrement" }).click();
  await page.getByText("Données chiffrées ! Veuillez noter la clé puis vous reconnecter").click();
  await page.locator('[data-test-id="encryption-modal"]').getByLabel("Fermer").first().click();
  await logOut(page, "User Admin Test - 1");
  await loginWith(page, "admin1@example.org", "secret", "plouf plouf plouf");
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByText(deuxieme).click();
});
