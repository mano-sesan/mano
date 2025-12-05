/**
 * Recurrence state and utilities
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { encryptItem } from "../services/encryption";

// State reference for backward compatibility
export const recurrencesState = { key: "recurrence" };

const encryptedFields = ["startDate", "endDate", "timeInterval", "timeUnit"];

export const prepareRecurrenceForEncryption = (recurrence, { checkRequiredFields = true } = {}) => {
  const decrypted = {};
  for (let field of encryptedFields) {
    decrypted[field] = recurrence[field];
  }
  return {
    _id: recurrence._id,
    createdAt: recurrence.createdAt,
    updatedAt: recurrence.updatedAt,
    deletedAt: recurrence.deletedAt,
    organisation: recurrence.organisation,

    decrypted,
    entityKey: recurrence.entityKey,
  };
};

export async function encryptRecurrence(recurrence, { checkRequiredFields = true } = {}) {
  return encryptItem(prepareRecurrenceForEncryption(recurrence, { checkRequiredFields }));
}
