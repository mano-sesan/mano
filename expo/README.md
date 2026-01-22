# Application Android - Expo x React Native

## Comment livrer une version mobile pour android

1. Lancer `yarn update-mobile-app-version [patch|minor|major]`
2. Lancer `yarn build:android-apks` (génère 2 APKs: standard et Niort)
3. Lancer `yarn publish-release-to-github` (publie les 2 APKs avec tags m{version} et niort{version})
4. Committer et push les modifications de version.

## Comment créer un nouveau package Id

Parce que Mano n'est pas publié sur Google Play publiquement, mais est seulement disponible via les releases Github, cela pose un problème d'identifiant pour le logiciel InTunes de Microsoft (source [ici](https://learn.microsoft.com/en-us/intune/intune-service/apps/apps-add-android-for-work#managed-google-play-private-lob-app-publishing-directly-in-the-) :

> Your app's package name must be globally unique in Google Play (not just unique within your enterprise or Google Play Developer account). Otherwise, you receive the Upload a new APK file with a different package name error.

Si une organisation utilise Microsoft Intunes, nous devons donc lui générer un Mano avec un `packageId` qui lui est propre.

Les étapes à suivre sont

1. dans `./eas.json`, remplacez `{nouveau-nom}` par ce que vous voulez (exemple : `niort`)

  ```json
  "production-{nouveau-nom}": {
      "extends": "production",
      "env": {
        "PACKAGE_ID": "com.sesan.mano.{nouveau-nom}",
        "EXPO_PUBLIC_MANO_DOWNLOAD_URL": "https://mano.sesan.fr/download-{nouveau-nom}"
      }
    }
  ```

2. dans `./package.json`, ajoutez un script


  ```json
  "build-local:android-apk-{nouveau-nom}": "eas build -p android --local --profile production-{nouveau-nom} && node rename-apk.js --append={nouveau-nom}",
  ```

3. adaptez `./publish-releases-to-github.js` pour que la release soit faite pour ce `{nouveau-nom}`

4. quand vous livrez un nouvea packageId pour la première fois, `eas` va demander le `Keystore`, puis n'en trouvant pas, va demander `Generate a new Android Keystore ?`, dites oui. Cette Keystore sera storée sur les serveurs d'expo : c'est très bien ainsi.


## Installer l'environnement de test

Suivre les instructions de Detox, et tâtonner avec les Java et autre `ANDROID_HOME`...
-> https://wix.github.io/Detox/docs/introduction/getting-started/
-> https://wix.github.io/Detox/docs/introduction/android-dev-env


## Développement

### The first time - or when a new native dependencie is installed

- Install the dependencies:

  ```sh
  yarn
  ```

- Prebuild first

  ```sh
  yarn prebuild
  ```

- Build and run Android development builds:

  ```sh
  yarn build-dev-android
  ```

### Development server

- Build and run Android development builds:

  ```sh
  yarn start
  ```


## Compile for production

- Just run 

  ```sh
  yarn build-local:android-aab
  ```