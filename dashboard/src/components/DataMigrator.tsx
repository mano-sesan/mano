/* eslint-disable @typescript-eslint/no-unused-vars */
import { useRecoilValue, useSetRecoilState } from "recoil";
import { organisationState, userState } from "../recoil/auth";
import { usePreparePersonForEncryption } from "../recoil/persons";
import { loadingTextState } from "../services/dataLoader";
import API from "../services/api";
import { sanitize } from "../utils/sanitize";
import { type OrganisationInstance } from "../types/organisation";
import { prepareActionForEncryption } from "../recoil/actions";
import { decryptItem, encryptItem } from "../services/encryption";
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

      if (!organisation.migrations?.includes("actions-categories-sanitization")) {
        setLoadingText(LOADING_TEXT);
        const actionsRes = await API.get({
          path: "/action",
          query: { organisation: organisationId, after: "0", withDeleted: false },
        });
        const decryptedActions = (await Promise.all(actionsRes.data.map((p) => decryptItem(p, { type: "actions" })))).filter((e) => e);

        const actionsToUpdate = decryptedActions.map((action: ActionInstance) => ({
          ...action,
          categories: action.categories.map(sanitize),
        }));

        const newActionsGroupedCategories = organisation.actionsGroupedCategories.map((group) => {
          return {
            ...group,
            categories: [...new Set((group.categories || []).map(sanitize))],
          };
        });

        const encryptedActionsToUpdate = await Promise.all(actionsToUpdate.map((a) => prepareActionForEncryption(a)).map(encryptItem));
        const response = await API.put({
          path: `/migration/actions-categories-sanitization`,
          body: { actions: encryptedActionsToUpdate, actionsGroupedCategories: newActionsGroupedCategories },
          query: { migrationLastUpdateAt },
        });
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
