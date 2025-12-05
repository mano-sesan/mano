/**
 * Version state
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { dayjsInstance } from "../services/date";

// State references for backward compatibility
export const deploymentDateState = { key: "deploymentDateState" };
export const deploymentCommitState = { key: "deploymentCommitState" };

// These are selector references - use showOutdateAlertBannerSelector from store/selectors instead
export const deploymentShortCommitSHAState = { key: "shortCommitSHAState" };
export const showOutdateAlertBannerState = { key: "showOutdateAlertBannerState" };
