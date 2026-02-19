import { atom } from "jotai";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { store } from "@/store";

export const isOnlineState = atom<boolean>(true);

type ReconnectCallback = () => void;
const reconnectCallbacks: ReconnectCallback[] = [];

let previouslyConnected = true;

export function onReconnect(callback: ReconnectCallback) {
  reconnectCallbacks.push(callback);
  return () => {
    const index = reconnectCallbacks.indexOf(callback);
    if (index !== -1) reconnectCallbacks.splice(index, 1);
  };
}

function handleNetInfoChange(state: NetInfoState) {
  const connected = state.isConnected !== false && state.isInternetReachable !== false;
  store.set(isOnlineState, connected);

  if (connected && !previouslyConnected) {
    for (const cb of reconnectCallbacks) {
      try {
        cb();
      } catch (e) {
        console.warn("[network] reconnect callback error:", e);
      }
    }
  }
  previouslyConnected = connected;
}

let unsubscribe: (() => void) | null = null;

export function startNetworkListener() {
  if (unsubscribe) return;
  unsubscribe = NetInfo.addEventListener(handleNetInfoChange);
  // Also do an initial check
  NetInfo.fetch().then(handleNetInfoChange);
}

export function stopNetworkListener() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
