import { expect, Page } from "@playwright/test";

export async function clickOnEmptyReactSelectAndCreate(page: Page, name: string, text: string, createText: string) {
  await page.locator(`#${name}`).fill(text);
  await page.getByText(createText).click();
}

export async function clickOnEmptyReactSelect(page: Page, name: string, text: string) {
  await page.locator(`.${name}__dropdown-indicator`).click();
  await page.locator(`.${name}__menu`).getByText(text, { exact: true }).click();
}

export async function changeReactSelectValue(page: Page, name: string, text: string) {
  await page.locator(`.${name}__dropdown-indicator`).click();
  await page.locator(`.${name}__menu`).getByText(text, { exact: true }).click();
}

export async function clickOnOpenedReactSelectValue(page: Page, name: string, text: string) {
  await page.locator(`.${name}__menu`).getByText(text, { exact: true }).click();
}

export async function changeTeamSelectorValue(page: Page, text: string) {
  await page.locator(`#team-selector`).click();
  await page.getByRole("menuitem", { name: text }).click();
}

export async function loginWith(page: Page, email: string, password: string = "secret", orgKey: string = "plouf") {
  // Le goto peut échouer avec NS_BINDING_ABORTED si une navigation est déjà en cours
  // (ex: redirect après "Se déconnecter"), on catch et on attend que la page se stabilise.
  await page.goto("http://localhost:8090/auth").catch(() => {});
  await page.getByLabel("Email").waitFor({ state: "visible" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.locator("#orgEncryptionKey").waitFor({ state: "visible" });
  await page.locator("#orgEncryptionKey").pressSequentially(orgKey);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

export async function logOut(page: Page, name: string) {
  await page.getByRole("button", { name }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter et vider le cache" }).click();
  await expect(page).toHaveURL("http://localhost:8090/auth");
}

export async function createAction(
  page: Page,
  actionName: string,
  personName: string,
  options: {
    categories?: Array<{ group: string; category: string }>;
    group?: boolean;
  } = { categories: [], group: false }
) {
  await page.getByRole("link", { name: "Agenda" }).click();
  await page.getByRole("button", { name: "Créer une action" }).click();
  await page.getByLabel("Nom de l'action").fill(actionName);
  await clickOnEmptyReactSelect(page, "create-action-person-select", personName);
  const { categories = [], group = false } = options;
  if (categories.length > 0) {
    await page.locator("#categories").getByText("Choisir...").click();
    for (const { group, category } of categories) {
      await page.getByRole("button", { name: `${group} (2)` }).click();
      await page.getByRole("button", { name: category }).click();
    }
    await page.getByRole("dialog", { name: "Sélectionner des catégories" }).getByRole("button", { name: "Fermer" }).click();
  }
  if (group) {
    await page.getByLabel("Action familiale").check();
  }
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
}

export async function createPerson(page: Page, name: string) {
  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await expect(page).toHaveURL("http://localhost:8090/person");
  await page.getByRole("button", { name: "Créer une personne" }).click();
  await page.getByLabel("Nom").click();
  await page.getByLabel("Nom").fill(name);
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
}
