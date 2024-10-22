import { test, expect } from "@playwright/test";
import { populate } from "./scripts/populate-db";
import { loginWith, logOut } from "./utils";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/fr";

dayjs.extend(utc);
dayjs.locale("fr");
test.beforeAll(async () => {
  await populate();
});

// Le but de se test est de vérifier si la réconciliation de cache fonctionne correctement
test("Replace me", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const userContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const userPage = await userContext.newPage();

  // Les deux se connectent en même temps
  await loginWith(adminPage, "admin1@example.org");
  await loginWith(userPage, "normal1@example.org");

  // On attend que les deux soient connectés
  await expect(adminPage).toHaveURL("http://localhost:8090/reception?calendarTab=2");
  await expect(userPage).toHaveURL("http://localhost:8090/reception?calendarTab=2");

  // L'admin crée un user
  await adminPage.getByRole("link", { name: "Personnes suivies" }).click();
  await adminPage.getByRole("button", { name: "Créer une personne" }).click();
  await adminPage.getByLabel("Nom").click();
  await adminPage.getByLabel("Nom").fill("créé_par_admin");
  await adminPage.getByRole("button", { name: "Sauvegarder" }).click();
  await adminPage.getByText("Création réussie !").click();

  // Le user voit la personne créée par l'admin
  await userPage.getByRole("link", { name: "Personnes suivies" }).click();
  await expect(userPage.getByText("créé_par_admin")).toBeVisible();

  // L'admin se déconnecte (et on attend d'être sûr qu'il est déconnecté)
  await adminPage.getByRole("button", { name: "User Admin Test - 1" }).click();
  await adminPage.getByRole("menuitem", { name: "Se déconnecter", exact: true }).click();
  await expect(adminPage).toHaveURL("http://localhost:8090/auth");

  // Le user normal crée une personne
  await userPage.getByRole("link", { name: "Personnes suivies" }).click();
  await userPage.getByRole("button", { name: "Créer une personne" }).click();
  await userPage.getByLabel("Nom").click();
  await userPage.getByLabel("Nom").fill("créé_par_user");
  await userPage.getByRole("button", { name: "Sauvegarder" }).click();
  await userPage.getByText("Création réussie !").click();

  // L'admin se reconnecte et doit voir la personne créée par le user
  await loginWith(adminPage, "admin1@example.org");
  await expect(adminPage).toHaveURL("http://localhost:8090/reception?calendarTab=2");
  await adminPage.getByRole("link", { name: "Personnes suivies" }).click();
  await expect(adminPage.getByText("créé_par_user")).toBeVisible();
});
