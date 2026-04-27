import "./gesture-handler";

import "@expo/metro-runtime"; // Necessary for Fast Refresh on Web
import { registerRootComponent } from "expo";
import { setThemePreference } from "@vonovak/react-native-theme-control";
import App from "./src/App";

// Set theme
setThemePreference("light"); // 'light', 'dark', or 'system'

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
