import { ExpoConfig, ConfigContext } from "expo/config";
import { withSentry } from "@sentry/react-native/expo";

export const version = "2.5.5";
export const buildNumber = "55";
export default ({ config }: ConfigContext): ExpoConfig => {
  return withSentry(
    {
      ...config,
      slug: "mano",
      platforms: ["android"],
      orientation: "portrait",
      name: "Mano",
      owner: "mano-sesan",
      version,
      newArchEnabled: true,
      icon: "./src/assets/icon.png",
      scheme: "mano",
      userInterfaceStyle: "light",
      experiments: {
        tsconfigPaths: true,
      },
      androidStatusBar: {
        barStyle: "light-content",
        hidden: false,
        translucent: false,
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "./src/assets/adaptive-icon.png",
          backgroundColor: "#226854",
        },
        package: "com.sesan.mano",
        versionCode: Number(buildNumber),
        permissions: [
          "android.permission.INTERNET",
          "android.permission.CAMERA",
          "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
          "android.permission.READ_MEDIA_AUDIO",
          "android.permission.READ_MEDIA_IMAGES",
          "android.permission.READ_MEDIA_VIDEO",
          "android.permission.REQUEST_INSTALL_PACKAGES",
          "android.permission.WRITE_EXTERNAL_STORAGE",
          "android.permission.READ_EXTERNAL_STORAGE",
          "android.permission.DOWNLOAD_WITHOUT_NOTIFICATION",
          "android.intent.action.DOWNLOAD_COMPLETE",
        ],
        softwareKeyboardLayoutMode: "pan",
      },
      plugins: [
        [
          "@sentry/react-native/expo",
          {
            organization: "arnaud-ambroselli",
            project: "medspot-expo",
          },
        ],
        [
          "expo-asset",
          {
            defaultChannel: "PUSH-LOCAL-NOTIFICATIONS",
            color: "#226854",
            mode: "production",
          },
        ],
        [
          "expo-font",
          {
            fonts: [
              "./src/assets/fonts/Nexa-Black-Italic.otf",
              "./src/assets/fonts/Nexa-Bold-Italic.otf",
              "./src/assets/fonts/Nexa-Bold.otf",
              "./src/assets/fonts/Nexa-Book-Italic.otf",
              "./src/assets/fonts/Nexa-Book.otf",
              "./src/assets/fonts/Nexa-Heavy-Italic.otf",
              "./src/assets/fonts/Nexa-Light-Italic.otf",
              "./src/assets/fonts/Nexa-Light.otf",
              "./src/assets/fonts/Nexa-Regular-Italic.otf",
              "./src/assets/fonts/NexaBlack.otf",
              "./src/assets/fonts/NexaHeavy.otf",
              "./src/assets/fonts/NexaRegular.otf",
            ],
          },
        ],
        [
          "expo-splash-screen",
          {
            backgroundColor: "#226854",
            image: "./src/assets/adaptive-icon.png",
            imageHeight: 300,
            imageWidth: 300,
            resizeMode: "cover",
          },
        ],
        "expo-image-picker",
        "expo-document-picker",
        "expo-build-properties",
        [
          "react-native-permissions",
          {
            iosPermissions: [],
          },
        ],
      ],
      extra: {
        SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
      },
    },
    {
      url: "https://sentry.io/",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      project: "mano",
      organization: "mano",
    },
  );
};
