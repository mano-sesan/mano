/* eslint-disable @typescript-eslint/no-unused-vars */
import { useRecoilValue, useSetRecoilState } from "recoil";
import { organisationState, userState } from "../recoil/auth";
import { usePreparePersonForEncryption } from "../recoil/persons";
import { loadingTextState } from "../services/dataLoader";
import { prepareObsForEncryption } from "../recoil/territoryObservations";
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
        if (organisation._id !== '0812e4b8-7ad5-4f91-a52c-8e4481fc3c4f') {
          setLoadingText(LOADING_TEXT);
          // observations
          const observationsRes = await API.get({
            path: "/territory-observation",
            query: { organisation: organisationId, after: '0', withDeleted: false },
          });
          
          const decryptedObservations = (await Promise.all(observationsRes.map((p) => decryptItem(p, { type: "territoryObservations" })))).filter((e) => e);
          
          const mapOldCustomObsFieldToNew = {
            personsMale: "custom-2025-02-07T12-48-36-475Z-cbc2e0e3-1f4b-4a6f-82a4-1b8bc0c16df2",
            personsFemale: "custom-2025-02-07T12-48-36-475Z-cccef3c4-09e8-48d7-bce8-210c70d30418",
            "custom-2021-11-19T15-56-51-129Z": "custom-2025-02-07T12-48-36-475Z-a3983263-64ea-4a63-8f1a-8de6135bdb84",
            "custom-2021-11-19T16-01-09-235Z": "custom-2025-02-07T12-48-36-475Z-8c1bc254-c0bd-4679-ac41-1b7d8cfc6eed",
            "custom-2021-11-29T14-59-46-058Z": "custom-2025-02-07T12-48-36-475Z-ba1f1adc-92ef-44ae-b71b-0f5f00e12993",
            "custom-2021-11-29T15-27-40-843Z": "custom-2025-02-07T12-48-36-475Z-90d15a44-3ea8-43c5-aaaa-9d96c4ffbcd9",
            "custom-2021-11-29T15-32-35-837Z": "custom-2025-02-07T12-48-36-475Z-40ed1e83-3ba9-417d-a6d7-0d956e6a8243",
            "custom-2021-11-29T15-32-54-539Z": "custom-2025-02-07T12-48-36-475Z-b1040a9f-ec3a-46ed-8f4b-1b98895a120b",
            "custom-2021-11-29T15-33-39-206Z": "custom-2025-02-07T12-48-36-475Z-003bbe6f-2ba6-44e7-8bc4-7239efdd521c",
            "custom-2021-11-29T16-17-54-202Z": "custom-2025-02-07T12-48-36-475Z-1a4f510b-dd14-4c9a-a8f8-acb9641b2fd6",
            "custom-2022-04-29T14-34-27-570Z": "custom-2025-02-07T12-48-36-475Z-f6a83cf9-b1b2-407e-b931-9e65f6da6608",
            "custom-2022-04-29T14-35-06-465Z": "custom-2025-02-07T12-48-36-475Z-87d932a4-b790-469a-8ada-bf601b2a3d74"
          }
          
          
          const obsToUpdate = decryptedObservations.map((obs) => {
            const nextObs = { ...obs };
            for (const [oldCustomFieldName, newCustomFieldName] of Object.entries(mapOldCustomObsFieldToNew)) {
              if (nextObs[oldCustomFieldName]) {
                nextObs[newCustomFieldName] = nextObs[oldCustomFieldName];
              }
            }
            return nextObs;
          });
          
          const encryptedObservations = await Promise.all(obsToUpdate.map(prepareObsForEncryption).map(encryptItem));

          // persons
          const personsRes = await API.get({  
            path: "/person",
            query: { organisation: organisationId, after: '0', withDeleted: false },
          });

          const decryptedPersons = (await Promise.all(personsRes.map((p) => decryptItem(p, { type: "persons" })))).filter((e) => e);
          
          const mapOldCustomPersonFieldToNew = {
            "custom-2024-04-22T08-16-31-736Z": "custom-2025-02-07T12-48-36-473Z-84465f04-8b85-4df8-ac3b-c6f91fc8cc19"
          }

          const personsToUpdate = decryptedPersons.map((person) => {
            const nextPerson = { ...person };
            for (const [oldCustomFieldName, newCustomFieldName] of Object.entries(mapOldCustomPersonFieldToNew)) {
              if (nextPerson[oldCustomFieldName]) {
                nextPerson[newCustomFieldName] = nextPerson[oldCustomFieldName];
              }
            }
            return nextPerson;
          });

          const encryptedPersons = await Promise.all(personsToUpdate.map(p => preparePersonForEncryption(p)).map(encryptItem));
          const response = await API.put({
            path: `/migration/fix-custom-field-divergence-after-import`,
            body: { encryptedObservations, encryptedPersons },
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
