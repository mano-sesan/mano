# Application Android - Expo x React Native

## Comment livrer une version mobile pour android

1. Lancer `yarn update-mobile-app-version [patch|minor|major]`
2. Lancer `yarn build:android-apks` (génère 2 APKs: standard et Niort)
3. Lancer `yarn publish-release-to-github` (publie les 2 APKs avec tags m{version} et niort{version})
4. Committer et push les modifications de version.

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