/**
 * Modal state
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { useStore, defaultModalActionState, defaultModalObservationState } from "../store";
import type { ActionInstance } from "../types/action";
import type { TerritoryObservationInstance } from "../types/territoryObs";
import type { RencontreInstance } from "../types/rencontre";

// Re-export types
export type { ModalActionState, ModalObservationState } from "../store";

// Re-export default state creators
export { defaultModalActionState, defaultModalObservationState };

// State references for backward compatibility
export const modalActionState = { key: "modalAction" };
export const modalObservationState = { key: "modalObservation" };
