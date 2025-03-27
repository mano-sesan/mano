/* eslint-disable @typescript-eslint/no-unused-vars */
import { useRecoilValue, useSetRecoilState } from "recoil";
import { organisationState, userState } from "../recoil/auth";
import { usePreparePersonForEncryption } from "../recoil/persons";
import { loadingTextState } from "../services/dataLoader";
import { encryptObs } from "../recoil/territoryObservations";
import { OrganisationInstance } from "../types/organisation";
import API from "../services/api";
import { decryptItem } from "../services/encryption";
import { encryptAction } from "../recoil/actions";
import { ActionInstance } from "../types/action";

const LOADING_TEXT = "Mise à jour des données de votre organisation…";

/*eslint no-unused-vars: "off"*/
export default function useDataMigrator() {
  const setLoadingText = useSetRecoilState(loadingTextState);
  const user = useRecoilValue(userState);
  const setOrganisation = useSetRecoilState(organisationState);

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
      if (!organisation.migrations?.includes("fix-backslash-in-action-category")) {
        if (
          process.env.NODE_ENV === "development" ||
          import.meta.env.VITE_TEST_PLAYWRIGHT ||
          organisation._id === "d0396d00-4996-49ba-951a-fa95a3526022"
        ) {
          setLoadingText(LOADING_TEXT);
          // observations
          const actionsRes = await API.get({
            path: "/action",
            query: { organisation: organisationId, after: "0", withDeleted: false },
          });

          const decryptedActions = (await Promise.all(actionsRes.data.map((p) => decryptItem(p, { type: "actions" })))).filter((e) => e);

          const actionsToUpdate = decryptedActions.map((action: ActionInstance) => {
            return {
              ...action,
              categories: (action.categories || []).map((category) => {
                if (category === `Accueil\\/Refuge\\/lien`) {
                  return "Accueil/Refuge/lien";
                }
                if (category === `RdR Drog\\/Sex\\/Ethylo`) {
                  return "RdR Drog/Sex/Ethylo";
                }
                return category;
              }),
            };
          });

          const encryptedActions = await Promise.all(actionsToUpdate.map((a) => encryptAction(a)));

          const response = await API.put({
            path: `/migration/fix-backslash-in-action-category`,
            body: { encryptedActions },
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
