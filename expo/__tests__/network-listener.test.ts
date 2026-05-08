import { describe, it, expect, beforeEach, vi } from "vitest";
import { store } from "@/store";
import { offlineModeState } from "@/atoms/offlineMode";

const { mockStorage, mockAlert, netInfoListeners, mockNetInfo } = vi.hoisted(() => {
  const listeners: Array<(state: any) => void> = [];
  return {
    mockStorage: new Map<string, string>(),
    mockAlert: vi.fn(),
    netInfoListeners: listeners,
    mockNetInfo: {
      fetch: vi.fn(async () => ({ isConnected: true, isInternetReachable: true })),
      addEventListener: vi.fn((cb: (state: any) => void) => {
        listeners.push(cb);
        return () => {
          const idx = listeners.indexOf(cb);
          if (idx >= 0) listeners.splice(idx, 1);
        };
      }),
    },
  };
});

vi.mock("react-native-mmkv", () => ({
  MMKV: class {
    getString(key: string) {
      return mockStorage.get(key);
    }
    set(key: string, value: string) {
      mockStorage.set(key, value);
    }
    delete(key: string) {
      mockStorage.delete(key);
    }
    clearAll() {
      mockStorage.clear();
    }
  },
}));

vi.mock("react-native", () => ({
  Alert: { alert: mockAlert },
  Platform: { OS: "ios", select: (obj: any) => obj.ios ?? obj.default },
}));

vi.mock("@react-native-community/netinfo", () => ({
  default: mockNetInfo,
  __esModule: true,
}));

import { startNetworkListener } from "@/services/offline/network";

// On démarre une seule fois — le module garde son état alertShown.
// Les tests sont conçus pour fonctionner indépendamment de cet état module-level :
// chaque test pilote explicitement le cycle (Oui/Non) pour reset l'alertShown.
let handler: (state: any) => void;
beforeEach(() => {
  mockStorage.clear();
  store.set(offlineModeState, false);
  vi.clearAllMocks();
  if (netInfoListeners.length === 0) {
    startNetworkListener();
  }
  handler = netInfoListeners[0];

  // Reset l'état module-level alertShown : si une alerte est ouverte, on la clôt via Non.
  // On déclenche une fausse "perte de connexion en mode offline" qui n'affiche jamais d'alerte
  // (branche désactivée), juste pour passer dans handleNetInfoChange sans effet.
  // Pour vraiment reset alertShown, on simule le scénario "reconnect en offline" puis "Non".
  store.set(offlineModeState, true);
  handler({ isConnected: true, isInternetReachable: true });
  if (mockAlert.mock.calls.length > 0) {
    const buttons = mockAlert.mock.calls[0][2];
    const nonButton = buttons?.find((b: any) => b.text === "Non");
    nonButton?.onPress();
  }

  // État propre pour le test
  store.set(offlineModeState, false);
  vi.clearAllMocks();
});

describe("startNetworkListener", () => {
  it("reconnexion en mode offline : Alert proposé, choix Oui désactive offline", () => {
    store.set(offlineModeState, true);
    handler({ isConnected: true, isInternetReachable: true });

    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert.mock.calls[0][0]).toBe("Connexion rétablie");

    const buttons = mockAlert.mock.calls[0][2];
    const ouiButton = buttons.find((b: any) => b.text === "Oui");
    ouiButton.onPress();

    expect(store.get(offlineModeState)).toBe(false);
  });

  it("alertShown debouncing : 2e changement consécutif n'affiche pas un 2e Alert", () => {
    store.set(offlineModeState, true);
    handler({ isConnected: true, isInternetReachable: true });
    expect(mockAlert).toHaveBeenCalledTimes(1);

    handler({ isConnected: true, isInternetReachable: true });
    expect(mockAlert).toHaveBeenCalledTimes(1);

    // Reset pour le test suivant via Non
    const buttons = mockAlert.mock.calls[0][2];
    buttons.find((b: any) => b.text === "Non").onPress();
  });

  it("connexion stable + pas de offline mode : pas d'Alert", () => {
    store.set(offlineModeState, false);
    handler({ isConnected: true, isInternetReachable: true });
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it("perte de connexion (sans offline mode) : branche désactivée → pas d'Alert", () => {
    // Régression-test : la branche "Connexion faible" est commentée actuellement.
    // Si quelqu'un la décommente, ce test cassera et il faudra l'ajuster sciemment.
    store.set(offlineModeState, false);
    handler({ isConnected: false, isInternetReachable: false });
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
