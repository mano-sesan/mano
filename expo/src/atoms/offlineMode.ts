import { atomWithCache } from "@/utils/atomWithCache";

// Manual offline mode toggle (user-controlled, persisted)
export const offlineModeState = atomWithCache<boolean>("mano-offline-mode", false);
