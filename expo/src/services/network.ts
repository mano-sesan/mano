import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { Alert } from "react-native";
import { store } from "@/store";
import { atomWithCache } from "@/utils/atomWithCache";

// Manual offline mode toggle (user-controlled, persisted)
export const offlineModeState = atomWithCache<boolean>("mano-offline-mode", false);

let alertShown = false;

function handleNetInfoChange(state: NetInfoState) {
  const connected = state.isConnected !== false && state.isInternetReachable !== false;
  // Suggest offline/online mode based on network vs manual toggle mismatch
  const offlineMode = store.get(offlineModeState);

  if (!connected && !offlineMode && !alertShown) {
    alertShown = true;
    Alert.alert("Connexion faible", "Le réseau semble instable. Voulez-vous activer le mode hors ligne ?", [
      { text: "Non", style: "cancel", onPress: () => (alertShown = false) },
      {
        text: "Oui",
        onPress: () => {
          store.set(offlineModeState, true);
          alertShown = false;
        },
      },
    ]);
  }

  if (connected && offlineMode && !alertShown) {
    alertShown = true;
    Alert.alert("Connexion rétablie", "Le réseau semble stable. Voulez-vous désactiver le mode hors ligne ?", [
      { text: "Non", style: "cancel", onPress: () => (alertShown = false) },
      {
        text: "Oui",
        onPress: () => {
          store.set(offlineModeState, false);
          alertShown = false;
        },
      },
    ]);
  }
}

export function startNetworkListener() {
  NetInfo.fetch().then(handleNetInfoChange);
  return NetInfo.addEventListener(handleNetInfoChange);
}
