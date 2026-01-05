import API, { tryFetchExpectOk } from "./api";

export const FORCE_LOGOUT_BROADCAST_KEY = "mano-force-logout";

// Module-level flag to track if this tab initiated the logout.
// This prevents the tab from processing its own logout broadcast.
let thisTabInitiatedLogout = false;

export function markLogoutInitiatedByThisTab() {
  thisTabInitiatedLogout = true;
}

export function isLogoutInitiatedByThisTab() {
  return thisTabInitiatedLogout;
}

export function resetLogoutInitiatedFlag() {
  thisTabInitiatedLogout = false;
}

function broadcastLogoutToOtherTabs() {
  try {
    // Remove the key first to ensure a storage event is triggered reliably,
    // then set a value that always changes (timestamp + random component).
    window.localStorage.removeItem(FORCE_LOGOUT_BROADCAST_KEY);
    window.localStorage.setItem(FORCE_LOGOUT_BROADCAST_KEY, JSON.stringify({ ts: Date.now(), rand: Math.random() }));
  } catch (_e) {
    // ignore
  }
}

/**
 * Centralized logout utility function that handles both the API call and the broadcast to other tabs.
 * This ensures all logout paths properly notify other tabs to avoid broken cached state.
 *
 * @param {Object} options - Logout options
 * @param {boolean} options.broadcast - Whether to broadcast logout to other tabs (default: true)
 * @returns {Promise} - Promise that resolves when the logout API call completes
 */
export function logout({ broadcast = true } = {}) {
  if (broadcast) {
    // Mark this tab as the logout initiator before broadcasting
    markLogoutInitiatedByThisTab();
    // Notify other tabs to logout ASAP (storage event is fired in other tabs).
    broadcastLogoutToOtherTabs();
  }

  return tryFetchExpectOk(() => API.post({ path: "/user/logout" }));
}
