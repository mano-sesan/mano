import { test, expect } from "@playwright/test";
import { nanoid } from "nanoid";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/fr";
import { loginWith } from "./utils";
import { populate } from "./scripts/populate-db";

dayjs.extend(utc);
dayjs.locale("fr");

test.beforeAll(async () => {
  await populate();
});

test("Person creation", async ({ page }) => {
  await loginWith(page, "admin5@example.org");

  await page.getByRole("link", { name: "Personnes suivies" }).click();
  await page.getByRole("button", { name: "Créer une personne" }).click();
  await page.getByLabel("Nom").click();
  await page.getByLabel("Nom").fill("person organisation 5");
  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await page.getByText("Création réussie !").click();
});
