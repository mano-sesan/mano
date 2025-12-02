const semver = require("semver");
const fs = require("fs");
const currentBuildNumber = require("./app.json").version.buildNumber; // ex: 127
const currentVersion = require("./app.json").version.buildName; // ex: 2.1.1

let release = process.argv[2] || "minor";
const validRelease = ["minor", "major", "patch"];
if (!validRelease.includes(release)) {
  console.error("😢 invalid release, must be " + validRelease.join(", "));
  process.exit(1);
}

const newVersion = semver.inc(currentVersion, release);
const newBuildNumber = currentBuildNumber + 1;

// Replace the version in the package.json file via regex and save it
const packageJson = fs.readFileSync("package.json", "utf8");
const newPackageJson = packageJson.replace(/"version": "[^"]+"/, `"version": "${newVersion}"`);
fs.writeFileSync("package.json", newPackageJson);

// Replace the version in the app.json file via regex and save it
const appJson = fs.readFileSync("app.config.ts", "utf8");
const newAppJson = appJson
  .replace(/version = "[^"]+"/, `version = "${newVersion}"`)
  .replace(/buildNumber "[^"]+"/, `buildNumber "${newBuildNumber}"`);
fs.writeFileSync("app.config.ts", newAppJson);

// Replace the mobileAppVersion in the ../api/package.json file via regex and save it
const apiPackageJson = fs.readFileSync("../api/package.json", "utf8");
const newApiPackageJson = apiPackageJson.replace(/"mobileAppVersion": "[^"]+"/, `"mobileAppVersion": "${newVersion}"`);
fs.writeFileSync("../api/package.json", newApiPackageJson);

// Replace the mobileAppVersion in the ../website/package.json file via regex and save it
const websitePackageJson = fs.readFileSync("../website/package.json", "utf8");
const newWebsitePackageJson = websitePackageJson.replace(/"mobileAppVersion": "[^"]+"/, `"mobileAppVersion": "${newVersion}"`);
fs.writeFileSync("../website/package.json", newWebsitePackageJson);

// Replace the version in the badge in ../README.md via regex and save it
const readme = fs.readFileSync("../README.md", "utf8");
const newReadme = readme.replace(/version-(\d+\.\d+\.\d+)-blue/, `version-${newVersion}-blue`);
fs.writeFileSync("../README.md", newReadme);

console.log("🥳 Updated version to " + newVersion);
