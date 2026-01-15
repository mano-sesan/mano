import { test, expect, Page } from "@playwright/test";
import { populate } from "./scripts/populate-db";
import { clickOnEmptyReactSelect, createPerson, logOut, loginWith } from "./utils";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/fr";

dayjs.extend(utc);
dayjs.locale("fr");
test.beforeAll(async () => {
  await populate();
});

test("Documents organizer", async ({ page }) => {
  // Always use a new items
  // const person1Name = nanoid();
  const person1Name = "Première personne";
  // const person2Name = nanoid();
  const person2Name = "Deuxième personne";

  await loginWith(page, "admin1@example.org");

  await page.getByRole("link", { name: "Organisation" }).click();
  await page.getByRole("button", { name: "Personnes suivies", exact: true }).click();
  await page
    .getByLabel(
      /Activer\s+la\s+possibilité\s+d'ajouter\s+des\s+liens\s+familiaux\s+entre\s+personnes\.\s+Un\s+onglet\s+"Famille"\s+sera\s+rajouté\s+dans\s+les\s+personnes,\s+et\s+vous\s+pourrez\s+créer\s+des\s+actions,\s+des\s+commentaires\s+et\s+des\s+documents\s+visibles\s+pour\s+toute\s+la\s+famille\./
    )
    .check();

  await page.getByRole("button", { name: "Mettre à jour" }).first().click();
  await page.getByText("Mise à jour !").click();

  await createPerson(page, person1Name);
  await createPerson(page, person2Name);

  await page.getByRole("button", { name: "Liens familiaux (0)" }).click();
  await expect(page.getByText("Cette personne n'a pas encore de lien familial")).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un lien" }).click();
  await expect(page.getByText(`Nouveau lien familial entre ${person2Name} et...`)).toBeVisible();
  await clickOnEmptyReactSelect(page, "person-family-relation", person1Name);
  await page.getByPlaceholder("Père/fille, mère/fils...").fill("je suis ton père");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Le lien familial a été ajouté").click();

  await expect(page.getByRole("cell", { name: `${person2Name} et ${person1Name}` })).toBeVisible();
  await expect(page.getByRole("cell", { name: "je suis ton père", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "User Admin Test - 1" })).toBeVisible();

  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("cell", { name: person1Name }).click();
  const now1 = dayjs();
  await page.getByTestId("person-documents-upload-input").setInputFiles("e2e/files-to-upload/image-1.jpg");
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.getByTestId("documents-tree-wrapper").getByText("image-1.jpg", { exact: true }).click();

  await page.getByLabel("Document familialCe document sera visible pour toute la famille").check();
  await page.getByText("Document mis à jour").click();
  await expect(page.locator("div").filter({ hasText: "image-1.jpg" }).getByLabel("Document familial")).toBeVisible();

  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("cell", { name: person2Name }).click();
  await expect(page.locator("div").filter({ hasText: "image-1.jpg" }).getByLabel("Document familial")).toBeVisible();

  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("cell", { name: person1Name }).click();
  const now2 = dayjs();
  await page.getByTestId("person-documents-upload-input").setInputFiles(["e2e/files-to-upload/image-2.jpg", "e2e/files-to-upload/image-3.jpg"]);
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.getByText("Documents enregistrés !").click();

  await expect(page.locator("div").filter({ hasText: "image-1.jpg" }).getByLabel("Document familial")).toBeVisible();
  await expect(page.getByTestId("documents-tree-wrapper").getByText("image-2.jpg")).toBeVisible();
  await expect(page.getByTestId("documents-tree-wrapper").getByText("image-3.jpg")).toBeVisible();

  await page.getByLabel("Passer en plein écran").click();

  //
  await expect(
    page
      .locator('[data-test-id="modal"]')
      .getByLabel("image-3.jpg")
      .getByText(`Créé par User Admin Test - 1${now2.format("D MMMM YYYY HH:mm")}`)
  ).toBeVisible();
  await expect(
    page
      .locator('[data-test-id="modal"]')
      .getByLabel("image-2.jpg")
      .getByText(`Créé par User Admin Test - 1${now2.format("D MMMM YYYY HH:mm")}`)
  ).toBeVisible();
  await page.locator('[data-test-id="modal"]').getByRole("button", { name: "Créer un dossier" }).click();
  await page.getByPlaceholder("Entrez le nom du dossier").fill("Dossier1");
  const now3 = dayjs();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Dossier créé !").click();

  await page.locator('[data-test-id="modal"]').getByText("Dossier1").hover();
  await page.locator('[data-test-id="modal"]').getByLabel("Éditer le dossier").click();
  await page.getByPlaceholder("Nom du dossier").fill("Dossier2");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Dossier mis à jour").click();
  await page.locator('[data-test-id="modal"]').getByText("image-3.jpg").click();
  await page.getByTitle("Modifier le nom de ce document").click();
  await page.getByLabel("Nom").click();
  await page.getByLabel("Nom").fill("image-4.jpg");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Document mis à jour").click();
  await expect(page.locator('[data-test-id="modal"]').getByText("image-4.jpg")).toBeVisible();
  await page.getByText("Fermer").click();

  await logOut(page, "User Admin Test - 1");
  await loginWith(page, "admin1@example.org");
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("cell", { name: person1Name }).click();
  await page.getByLabel("Passer en plein écran").click();

  await expect(
    page
      .locator('[data-test-id="modal"]')
      .getByLabel("image-2.jpg")
      .getByText(`Créé par User Admin Test - 1${now2.format("D MMMM YYYY HH:mm")}`)
  ).toBeVisible();
  await expect(
    page
      .locator('[data-test-id="modal"]')
      .getByLabel("image-4.jpg")
      .getByText(`Créé par User Admin Test - 1${now2.format("D MMMM YYYY HH:mm")}`)
  ).toBeVisible();
  await expect(page.locator('[data-test-id="modal"]').getByText("Dossier2")).toBeVisible();
  await page.locator('[data-test-id="modal"]').getByText("image-2.jpg").click();
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toBe(`Voulez-vous vraiment supprimer ce document ?`);
    dialog.accept();
  });
  await page.getByRole("dialog", { name: "image-2.jpg" }).getByRole("button", { name: "Supprimer" }).click();
  await page.getByText("Document supprimé").click();

  await page.locator('[data-test-id="modal"]').getByText("Dossier2").hover();
  await page.locator('[data-test-id="modal"]').getByLabel("Éditer le dossier").click();
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toBe(`Voulez-vous vraiment supprimer ce dossier ?`);
    dialog.accept();
  });
  await page.getByRole("dialog", { name: "Éditer le dossier" }).getByRole("button", { name: "Supprimer" }).click();
  await page.getByText("Dossier supprimé").click();

  await page.getByText("Fermer").click();

  await logOut(page, "User Admin Test - 1");
  await loginWith(page, "admin1@example.org");
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("cell", { name: person1Name }).click();
  await page.getByLabel("Passer en plein écran").click();
  await expect(
    page
      .locator('[data-test-id="modal"]')
      .getByLabel("image-2.jpg")
      .getByText(`Créé par User Admin Test - 1${now2.format("D MMMM YYYY HH:mm")}`)
  ).not.toBeVisible();
  await expect(
    page
      .locator('[data-test-id="modal"]')
      .getByLabel("image-4.jpg")
      .getByText(`Créé par User Admin Test - 1${now2.format("D MMMM YYYY HH:mm")}`)
  ).toBeVisible();
  await expect(page.locator('[data-test-id="modal"]').getByText("Dossier2")).not.toBeVisible();
});
