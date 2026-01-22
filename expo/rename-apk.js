import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the append argument from command line
const appendArg = process.argv.find(arg => arg.startsWith('--append='));
if (!appendArg) {
  console.error(chalk.red('Error: --append argument is required'));
  console.log(chalk.yellow('Usage: node rename-apk.js --append=<suffix>'));
  process.exit(1);
}

const appendSuffix = appendArg.split('=')[1];

// Find the latest build-*.apk file
const findLatestApk = () => {
  const files = fs.readdirSync(__dirname);
  const apkFiles = files
    .filter(file => file.startsWith('build-') && file.endsWith('.apk'))
    .map(file => ({
      name: file,
      path: path.join(__dirname, file),
      time: fs.statSync(path.join(__dirname, file)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time); // Sort by modification time, newest first

  return apkFiles.length > 0 ? apkFiles[0] : null;
};

try {
  const latestApk = findLatestApk();
  
  if (!latestApk) {
    throw new Error('No build-*.apk file found');
  }

  const newFileName = `mano-${appendSuffix}.apk`;
  const newPath = path.join(__dirname, newFileName);

  // Remove existing file with same name if it exists
  if (fs.existsSync(newPath)) {
    fs.unlinkSync(newPath);
    console.log(chalk.gray(`Removed existing: ${newFileName}`));
  }

  // Rename the APK
  fs.renameSync(latestApk.path, newPath);
  console.log(chalk.green(`✓ Renamed to: ${newFileName}`));

} catch (error) {
  console.error(chalk.red('Error renaming APK:'), error.message);
  process.exit(1);
}
