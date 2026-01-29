/* eslint-disable @typescript-eslint/no-unused-vars */
import { useAtomValue, useSetAtom } from "jotai";
import { organisationState, userState } from "../atoms/auth";
import { usePreparePersonForEncryption } from "../atoms/persons";
import { loadingTextState } from "../services/dataLoader";
import { encryptObs } from "../atoms/territoryObservations";
import { OrganisationInstance } from "../types/organisation";
import API from "../services/api";
import { decryptItem, encryptItem } from "../services/encryption";

const LOADING_TEXT = "Mise à jour des données de votre organisation…";

/*eslint no-unused-vars: "off"*/
export default function useDataMigrator() {
  const setLoadingText = useSetAtom(loadingTextState);
  const user = useAtomValue(userState);
  const setOrganisation = useSetAtom(organisationState);

  const { preparePersonForEncryption } = usePreparePersonForEncryption();

  return {
    // One "if" for each migration.
    // `migrationLastUpdateAt` should be set after each migration and send in every PUT/POST/PATCH request to server.
    migrateData: async (organisation: OrganisationInstance) => {
      const organisationId = organisation?._id;
      let migrationLastUpdateAt = organisation.migrationLastUpdateAt;
      /*
      // Example of migration:
      if (!organisation.migrations?.includes("fix-custom-field-divergence-after-import")) {
      setLoadingText(LOADING_TEXT);
      const observationsRes = await API.get({
      path: "/territory-observation",
      query: { organisation: organisationId, after: 0, withDeleted: false },
      });
      
      const decryptedObservations = (await Promise.all(observationsRes.map((p) => decryptItem(p, { type: "territoryObservations" })))).filter((e) => e);
      
      
      const obsToUpdate = decryptedObservations.map((obs) => {
      // do something
      });
      
      const encryptedThingsToUpdate = await Promise.all(obsToUpdate.map(prepareObsForEncryption).map(encryptItem));
      const response = await API.put({
      path: `/migration/fix-custom-field-divergence-after-import`,
      body: { encryptedObservations: encryptedThingsToUpdate },
      query: { migrationLastUpdateAt },
      });
      if (response.ok) {
      setOrganisation(response.organisation);
      migrationLastUpdateAt = response.organisation.migrationLastUpdateAt;
      } else {
      return false;
      }
      }
      // End of example of migration.
      */
      if (!organisation.migrations?.includes("fix-custom-field-divergence-after-import")) {
        // migrations faites pour les organisations affectées par le bug
        // on garde encore ici si y'en a d'autres qui arriveraient
      }
      if (!organisation.migrations?.includes("set-followed-since-from-created-at")) {
        setLoadingText(LOADING_TEXT);
        const personsRes = await API.get({
          path: "/person",
          query: { organisation: organisationId, after: "0", withDeleted: false },
        });
        if (!personsRes.ok) {
          return false;
        }
        const decryptedPersons = (await Promise.all(personsRes.data.map((p) => decryptItem(p, { type: "person" })))).filter((e) => e);

        const personsToUpdate: typeof decryptedPersons = [];
        for (const person of decryptedPersons) {
          if (!person.followedSince && person.createdAt) {
            personsToUpdate.push({
              ...person,
              followedSince: person.createdAt,
            });
          }
        }

        if (personsToUpdate.length > 0) {
          const encryptedPersonsToUpdate = await Promise.all(personsToUpdate.map((p) => preparePersonForEncryption(p)).map(encryptItem));
          const response = await API.put({
            path: `/migration/set-followed-since-from-created-at`,
            body: { encryptedPersons: encryptedPersonsToUpdate },
            query: { migrationLastUpdateAt },
          });
          if (response.ok) {
            setOrganisation(response.organisation);
            migrationLastUpdateAt = response.organisation.migrationLastUpdateAt;
          } else {
            return false;
          }
        } else {
          // No persons to update, but still mark the migration as done
          const response = await API.put({
            path: `/migration/set-followed-since-from-created-at`,
            body: { encryptedPersons: [] },
            query: { migrationLastUpdateAt },
          });
          if (response.ok) {
            setOrganisation(response.organisation);
            migrationLastUpdateAt = response.organisation.migrationLastUpdateAt;
          } else {
            return false;
          }
        }
      }
      return true;
    },
  };
}
