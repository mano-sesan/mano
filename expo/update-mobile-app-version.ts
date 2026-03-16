import semver, { type ReleaseType } from "semver";
import fs from "fs";
import { buildNumber, version } from "./app.config";
const currentBuildNumber = Number(buildNumber);
const currentVersion = String(version);

let release = process.argv[2] || "minor";
const validRelease = ["minor", "major", "patch"];
if (!validRelease.includes(release)) {
  console.error("😢 invalid release, must be " + validRelease.join(", "));
  process.exit(1);
}

const newVersion = semver.inc(currentVersion, release as ReleaseType);
const newBuildNumber = currentBuildNumber + 1;

console.log("🥳 Updating version to " + newVersion);
console.log("🥳 Updating build number to " + newBuildNumber);

// Replace the version in the package.json file via regex and save it
const packageJson = fs.readFileSync("package.json", "utf8");
const newPackageJson = packageJson.replace(/"version": "[^"]+"/, `"version": "${newVersion}"`);
fs.writeFileSync("package.json", newPackageJson);

// Replace the version in the app.json file via regex and save it
const appJson = fs.readFileSync("app.config.ts", "utf8");
const newAppJson = appJson
  .replace(/version = "[^"]+"/, `version = "${newVersion}"`)
  .replace(/buildNumber = [^"]+;/, `buildNumber = ${newBuildNumber};`);
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
