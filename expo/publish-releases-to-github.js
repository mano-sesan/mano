import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import util from 'util';
import * as childProcess from 'child_process';
import { fileURLToPath } from 'url';

const exec = util.promisify(childProcess.exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
const mobileAppVersion = packageJson.version;

// Before running the script
// To authenticate, please run `gh auth login`.

const standardApkPath = path.join(__dirname, 'mano-standard.apk');
const niortApkPath = path.join(__dirname, 'mano-niort.apk');

const publishApksToGithub = async () => {
  // Check if both APKs exist
  if (!fs.existsSync(standardApkPath)) {
    console.log(chalk.red('Error: Standard APK not found at'), standardApkPath);
    console.log(chalk.yellow('Please run `yarn build-local:android-apks` first'));
    process.exit(1);
  }

  if (!fs.existsSync(niortApkPath)) {
    console.log(chalk.red('Error: Niort APK not found at'), niortApkPath);
    console.log(chalk.yellow('Please run `yarn build-local:android-apks` first'));
    process.exit(1);
  }

  try {
    // Upload standard variant with tag m{version}
    console.log(chalk.blue(`Publishing standard APK with tag m${mobileAppVersion}...`));
    const standardResult = await exec(
      `gh release create m${mobileAppVersion} "${standardApkPath}" ./app.config.ts --target main --title "Mano v${mobileAppVersion}"`
    );

    if (standardResult.stderr?.length) {
      console.log(chalk.red('Error uploading standard APK:'), chalk.bgRed(standardResult.stderr));
    }
    if (standardResult.stdout?.length) {
      console.log(chalk.green('Success uploading standard APK:'), chalk.green(standardResult.stdout));
    }

    // Upload Niort variant with tag niort{version}
    console.log(chalk.blue(`\nPublishing Niort APK with tag niort${mobileAppVersion}...`));
    const niortResult = await exec(
      `gh release create niort${mobileAppVersion} "${niortApkPath}" ./app.config.ts --target main --title "Mano Niort v${mobileAppVersion}"`
    );

    if (niortResult.stderr?.length) {
      console.log(chalk.red('Error uploading Niort APK:'), chalk.bgRed(niortResult.stderr));
    }
    if (niortResult.stdout?.length) {
      console.log(chalk.green('Success uploading Niort APK:'), chalk.green(niortResult.stdout));
    }

    console.log(chalk.green('\n✓ Both releases created successfully!'));
    console.log(chalk.yellow('Standard release: https://mano.sesan.fr/download'));
    console.log(chalk.yellow('Niort release: https://mano.sesan.fr/download-niort'));
  } catch (error) {
    console.error(chalk.red('Error publishing to GitHub:'), error);
    process.exit(1);
  }
};

publishApksToGithub();
