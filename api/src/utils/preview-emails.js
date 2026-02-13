/**
 * Script pour prévisualiser les emails de désactivation dans le navigateur.
 * Usage: node api/src/utils/preview-emails.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const { mailDesactivationWarningHtml } = require("./mail-desactivation-warning");
const { mailDesactivationHtml } = require("./mail-desactivation");

const dir = path.join(__dirname, "..", "..", "tmp-email-previews");
fs.mkdirSync(dir, { recursive: true });

const previews = [
  { name: "warning", html: mailDesactivationWarningHtml("Jean Dupont") },
  { name: "desactivation-non-admin", html: mailDesactivationHtml("Jean Dupont", false, "Guillaume") },
  { name: "desactivation-admin-guillaume", html: mailDesactivationHtml("Marie Martin", true, "Guillaume") },
  { name: "desactivation-admin-melissa", html: mailDesactivationHtml("Marie Martin", true, "Melissa") },
  { name: "desactivation-admin-simon", html: mailDesactivationHtml("Marie Martin", true, "Simon") },
];

for (const { name, html } of previews) {
  const filePath = path.join(dir, `${name}.html`);
  fs.writeFileSync(filePath, html);
  console.log(`Written: ${filePath}`);
}

// Open the first one in the browser
const firstFile = path.join(dir, `${previews[0].name}.html`);
try {
  execSync(`open "${firstFile}"`);
  console.log("\nOpened in browser. Other previews are in the same folder.");
} catch {
  console.log(`\nOpen the files in ${dir} in your browser to preview.`);
}
