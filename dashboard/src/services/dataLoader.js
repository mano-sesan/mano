/* eslint-disable no-inner-declarations */
// Pour l'historique git, avant le code était ici : dashboard/src/components/DataLoader.jsx
import { useEffect } from "react";
import { atom, useRecoilState, useSetRecoilState } from "recoil";
import { toast } from "react-toastify";

import { personsState } from "../recoil/persons";
import { groupsState } from "../recoil/groups";
import { treatmentsState } from "../recoil/treatments";
import { actionsState } from "../recoil/actions";
import { medicalFileState } from "../recoil/medicalFiles";
import { passagesState } from "../recoil/passages";
import { rencontresState } from "../recoil/rencontres";
import { reportsState } from "../recoil/reports";
import { territoriesState } from "../recoil/territory";
import { placesState } from "../recoil/places";
import { relsPersonPlaceState } from "../recoil/relPersonPlace";
import { territoryObservationsState } from "../recoil/territoryObservations";
import { consultationsState, formatConsultation } from "../recoil/consultations";
import { commentsState } from "../recoil/comments";
import { organisationState, teamsState, userState } from "../recoil/auth";

import { clearCache, dashboardCurrentCacheKey, getCacheItemDefaultValue, setCacheItem } from "../services/dataManagement";
import API, { tryFetch, tryFetchExpectOk } from "../services/api";
import useDataMigrator from "../components/DataMigrator";
import { decryptItem, getHashedOrgEncryptionKey } from "../services/encryption";
import { errorMessage } from "../utils";
import { recurrencesState } from "../recoil/recurrences";

// Update to flush cache.
export const isLoadingState = atom({ key: "isLoadingState", default: false });
export const fullScreenState = atom({ key: "fullScreenState", default: true });
export const progressState = atom({ key: "progressState", default: null });
export const totalState = atom({ key: "totalState", default: null });
export const totalLoadingDurationState = atom({
  key: "totalLoadingDurationState",
  default: 0,
  effects: [({ onSet }) => onSet((newValue) => window.localStorage.setItem("totalLoadingDuration", newValue))],
});
const initialLoadingTextState = "En attente de chargement";
export const loadingTextState = atom({ key: "loadingTextState", default: initialLoadingTextState });
export const initialLoadIsDoneState = atom({ key: "initialLoadIsDoneState", default: false });

