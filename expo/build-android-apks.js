const chalk = require('chalk');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const path = require('path');

const __dirname = path.dirname(require.main.filename);
const buildsDir = path.join(__dirname, 'builds');

// Create builds directory if it doesn't exist
if (!fs.existsSync(buildsDir)) {
  fs.mkdirSync(buildsDir, { recursive: true });
}

// Helper function to find the latest build-*.apk file
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

// Helper function to clean up old build-*.apk files
const cleanupOldApks = () => {
  const files = fs.readdirSync(__dirname);
  const apkFiles = files.filter(file => file.startsWith('build-') && file.endsWith('.apk'));
  
  apkFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    fs.unlinkSync(filePath);
    console.log(chalk.gray(`Cleaned up: ${file}`));
  });
};

const buildApks = async () => {
  try {
    // Clean up any existing build-*.apk files before starting
    // cleanupOldApks();

    // Build standard APK
    console.log(chalk.blue('Building standard APK (com.sesan.mano)...'));
    const standardBuild = await exec('eas build -p android --local --profile production');
    
    if (standardBuild.stderr?.length) {
      console.log(chalk.yellow('Standard build warnings:'), standardBuild.stderr);
    }
    
    // Find and move the standard APK
    const standardApk = findLatestApk();
    if (!standardApk) {
      throw new Error('Standard APK not found after build');
    }
    
    const standardDestination = path.join(buildsDir, 'mano-standard.apk');
    fs.renameSync(standardApk.path, standardDestination);
    console.log(chalk.green(`✓ Standard APK created: ${standardDestination}`));

    // Build Niort APK
    console.log(chalk.blue('\nBuilding Niort APK (com.sesan.mano.niort)...'));
    const niortBuild = await exec('eas build -p android --local --profile production-niort');
    
    if (niortBuild.stderr?.length) {
      console.log(chalk.yellow('Niort build warnings:'), niortBuild.stderr);
    }
    
    // Find and move the Niort APK
    const niortApk = findLatestApk();
    if (!niortApk) {
      throw new Error('Niort APK not found after build');
    }
    
    const niortDestination = path.join(buildsDir, 'mano-niort.apk');
    fs.renameSync(niortApk.path, niortDestination);
    console.log(chalk.green(`✓ Niort APK created: ${niortDestination}`));

    // Final cleanup
    cleanupOldApks();

    console.log(chalk.green('\n✓ Both APKs built successfully!'));
    console.log(chalk.cyan('Standard APK:'), standardDestination);
    console.log(chalk.cyan('Niort APK:'), niortDestination);
    
  } catch (error) {
    console.error(chalk.red('Error building APKs:'), error);
    process.exit(1);
  }
};

buildApks();
