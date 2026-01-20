import "react-native-gesture-handler";
import "./services/api-interface-with-app";
import "./services/encryption";
import "./global.css";
import "react-native-get-random-values";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { useColorScheme } from "react-native";
import relativeTime from "dayjs/plugin/relativeTime";
import isBetween from "dayjs/plugin/isBetween";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import * as Sentry from "@sentry/react-native";
import Navigators from "./Navigators";
import * as Application from "expo-application";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

dayjs.locale("fr");
dayjs.locale("fr");
dayjs.extend(relativeTime);
dayjs.extend(isBetween);

const reactNavigationIntegration = Sentry.reactNavigationIntegration();

if (!__DEV__) {
  Sentry.init({
    dsn: "https://1bab2dc91a5ed9ddde3e4273fe5438a5@o4506615228596224.ingest.sentry.io/4506829687554048",
    environment: "app",
    enabled: !__DEV__,
    tracesSampleRate: 0.05,
    release: `${Application.nativeApplicationVersion}`,
    enableAppStartTracking: true,
    enableNativeFramesTracking: true,
    enableStallTracking: true,
    enableUserInteractionTracing: true,
    integrations: [reactNavigationIntegration],
    // ignoreErrors: [
    //   'Network request failed',
    //   'Failed to fetch',
    //   'NetworkError',
    //   // ???
    //   'withrealtime/messaging',
    //   // This error seems to happen only in firefox and to be ignorable.
    //   // The "fetch" failed because user has navigated.
    //   // Since other browsers don't have this problem, we don't care about it,
    //   // it may be a false positive.
    //   'AbortError: The operation was aborted',
    // ],
  });
}

function App() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    NexaBlackItalic: require("./assets/fonts/Nexa-Black-Italic.otf"),
    NexaBoldItalic: require("./assets/fonts/Nexa-Bold-Italic.otf"),
    NexaBold: require("./assets/fonts/Nexa-Bold.otf"),
    NexaBookItalic: require("./assets/fonts/Nexa-Book-Italic.otf"),
    NexaBook: require("./assets/fonts/Nexa-Book.otf"),
    NexaHeavyItalic: require("./assets/fonts/Nexa-Heavy-Italic.otf"),
    NexaLightItalic: require("./assets/fonts/Nexa-Light-Italic.otf"),
    NexaLight: require("./assets/fonts/Nexa-Light.otf"),
    NexaRegularItalic: require("./assets/fonts/Nexa-Regular-Italic.otf"),
    NexaBlack: require("./assets/fonts/NexaBlack.otf"),
    NexaHeavy: require("./assets/fonts/NexaHeavy.otf"),
    NexaRegular: require("./assets/fonts/NexaRegular.otf"),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return <Navigators />;
}

export default Sentry.wrap(App);
