/* eslint-disable @typescript-eslint/no-unused-vars */
import { useRecoilValue, useSetRecoilState } from "recoil";
import { organisationState, userState } from "../recoil/auth";
import { usePreparePersonForEncryption } from "../recoil/persons";
import { loadingTextState } from "../services/dataLoader";
import { encryptObs } from "../recoil/territoryObservations";
import { OrganisationInstance } from "../types/organisation";
import API from "../services/api";
import { decryptItem, encryptItem } from "../services/encryption";

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
      const migrationLastUpdateAt = organisation.migrationLastUpdateAt;
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
      return true;
    },
  };
}
