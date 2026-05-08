import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { Alert } from "react-native";
import { store } from "@/store";
import { offlineModeState } from "@/atoms/offlineMode";
import { useEffect } from "react";
// Manual offline mode toggle (user-controlled, persisted)

let alertShown = false;

function handleNetInfoChange(state: NetInfoState) {
  const connected = state.isConnected !== false && state.isInternetReachable !== false;
  const offlineMode = store.get(offlineModeState);

  if (!connected && !offlineMode && !alertShown) {
    // Note : we should test this feature before sending in production
    // because we don't know if the isConnected is reliable enough
    // and we don't want to sned fake alerts to the user
    // https://github.com/react-native-netinfo/react-native-netinfo?tab=readme-ov-file#netinfostate
    /* 
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
     */
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

export function useNetworkListener(isFocused: boolean) {
  useEffect(() => {
    if (isFocused) {
      const unsubscribeNetworkListener = startNetworkListener();
      return () => {
        unsubscribeNetworkListener?.();
      };
    }
  }, [isFocused]);
}
