import API, { tryFetchExpectOk } from "../services/api";
import { capture } from "../services/sentry";
import { decryptItem } from "../services/encryption";
import type { PersonInstance } from "../types/person";
import type { UUIDV4 } from "../types/uuid";

/**
 * Loads fresh person data from the server to prevent race conditions
 * when multiple users are editing the same person simultaneously.
 * This is especially important for long operations like file uploads.
 *
 * @param personId The ID of the person to load fresh data for
 * @returns Fresh person data or null if an error occurred
 */
export const loadFreshPersonData = async (personId: UUIDV4): Promise<PersonInstance | null> => {
  try {
    const [error, response] = await tryFetchExpectOk(async () => {
      return API.get({ path: `/person/${personId}` });
    });

    if (error) {
      console.error("Error loading fresh person data:", error);
      return null;
    }

    // Decrypt the person data
    const decryptedPerson = await decryptItem(response.data, { type: "persons" });
    return decryptedPerson;
  } catch (error) {
    console.error("Error in loadFreshPersonData:", error);
    capture(error);
    return null;
  }
};