export function useDataLoader(options = { refreshOnMount: false }) {
  const [fullScreen, setFullScreen] = useRecoilState(fullScreenState);
  const [isLoading, setIsLoading] = useRecoilState(isLoadingState);
  const setLoadingText = useSetRecoilState(loadingTextState);
  const setInitialLoadIsDone = useSetRecoilState(initialLoadIsDoneState);
  const setTotalLoadingDuration = useSetRecoilState(totalLoadingDurationState);
  const setProgress = useSetRecoilState(progressState);
  const setTotal = useSetRecoilState(totalState);

  const [user, setUser] = useRecoilState(userState);
  const [teams, setTeams] = useRecoilState(teamsState);
  const [organisation, setOrganisation] = useRecoilState(organisationState);
  const { migrateData } = useDataMigrator();

  const [persons, setPersons] = useRecoilState(personsState);
  const [groups, setGroups] = useRecoilState(groupsState);
  const [reports, setReports] = useRecoilState(reportsState);
  const [passages, setPassages] = useRecoilState(passagesState);
  const [rencontres, setRencontres] = useRecoilState(rencontresState);
  const [actions, setActions] = useRecoilState(actionsState);
  const [recurrences, setRecurrences] = useRecoilState(recurrencesState);
  const [territories, setTerritories] = useRecoilState(territoriesState);
  const [places, setPlaces] = useRecoilState(placesState);
  const [relsPersonPlace, setRelsPersonPlace] = useRecoilState(relsPersonPlaceState);
  const [territoryObservations, setTerritoryObservations] = useRecoilState(territoryObservationsState);
  const [comments, setComments] = useRecoilState(commentsState);
  const [consultations, setConsultations] = useRecoilState(consultationsState);
  const [treatments, setTreatments] = useRecoilState(treatmentsState);
  const [medicalFiles, setMedicalFiles] = useRecoilState(medicalFileState);

  useEffect(function refreshOnMountEffect() {
    if (options.refreshOnMount && !isLoading) loadOrRefreshData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOrRefreshData(isStartingInitialLoad) {
    // premier check du chiffrement activé: si pas de clé de chiffrement, pas de donnée à télécharger
    if (!getHashedOrgEncryptionKey()) return false;
    setIsLoading(true);
    setFullScreen(isStartingInitialLoad);
    setLoadingText(isStartingInitialLoad ? "Chargement des données" : "Mise à jour des données");

    let lastLoadValue = await getCacheItemDefaultValue(dashboardCurrentCacheKey, 0);
    let now = Date.now();

    // On vérifie s'il y a un autre identifiant d'organisation dans le cache pour le supprimer le cas échéant
    const otherOrganisationId = await getCacheItemDefaultValue("organisationId", null);
    if (otherOrganisationId && otherOrganisationId !== organisation._id) {
      setLoadingText("Nettoyage du cache de la précédente organisation");
      await clearCache("otherOrganisationId");
      lastLoadValue = 0;
    }

    // Refresh organisation (and user), to get the latest organisation fields and the latest user roles
    const [userError, userResponse] = await tryFetch(() => {
      return API.getAbortable({ path: "/user/me" });
    });
    if (userError || !userResponse.ok) return resetLoaderOnError(userError || userResponse.error);

    const latestOrganisation = userResponse.user.organisation;
    const latestUser = userResponse.user;
    const latestTeams = userResponse.user.orgTeams;
    const organisationId = latestOrganisation._id;
    if (organisation.encryptionLastUpdateAt !== latestOrganisation.encryptionLastUpdateAt) {
      return toast.error("La clé de chiffrement a changé ou a été régénérée. Veuillez vous déconnecter et vous reconnecter avec la nouvelle clé.");
    }
    if (JSON.stringify(latestOrganisation) !== JSON.stringify(organisation)) {
      setOrganisation(latestOrganisation);
    }
    if (JSON.stringify(latestTeams) !== JSON.stringify(teams)) {
      setTeams(latestTeams);
    }
    if (JSON.stringify(latestUser) !== JSON.stringify(user)) {
      setUser(latestUser);
    }
    if (isStartingInitialLoad) {
      const migrationIsSuccessful = await migrateData(latestOrganisation);
      if (!migrationIsSuccessful) return resetLoaderOnError();
    }

    const [statsError, statsResponse] = await tryFetchExpectOk(() => {
      return API.getAbortable({
        path: "/organisation/stats",
        query: {
          organisation: organisationId,
          after: lastLoadValue,
          withDeleted: true,
          // Medical data is never saved in cache so we always have to download all at every page reload.
          withAllMedicalData: isStartingInitialLoad,
        },
      });
    });

    if (statsError) return false;

    // Get date from server just after getting all the stats
    // We'll set the `lastLoadValue` to this date after all the data is downloaded
    const [serverDateError, serverDateResponse] = await tryFetchExpectOk(() => {
      return API.getAbortable({ path: "/now" });
    });
    if (serverDateError) return resetLoaderOnError(serverDateError);
    const serverDate = serverDateResponse.data;

    const stats = statsResponse.data;
    let itemsCount =
      0 +
      stats.persons +
      stats.groups +
      stats.reports +
      stats.passages +
      stats.rencontres +
      stats.actions +
      stats.territories +
      stats.places +
      stats.relsPersonPlace +
      stats.territoryObservations +
      stats.comments +
      stats.consultations;

    if (["admin", "normal"].includes(latestUser.role)) {
      itemsCount += stats.treatments + stats.medicalFiles;
    }

    setProgress(0);
    setTotal(itemsCount);

    const query = {
      organisation: organisationId,
      limit: String(10000),
      after: lastLoadValue,
      withDeleted: true,
    };

    let newPersons = [];
    if (stats.persons > 0) {
      setLoadingText("Chargement des personnes");
      async function loadPersons(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/person", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "persons" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newPersons.push(...decryptedData);
        if (res.hasMore) return loadPersons(page + 1);
        return true;
      }
      const personSuccess = await loadPersons(0);
      if (!personSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cachePersons = await getCacheItemDefaultValue("person", []);
      if (newPersons.length) {
        setPersons(mergeItems(cachePersons, newPersons));
      } else {
        setPersons(cachePersons);
      }
    } else if (newPersons.length) {
      setPersons(mergeItems(persons, newPersons));
    }

    let newGroups = [];
    if (stats.groups > 0) {
      setLoadingText("Chargement des familles");
      async function loadGroups(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/group", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "groups" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newGroups.push(...decryptedData);
        if (res.hasMore) return loadGroups(page + 1);
        return true;
      }
      const groupsSuccess = await loadGroups(0);
      if (!groupsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheGroups = await getCacheItemDefaultValue("group", []);
      if (newGroups.length) {
        setGroups(mergeItems(cacheGroups, newGroups));
      } else {
        setGroups(cacheGroups);
      }
    } else if (newGroups.length) {
      setGroups(mergeItems(groups, newGroups));
    }

    let newReports = [];
    if (stats.reports > 0) {
      setLoadingText("Chargement des comptes-rendus");
      async function loadReports(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/report", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "reports" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newReports.push(...decryptedData);
        if (res.hasMore) return loadReports(page + 1);
        return true;
      }
      const reportsSuccess = await loadReports(0);
      if (!reportsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheReports = await getCacheItemDefaultValue("report", []);
      if (newReports.length) {
        setReports(mergeItems(cacheReports, newReports, { filterNewItemsFunction: (r) => !!r.team && !!r.date }));
      } else {
        setReports(cacheReports);
      }
    } else if (newReports.length) {
      setReports(mergeItems(reports, newReports, { filterNewItemsFunction: (r) => !!r.team && !!r.date }));
    }

    let newPassages = [];
    if (stats.passages > 0) {
      setLoadingText("Chargement des passages");
      async function loadPassages(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/passage", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "passages" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newPassages.push(...decryptedData);
        if (res.hasMore) return loadPassages(page + 1);
        return true;
      }
      const passagesSuccess = await loadPassages(0);
      if (!passagesSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cachePassages = await getCacheItemDefaultValue("passage", []);
      if (newPassages.length) {
        setPassages(mergeItems(cachePassages, newPassages));
      } else {
        setPassages(cachePassages);
      }
    } else if (newPassages.length) {
      setPassages(mergeItems(passages, newPassages));
    }

    let newRencontres = [];
    if (stats.rencontres > 0) {
      setLoadingText("Chargement des rencontres");
      async function loadRencontres(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/rencontre", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "rencontres" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newRencontres.push(...decryptedData);
        if (res.hasMore) return loadRencontres(page + 1);
        return true;
      }
      const rencontresSuccess = await loadRencontres(0);
      if (!rencontresSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheRencontres = await getCacheItemDefaultValue("rencontre", []);
      if (newRencontres.length) {
        setRencontres(mergeItems(cacheRencontres, newRencontres));
      } else {
        setRencontres(cacheRencontres);
      }
    } else if (newRencontres.length) {
      setRencontres(mergeItems(rencontres, newRencontres));
    }

    let newActions = [];
    if (stats.actions > 0) {
      setLoadingText("Chargement des actions");
      async function loadActions(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/action", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "actions" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newActions.push(...decryptedData);
        if (res.hasMore) return loadActions(page + 1);
        return true;
      }
      const actionsSuccess = await loadActions(0);
      if (!actionsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheActions = await getCacheItemDefaultValue("action", []);
      if (newActions.length) {
        setActions(mergeItems(cacheActions, newActions));
      } else {
        setActions(cacheActions);
      }
    } else if (newActions.length) {
      setActions(mergeItems(actions, newActions));
    }

    let newRecurrences = [];
    if (stats.recurrences > 0) {
      setLoadingText("Chargement des actions récurrentes");
      async function loadRecurrences(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/recurrence", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "recurrence" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newRecurrences.push(...decryptedData);
        if (res.hasMore) return loadRecurrences(page + 1);
        return true;
      }
      const recurrencesSuccess = await loadRecurrences(0);
      if (!recurrencesSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheRecurrences = await getCacheItemDefaultValue("recurrence", []);
      if (newRecurrences.length) {
        setRecurrences(mergeItems(cacheRecurrences, newRecurrences));
      } else {
        setRecurrences(cacheRecurrences);
      }
    } else if (newRecurrences.length) {
      setRecurrences(mergeItems(recurrences, newRecurrences));
    }

    let newTerritories = [];
    if (stats.territories > 0) {
      setLoadingText("Chargement des territoires");
      async function loadTerritories(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/territory", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "territories" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newTerritories.push(...decryptedData);
        if (res.hasMore) return loadTerritories(page + 1);
        return true;
      }
      const territoriesSuccess = await loadTerritories(0);
      if (!territoriesSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheTerritories = await getCacheItemDefaultValue("territory", []);
      if (newTerritories.length) {
        setTerritories(mergeItems(cacheTerritories, newTerritories));
      } else {
        setTerritories(cacheTerritories);
      }
    } else if (newTerritories.length) {
      setTerritories(mergeItems(territories, newTerritories));
    }

    let newPlaces = [];
    if (stats.places > 0) {
      setLoadingText("Chargement des lieux");
      async function loadPlaces(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/place", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "places" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newPlaces.push(...decryptedData);
        if (res.hasMore) return loadPlaces(page + 1);
        return true;
      }
      const placesSuccess = await loadPlaces(0);
      if (!placesSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cachePlaces = await getCacheItemDefaultValue("place", []);
      if (newPlaces.length) {
        setPlaces(mergeItems(cachePlaces, newPlaces));
      } else {
        setPlaces(cachePlaces);
      }
    } else if (newPlaces.length) {
      setPlaces(mergeItems(places, newPlaces));
    }

    let newRelsPersonPlace = [];
    if (stats.relsPersonPlace > 0) {
      setLoadingText("Chargement des relations personne-lieu");
      async function loadRelsPersonPlace(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/relPersonPlace", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "relsPersonPlace" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newRelsPersonPlace.push(...decryptedData);
        if (res.hasMore) return loadRelsPersonPlace(page + 1);
        return true;
      }
      const relsPersonPlaceSuccess = await loadRelsPersonPlace(0);
      if (!relsPersonPlaceSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheRelsPersonPlace = await getCacheItemDefaultValue("relPersonPlace", []);
      if (newRelsPersonPlace.length) {
        setRelsPersonPlace(mergeItems(cacheRelsPersonPlace, newRelsPersonPlace));
      } else {
        setRelsPersonPlace(cacheRelsPersonPlace);
      }
    } else if (newRelsPersonPlace.length) {
      setRelsPersonPlace(mergeItems(relsPersonPlace, newRelsPersonPlace));
    }

    let newTerritoryObservations = [];
    if (stats.territoryObservations > 0) {
      setLoadingText("Chargement des observations de territoire");
      async function loadObservations(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/territory-observation", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "territoryObservations" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newTerritoryObservations.push(...decryptedData);
        if (res.hasMore) return loadObservations(page + 1);
        return true;
      }
      const territoryObservationsSuccess = await loadObservations(0);
      if (!territoryObservationsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheTerritoryObservations = await getCacheItemDefaultValue("territory-observation", []);
      if (newTerritoryObservations.length) {
        setTerritoryObservations(mergeItems(cacheTerritoryObservations, newTerritoryObservations));
      } else {
        setTerritoryObservations(cacheTerritoryObservations);
      }
    } else if (newTerritoryObservations.length) {
      setTerritoryObservations(mergeItems(territoryObservations, newTerritoryObservations));
    }

    let newComments = [];
    if (stats.comments > 0) {
      setLoadingText("Chargement des commentaires");
      async function loadComments(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/comment", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "comments" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newComments.push(...decryptedData);
        if (res.hasMore) return loadComments(page + 1);
        return true;
      }
      const commentsSuccess = await loadComments(0);
      if (!commentsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheComments = await getCacheItemDefaultValue("comment", []);
      if (newComments.length) {
        setComments(mergeItems(cacheComments, newComments));
      } else {
        setComments(cacheComments);
      }
    } else if (newComments.length) {
      setComments(mergeItems(comments, newComments));
    }

    let newConsultations = [];
    if (stats.consultations > 0) {
      setLoadingText("Chargement des consultations");
      async function loadConsultations(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({
            path: "/consultation",
            query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue },
          });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "consultations" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newConsultations.push(...decryptedData);
        if (res.hasMore) return loadConsultations(page + 1);
        return true;
      }
      const consultationsSuccess = await loadConsultations(0);
      if (!consultationsSuccess) return false;
    }
    if (isStartingInitialLoad) {
      const cacheConsultations = await getCacheItemDefaultValue("consultation", []);
      if (newConsultations.length) {
        setConsultations(mergeItems(cacheConsultations, newConsultations, { formatNewItemsFunction: formatConsultation }));
      } else {
        setConsultations(cacheConsultations);
      }
    } else if (newConsultations.length) {
      setConsultations(mergeItems(consultations, newConsultations, { formatNewItemsFunction: formatConsultation }));
    }

    if (["admin", "normal"].includes(latestUser.role)) {
      let newTreatments = [];
      if (stats.treatments > 0) {
        setLoadingText("Chargement des traitements");
        async function loadTreatments(page = 0) {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({
              path: "/treatment",
              query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue },
            });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "treatments" })))).filter((e) => e);
          setProgress((p) => p + res.data.length);
          newTreatments.push(...decryptedData);
          if (res.hasMore) return loadTreatments(page + 1);
          return true;
        }
        const treatmentsSuccess = await loadTreatments(0);
        if (!treatmentsSuccess) return false;
      }

      if (isStartingInitialLoad) {
        const cacheTreatments = await getCacheItemDefaultValue("treatment", []);
        if (newTreatments.length) {
          setTreatments(mergeItems(cacheTreatments, newTreatments));
        } else {
          setTreatments(cacheTreatments);
        }
      } else if (newTreatments.length) {
        setTreatments(mergeItems(treatments, newTreatments));
      }
    }

    if (["admin", "normal"].includes(latestUser.role)) {
      let newMedicalFiles = [];
      if (stats.medicalFiles > 0) {
        setLoadingText("Chargement des fichiers médicaux");
        async function loadMedicalFiles(page = 0) {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({
              path: "/medical-file",
              query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue },
            });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "medicalFiles" })))).filter((e) => e);
          setProgress((p) => p + res.data.length);
          newMedicalFiles.push(...decryptedData);
          if (res.hasMore) return loadMedicalFiles(page + 1);
          return true;
        }
        const medicalFilesSuccess = await loadMedicalFiles(0);
        if (!medicalFilesSuccess) return false;
      }

      if (isStartingInitialLoad) {
        const cacheMedicalFiles = await getCacheItemDefaultValue("medical-file", []);
        if (newMedicalFiles.length) {
          setMedicalFiles(mergeItems(cacheMedicalFiles, newMedicalFiles));
        } else {
          setMedicalFiles(cacheMedicalFiles);
        }
      } else if (newMedicalFiles.length) {
        setMedicalFiles(mergeItems(medicalFiles, newMedicalFiles));
      }
    }

    // deuxième check du chiffrement activé, dans le scénario où
    // 1. focus sur la page: on refresh
    // 2. session trop longue: on verrouille et la clé de chiffrement est supprimée MAIS le refresh est lancé avant
    // 3. problème: on a téléchargé des éléments mais non déchiffrés DONC
    // => pour éviter des problèmes de cache on n'enrteigtre pas le `await setCacheItem(dashboardCurrentCacheKey, serverDate);`
    if (!getHashedOrgEncryptionKey()) return false;
    // On enregistre également l'identifiant de l'organisation
    setCacheItem("organisationId", organisationId);
    setIsLoading(false);
    if (!lastLoadValue) setTotalLoadingDuration((d) => d + Date.now() - now);
    await setCacheItem(dashboardCurrentCacheKey, serverDate);
    setLoadingText("En attente de rafraichissement");
    setProgress(null);
    setTotal(null);
    setInitialLoadIsDone(true);
    return true;
  }

  async function resetLoaderOnError(error) {
    // an error was thrown, the data was not downloaded,
    // this can result in data corruption, we need to reset the loader
    await clearCache("resetLoaderOnError");
    // Pas de message d'erreur si la page est en train de se fermer
    // et que l'erreur est liée à une requête annulable.
    if (error?.name === "BeforeUnloadAbortError") return false;
    toast.error(errorMessage(error || "Désolé, une erreur est survenue lors du chargement de vos données, veuillez réessayer"), {
      onClose: () => window.location.replace("/auth"),
      autoClose: 5000,
    });
    return false;
  }

  return {
    refresh: () => loadOrRefreshData(false),
    startInitialLoad: () => loadOrRefreshData(true),
    isLoading: Boolean(isLoading),
    isFullScreen: Boolean(fullScreen),
  };
}

export function mergeItems(oldItems, newItems = [], { formatNewItemsFunction, filterNewItemsFunction } = {}) {
  const newItemsCleanedAndFormatted = [];
  const newItemIds = {};

  for (const newItem of newItems) {
    newItemIds[newItem._id] = true;
    if (newItem.deletedAt) continue;
    if (filterNewItemsFunction) {
      if (!filterNewItemsFunction(newItem)) continue;
    }
    if (formatNewItemsFunction) {
      newItemsCleanedAndFormatted.push(formatNewItemsFunction(newItem));
    } else {
      newItemsCleanedAndFormatted.push(newItem);
    }
  }

  const oldItemsPurged = [];
  for (const oldItem of oldItems) {
    if (oldItem.deletedAt) continue;
    if (!newItemIds[oldItem._id]) {
      oldItemsPurged.push(oldItem);
    }
  }

  return [...oldItemsPurged, ...newItemsCleanedAndFormatted];
}
