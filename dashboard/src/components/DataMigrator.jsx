import { useRecoilValue, useSetRecoilState } from "recoil";
import { organisationState, userState } from "../recoil/auth";
import { dayjsInstance } from "../services/date";
import { loadingTextState } from "./DataLoader";
import { capture } from "../services/sentry";
import { decryptItem } from "../services/encryption";
import { defaultCustomFields, encryptObs } from "../recoil/territoryObservations";
import api from "../services/apiv2";

const LOADING_TEXT = "Mise à jour des données de votre organisation…";

/*eslint no-unused-vars: "off"*/
export default function useDataMigrator() {
  const setLoadingText = useSetRecoilState(loadingTextState);
  const user = useRecoilValue(userState);
  const setOrganisation = useSetRecoilState(organisationState);

  return {
    // One "if" for each migration.
    // `migrationLastUpdateAt` should be set after each migration and send in every PUT/POST/PATCH request to server.
    migrateData: async (organisation) => {
      const organisationId = organisation?._id;
      let migrationLastUpdateAt = organisation.migrationLastUpdateAt;
      /*
      // Example of migration:
      if (!organisation.migrations?.includes('migration-name')) {
        setLoadingText(LOADING_TEXT);
        const somethingRes = await API.get({
          path: '/something-to-update',
          query: { organisation: organisationId, after: 0, withDeleted: false },
        }).then((res) => res.decryptedData || []);

        const somethingToUpdate = somethingRes.map((e) => {
          // do something
        });

        const encryptedThingsToUpdate = await Promise.all(somethingToUpdate.map(prepareForEncryption).map(encryptItem));
        const response = await API.put({
          path: `/migration/migration-name`,
          body: { thingsToUpdate: encryptedThingsToUpdate, thingsIdsToDestroy: [] },
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

      if (!organisation.migrations?.includes("reformat-observedAt-observations-fixed")) {
        // FIXME: vérifier que ça marche
        // some observedAt are timestamp, some are date
        // it messes up the filtering by date in stats
        setLoadingText(LOADING_TEXT);
        const observationsRes = await api
          .get("/territory-observation", { organisation: organisationId, after: 0, withDeleted: false })
          .then((res) => decryptItem(res.data))
          .catch((e) => {
            capture(e);
            return false;
          });

        const observationIdsToDelete = {}; // we create an object for the loop line 87 to be fast enough
        for (const observation of observationsRes) {
          if (!observation.territory || !observation.team) {
            observationIdsToDelete[observation._id] = true;
          }
        }

        const observationsWithFullData = observationsRes
          .filter((obs) => !observationIdsToDelete[obs._id])
          .map((obs) => {
            const observedAt = !isNaN(Number(obs.observedAt)) // i.e. is timestamp
              ? dayjsInstance(Number(obs.observedAt)).toISOString()
              : dayjsInstance(obs.observedAt ?? obs.createdAt).toISOString();
            return {
              ...obs,
              user: typeof obs.user === "string" ? obs.user : user._id, // sometimes user is an empty {} instead of a uuid
              observedAt,
            };
          });

        const customFieldsObs = Array.isArray(organisation.customFieldsObs) ? organisation.customFieldsObs : defaultCustomFields;

        const encryptedObservations = await Promise.all(observationsWithFullData.map(encryptObs(customFieldsObs)));

        const response = await api.put(
          `/migration/reformat-observedAt-observations-fixed`,
          { encryptedObservations, observationIdsToDelete: Object.keys(observationIdsToDelete) },
          { migrationLastUpdateAt }
        );
        if (response.ok) {
          setOrganisation(response.organisation);
          migrationLastUpdateAt = response.organisation.migrationLastUpdateAt;
        } else {
          return false;
        }
      }
      return true;
    },
  };
}
