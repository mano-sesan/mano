/* eslint-disable no-inner-declarations */
// Pour l'historique git, avant le code était ici : dashboard/src/components/DataLoader.jsx
import { useEffect } from "react";
import { Alert } from "react-native";
import { atom, useAtom, useSetAtom } from "jotai";
import { useMMKVNumber } from "react-native-mmkv";

import { personsState } from "../atoms/persons";
import { groupsState } from "../atoms/groups";
import { treatmentsState } from "../atoms/treatments";
import { actionsState } from "../atoms/actions";
import { medicalFileState } from "../atoms/medicalFiles";
import { passagesState } from "../atoms/passages";
import { rencontresState } from "../atoms/rencontres";
import { reportsState } from "../atoms/reports";
import { territoriesState } from "../atoms/territory";
import { placesState } from "../atoms/places";
import { relsPersonPlaceState } from "../atoms/relPersonPlace";
import { territoryObservationsState } from "../atoms/territoryObservations";
import { consultationsState, formatConsultation } from "../atoms/consultations";
import { commentsState } from "../atoms/comments";
import { organisationState, teamsState, userState } from "../atoms/auth";
import { recurrencesState } from "../atoms/recurrences";

import { appCurrentCacheKey, clearCache } from "./dataManagement";
import { storage } from "./storage";
import API from "./api";
import { capture } from "./sentry";

// Update to flush cache.
export const isLoadingState = atom(false);
export const fullScreenState = atom(true);
export const progressState = atom(-1);
export const totalState = atom(-1);

const initialLoadingTextState = "En attente de chargement";
export const loadingTextState = atom(initialLoadingTextState);
export const initialLoadIsDoneState = atom(false);

function getMMKVCacheItem<T>(key: string, defaultValue: T): T {
  const stored = storage.getString(key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored);
  } catch {
    return defaultValue;
  }
}

function setMMKVCacheItem(key: string, value: any) {
  storage.set(key, JSON.stringify(value));
}

export function useDataLoader(options = { refreshOnMount: false }) {
  const [fullScreen, setFullScreen] = useAtom(fullScreenState);
  const [isLoading, setIsLoading] = useAtom(isLoadingState);
  const setLoadingText = useSetAtom(loadingTextState);
  const setInitialLoadIsDone = useSetAtom(initialLoadIsDoneState);
  const setProgress = useSetAtom(progressState);
  const setTotal = useSetAtom(totalState);

  const [user, setUser] = useAtom(userState);
  const [teams, setTeams] = useAtom(teamsState);
  const [organisation, setOrganisation] = useAtom(organisationState);

  const setPersons = useSetAtom(personsState);
  const setGroups = useSetAtom(groupsState);
  const setReports = useSetAtom(reportsState);
  const setPassages = useSetAtom(passagesState);
  const setRencontres = useSetAtom(rencontresState);
  const setActions = useSetAtom(actionsState);
  const setRecurrences = useSetAtom(recurrencesState);
  const setTerritories = useSetAtom(territoriesState);
  const setPlaces = useSetAtom(placesState);
  const setRelsPersonPlace = useSetAtom(relsPersonPlaceState);
  const setTerritoryObservations = useSetAtom(territoryObservationsState);
  const setComments = useSetAtom(commentsState);
  const setConsultations = useSetAtom(consultationsState);
  const setTreatments = useSetAtom(treatmentsState);
  const setMedicalFiles = useSetAtom(medicalFileState);

  const [lastRefresh, setLastRefresh] = useMMKVNumber(appCurrentCacheKey);

  useEffect(function refreshOnMountEffect() {
    if (options.refreshOnMount && !isLoading) {
      requestIdleCallback(() => {
        loadOrRefreshData(false)
          .then(() => setIsLoading(false))
          .catch((error) => {
            capture(error);
            setIsLoading(false);
          });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOrRefreshData(isStartingInitialLoad: boolean) {
    setIsLoading(true);
    setFullScreen(isStartingInitialLoad);
    setLoadingText(isStartingInitialLoad ? "Chargement des données" : "Mise à jour des données");

    const lastLoadValue = lastRefresh ?? 0;

    // Refresh organisation (and user), to get the latest organisation fields and the latest user roles
    const userResponse = await API.get({ path: "/user/me" });
    if (!userResponse.ok) return resetLoaderOnError();
    const latestOrganisation = userResponse.user.organisation;
    const latestUser = userResponse.user;
    const latestTeams = userResponse.user.orgTeams;
    const organisationId = latestOrganisation._id;
    if (organisation?.encryptionLastUpdateAt !== latestOrganisation.encryptionLastUpdateAt) {
      Alert.alert(
        "Clé de chiffrement modifiée",
        "La clé de chiffrement a changé ou a été régénérée. Veuillez vous déconnecter et vous reconnecter avec la nouvelle clé."
      );
      return false;
    }
    if (latestOrganisation.disabledAt) {
      API.logout();
      return false;
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

    // Get date from server BEFORE any data operations to prevent miss window
    // Any data created during loading will be caught in the next refresh cycle
    const serverDateResponse = await API.get({ path: "/now" });
    if (!serverDateResponse.ok) return resetLoaderOnError();
    const serverDate = serverDateResponse.data;

    const statsResponse = await API.get({
      path: "/organisation/stats",
      query: {
        organisation: organisationId,
        after: lastLoadValue,
        withDeleted: true,
        // Medical data is cached encrypted, but we still reload all on initial load for safety.
        withAllMedicalData: isStartingInitialLoad,
      },
    });

    if (!statsResponse.ok) return false;

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

    let newPersons: any[] = [];
    if (stats.persons > 0) {
      setLoadingText("Chargement des personnes");
      async function loadPersons(page = 0) {
        const res = await API.get({ path: "/person", query: { ...query, page: String(page) } });
        if (!res.ok) return resetLoaderOnError();
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newPersons.push(...decryptedData);
        if (res.hasMore) return loadPersons(page + 1);
        return true;
      }
      const personSuccess = await loadPersons(0);
      if (!personSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cachePersons = getMMKVCacheItem("person", []);
      const merged = newPersons.length ? mergeItems(cachePersons, newPersons) : cachePersons;
      setPersons(merged);
      setMMKVCacheItem("person", merged);
    } else if (newPersons.length) {
      setPersons((latestPersons) => {
        const merged = mergeItems(latestPersons, newPersons);
        setMMKVCacheItem("person", merged);
        return merged;
      });
    }

    let newGroups: any[] = [];
    if (stats.groups > 0) {
      setLoadingText("Chargement des familles");
      async function loadGroups(page = 0) {
        const res = await API.get({ path: "/group", query: { ...query, page: String(page) } });
        if (!res.ok) return resetLoaderOnError();
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newGroups.push(...decryptedData);
        if (res.hasMore) return loadGroups(page + 1);
        return true;
      }
      const groupsSuccess = await loadGroups(0);
      if (!groupsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheGroups = getMMKVCacheItem("group", []);
      const merged = newGroups.length ? mergeItems(cacheGroups, newGroups) : cacheGroups;
      setGroups(merged);
      setMMKVCacheItem("group", merged);
    } else if (newGroups.length) {
      setGroups((latestGroups) => {
        const merged = mergeItems(latestGroups, newGroups);
        setMMKVCacheItem("group", merged);
        return merged;
      });
    }

    let newReports: any[] = [];
    if (stats.reports > 0) {
      setLoadingText("Chargement des comptes-rendus");
      async function loadReports(page = 0) {
        const res = await API.get({ path: "/report", query: { ...query, page: String(page) } });
        if (!res.ok) return resetLoaderOnError();
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newReports.push(...decryptedData);
        if (res.hasMore) return loadReports(page + 1);
        return true;
      }
      const reportsSuccess = await loadReports(0);
      if (!reportsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheReports = getMMKVCacheItem("report", []);
      const merged = newReports.length
        ? mergeItems(cacheReports, newReports, { filterNewItemsFunction: (r: any) => !!r.team && !!r.date })
        : cacheReports;
      setReports(merged);
      setMMKVCacheItem("report", merged);
    } else if (newReports.length) {
      setReports((latestReports) => {
        const merged = mergeItems(latestReports, newReports, { filterNewItemsFunction: (r: any) => !!r.team && !!r.date });
        setMMKVCacheItem("report", merged);
        return merged;
      });
    }

    let newPassages: any[] = [];
    if (stats.passages > 0) {
      setLoadingText("Chargement des passages");
      async function loadPassages(page = 0) {
        const res = await API.get({ path: "/passage", query: { ...query, page: String(page) } });
        if (!res.ok) return resetLoaderOnError();
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newPassages.push(...decryptedData);
        if (res.hasMore) return loadPassages(page + 1);
        return true;
      }
      const passagesSuccess = await loadPassages(0);
      if (!passagesSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cachePassages = getMMKVCacheItem("passage", []);
      const merged = newPassages.length ? mergeItems(cachePassages, newPassages) : cachePassages;
      setPassages(merged);
      setMMKVCacheItem("passage", merged);
    } else if (newPassages.length) {
      setPassages((latestPassages) => {
        const merged = mergeItems(latestPassages, newPassages);
        setMMKVCacheItem("passage", merged);
        return merged;
      });
    }

    let newRencontres: any[] = [];
    if (stats.rencontres > 0) {
      setLoadingText("Chargement des rencontres");
      async function loadRencontres(page = 0) {
        const res = await API.get({ path: "/rencontre", query: { ...query, page: String(page) } });
        if (!res.ok) return resetLoaderOnError();
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newRencontres.push(...decryptedData);
        if (res.hasMore) return loadRencontres(page + 1);
        return true;
      }
      const rencontresSuccess = await loadRencontres(0);
      if (!rencontresSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheRencontres = getMMKVCacheItem("rencontre", []);
      const merged = newRencontres.length ? mergeItems(cacheRencontres, newRencontres) : cacheRencontres;
      setRencontres(merged);
      setMMKVCacheItem("rencontre", merged);
    } else if (newRencontres.length) {
      setRencontres((latestRencontres) => {
        const merged = mergeItems(latestRencontres, newRencontres);
        setMMKVCacheItem("rencontre", merged);
        return merged;
      });
    }

    let newActions: any[] = [];
    if (stats.actions > 0) {
      setLoadingText("Chargement des actions");
      async function loadActions(page = 0) {
        const res = await API.get({ path: "/action", query: { ...query, page: String(page) } });
        if (!res.ok) return resetLoaderOnError();
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newActions.push(...decryptedData);
        if (res.hasMore) return loadActions(page + 1);
        return true;
      }
      const actionsSuccess = await loadActions(0);
      if (!actionsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheActions = getMMKVCacheItem("action", []);
      const merged = newActions.length ? mergeItems(cacheActions, newActions) : cacheActions;
      setActions(merged);
      setMMKVCacheItem("action", merged);
    } else if (newActions.length) {
      setActions((latestActions) => {
        const merged = mergeItems(latestActions, newActions);
        setMMKVCacheItem("action", merged);
        return merged;
      });
    }

    let newRecurrences: any[] = [];
    if (stats.recurrences > 0) {
      setLoadingText("Chargement des actions récurrentes");
      async function loadRecurrences(page = 0) {
        const res = await API.get({ path: "/recurrence", query: { ...query, page: String(page) } });
        if (!res.ok) return resetLoaderOnError();
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newRecurrences.push(...decryptedData);
        if (res.hasMore) return loadRecurrences(page + 1);
        return true;
      }
      const recurrencesSuccess = await loadRecurrences(0);
      if (!recurrencesSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheRecurrences = getMMKVCacheItem("recurrence", []);
      const merged = newRecurrences.length ? mergeItems(cacheRecurrences, newRecurrences) : cacheRecurrences;
      setRecurrences(merged);
      setMMKVCacheItem("recurrence", merged);
    } else if (newRecurrences.length) {
      setRecurrences((latestRecurrences) => {
        const merged = mergeItems(latestRecurrences, newRecurrences);
        setMMKVCacheItem("recurrence", merged);
        return merged;
      });
    }

    let newTerritories: any[] = [];
    if (stats.territories > 0) {
      setLoadingText("Chargement des territoires");
      async function loadTerritories(page = 0) {
        const res = await API.get({ path: "/territory", query: { ...query, page: String(page) } });
        if (!res.ok) return resetLoaderOnError();
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newTerritories.push(...decryptedData);
        if (res.hasMore) return loadTerritories(page + 1);
        return true;
      }
      const territoriesSuccess = await loadTerritories(0);
      if (!territoriesSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheTerritories = getMMKVCacheItem("territory", []);
      const merged = newTerritories.length ? mergeItems(cacheTerritories, newTerritories) : cacheTerritories;
      setTerritories(merged);
      setMMKVCacheItem("territory", merged);
    } else if (newTerritories.length) {
      setTerritories((latestTerritories) => {
        const merged = mergeItems(latestTerritories, newTerritories);
        setMMKVCacheItem("territory", merged);
        return merged;
      });
    }

    let newPlaces: any[] = [];
    if (stats.places > 0) {
      setLoadingText("Chargement des lieux");
      async function loadPlaces(page = 0) {
        const res = await API.get({ path: "/place", query: { ...query, page: String(page) } });
        if (!res.ok) return resetLoaderOnError();
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newPlaces.push(...decryptedData);
        if (res.hasMore) return loadPlaces(page + 1);
        return true;
      }
      const placesSuccess = await loadPlaces(0);
      if (!placesSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cachePlaces = getMMKVCacheItem("place", []);
      const merged = newPlaces.length ? mergeItems(cachePlaces, newPlaces) : cachePlaces;
      setPlaces(merged);
      setMMKVCacheItem("place", merged);
    } else if (newPlaces.length) {
      setPlaces((latestPlaces) => {
        const merged = mergeItems(latestPlaces, newPlaces);
        setMMKVCacheItem("place", merged);
        return merged;
      });
    }

    let newRelsPersonPlace: any[] = [];
    if (stats.relsPersonPlace > 0) {
      setLoadingText("Chargement des relations personne-lieu");
      async function loadRelsPersonPlace(page = 0) {
        const res = await API.get({ path: "/relPersonPlace", query: { ...query, page: String(page) } });
        if (!res.ok) return resetLoaderOnError();
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newRelsPersonPlace.push(...decryptedData);
        if (res.hasMore) return loadRelsPersonPlace(page + 1);
        return true;
      }
      const relsPersonPlaceSuccess = await loadRelsPersonPlace(0);
      if (!relsPersonPlaceSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheRelsPersonPlace = getMMKVCacheItem("relPersonPlace", []);
      const merged = newRelsPersonPlace.length ? mergeItems(cacheRelsPersonPlace, newRelsPersonPlace) : cacheRelsPersonPlace;
      setRelsPersonPlace(merged);
      setMMKVCacheItem("relPersonPlace", merged);
    } else if (newRelsPersonPlace.length) {
      setRelsPersonPlace((latestRelsPersonPlace) => {
        const merged = mergeItems(latestRelsPersonPlace, newRelsPersonPlace);
        setMMKVCacheItem("relPersonPlace", merged);
        return merged;
      });
    }

    let newTerritoryObservations: any[] = [];
    if (stats.territoryObservations > 0) {
      setLoadingText("Chargement des observations de territoire");
      async function loadObservations(page = 0) {
        const res = await API.get({ path: "/territory-observation", query: { ...query, page: String(page) } });
        if (!res.ok) return resetLoaderOnError();
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newTerritoryObservations.push(...decryptedData);
        if (res.hasMore) return loadObservations(page + 1);
        return true;
      }
      const territoryObservationsSuccess = await loadObservations(0);
      if (!territoryObservationsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheTerritoryObservations = getMMKVCacheItem("territory-observation", []);
      const merged = newTerritoryObservations.length ? mergeItems(cacheTerritoryObservations, newTerritoryObservations) : cacheTerritoryObservations;
      setTerritoryObservations(merged);
      setMMKVCacheItem("territory-observation", merged);
    } else if (newTerritoryObservations.length) {
      setTerritoryObservations((latestTerritoryObservations) => {
        const merged = mergeItems(latestTerritoryObservations, newTerritoryObservations);
        setMMKVCacheItem("territory-observation", merged);
        return merged;
      });
    }

    let newComments: any[] = [];
    if (stats.comments > 0) {
      setLoadingText("Chargement des commentaires");
      async function loadComments(page = 0) {
        const res = await API.get({ path: "/comment", query: { ...query, page: String(page) } });
        if (!res.ok) return resetLoaderOnError();
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newComments.push(...decryptedData);
        if (res.hasMore) return loadComments(page + 1);
        return true;
      }
      const commentsSuccess = await loadComments(0);
      if (!commentsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheComments = getMMKVCacheItem("comment", []);
      const merged = newComments.length ? mergeItems(cacheComments, newComments) : cacheComments;
      setComments(merged);
      setMMKVCacheItem("comment", merged);
    } else if (newComments.length) {
      setComments((latestComments) => {
        const merged = mergeItems(latestComments, newComments);
        setMMKVCacheItem("comment", merged);
        return merged;
      });
    }

    // Medical data: cached encrypted in MMKV, decrypted only in memory
    let newConsultations: any[] = [];
    let newConsultationsRaw: any[] = [];
    if (stats.consultations > 0) {
      setLoadingText("Chargement des consultations");
      async function loadConsultations(page = 0) {
        const res = await API.get({
          path: "/consultation",
          query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue },
        });
        if (!res.ok) return resetLoaderOnError();
        newConsultationsRaw.push(...res.data);
        const decryptedData = res.decryptedData.filter((e: any) => e);
        setProgress((p) => p + res.data.length);
        newConsultations.push(...decryptedData);
        if (res.hasMore) return loadConsultations(page + 1);
        return true;
      }
      const consultationsSuccess = await loadConsultations(0);
      if (!consultationsSuccess) return false;
    }
    if (isStartingInitialLoad) {
      const encryptedCache = getMMKVCacheItem("consultation", []);
      const mergedEncrypted = newConsultationsRaw.length ? mergeItems(encryptedCache, newConsultationsRaw) : encryptedCache;
      setMMKVCacheItem("consultation", mergedEncrypted);
      const allDecrypted: any[] = [];
      for (const item of mergedEncrypted) {
        const d = await API.decryptDBItem(item);
        if (d) allDecrypted.push(d);
      }
      setConsultations(allDecrypted.map(formatConsultation));
    } else if (newConsultations.length) {
      setConsultations((prev) => mergeItems(prev, newConsultations, { formatNewItemsFunction: formatConsultation }));
      const encryptedCache = getMMKVCacheItem("consultation", []);
      setMMKVCacheItem("consultation", mergeItems(encryptedCache, newConsultationsRaw));
    }

    if (["admin", "normal"].includes(latestUser.role)) {
      let newTreatments: any[] = [];
      let newTreatmentsRaw: any[] = [];
      if (stats.treatments > 0) {
        setLoadingText("Chargement des traitements");
        async function loadTreatments(page = 0) {
          const res = await API.get({
            path: "/treatment",
            query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue },
          });
          if (!res.ok) return resetLoaderOnError();
          newTreatmentsRaw.push(...res.data);
          const decryptedData = res.decryptedData.filter((e: any) => e);
          setProgress((p) => p + res.data.length);
          newTreatments.push(...decryptedData);
          if (res.hasMore) return loadTreatments(page + 1);
          return true;
        }
        const treatmentsSuccess = await loadTreatments(0);
        if (!treatmentsSuccess) return false;
      }

      if (isStartingInitialLoad) {
        const encryptedCache = getMMKVCacheItem("treatment", []);
        const mergedEncrypted = newTreatmentsRaw.length ? mergeItems(encryptedCache, newTreatmentsRaw) : encryptedCache;
        setMMKVCacheItem("treatment", mergedEncrypted);
        const allDecrypted: any[] = [];
        for (const item of mergedEncrypted) {
          const d = await API.decryptDBItem(item);
          if (d) allDecrypted.push(d);
        }
        setTreatments(allDecrypted);
      } else if (newTreatments.length) {
        setTreatments((prev) => mergeItems(prev, newTreatments));
        const encryptedCache = getMMKVCacheItem("treatment", []);
        setMMKVCacheItem("treatment", mergeItems(encryptedCache, newTreatmentsRaw));
      }
    }

    if (["admin", "normal"].includes(latestUser.role)) {
      let newMedicalFiles: any[] = [];
      let newMedicalFilesRaw: any[] = [];
      if (stats.medicalFiles > 0) {
        setLoadingText("Chargement des dossiers médicaux");
        async function loadMedicalFiles(page = 0) {
          const res = await API.get({
            path: "/medical-file",
            query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue },
          });
          if (!res.ok) return resetLoaderOnError();
          newMedicalFilesRaw.push(...res.data);
          const decryptedData = res.decryptedData.filter((e: any) => e);
          setProgress((p) => p + res.data.length);
          newMedicalFiles.push(...decryptedData);
          if (res.hasMore) return loadMedicalFiles(page + 1);
          return true;
        }
        const medicalFilesSuccess = await loadMedicalFiles(0);
        if (!medicalFilesSuccess) return false;
      }

      if (isStartingInitialLoad) {
        const encryptedCache = getMMKVCacheItem("medical-file", []);
        const mergedEncrypted = newMedicalFilesRaw.length ? mergeItems(encryptedCache, newMedicalFilesRaw) : encryptedCache;
        setMMKVCacheItem("medical-file", mergedEncrypted);
        const allDecrypted: any[] = [];
        for (const item of mergedEncrypted) {
          const d = await API.decryptDBItem(item);
          if (d) allDecrypted.push(d);
        }
        setMedicalFiles(allDecrypted);
      } else if (newMedicalFiles.length) {
        setMedicalFiles((prev) => mergeItems(prev, newMedicalFiles));
        const encryptedCache = getMMKVCacheItem("medical-file", []);
        setMMKVCacheItem("medical-file", mergeItems(encryptedCache, newMedicalFilesRaw));
      }
    }

    setLastRefresh(serverDate);
    setLoadingText("En attente de rafraichissement");
    // On ne reset pas les valeurs de progress et total si on est en initial load
    // Car on le fait après la redirection pour éviter un flash de chargement
    if (!isStartingInitialLoad) {
      setProgress(-1);
      setTotal(-1);
      setInitialLoadIsDone(true);
    }
    return true;
  }

  async function resetLoaderOnError(error?: any) {
    await clearCache("resetLoaderOnError");
    setLastRefresh(undefined);
    const message =
      typeof error === "string" ? error : error?.message || "Désolé, une erreur est survenue lors du chargement de vos données, veuillez réessayer";
    Alert.alert("Erreur", message);
    return false;
  }

  function resetMMKVAndAtoms() {
    clearCache("resetMMKVAndAtoms");
    setPersons([]);
    setActions([]);
    setPlaces([]);
    setComments([]);
    setPassages([]);
    setRencontres([]);
    setTerritories([]);
    setTerritoryObservations([]);
    setReports([]);
    setGroups([]);
    setRelsPersonPlace([]);
  }

  const cleanupLoader = () => {
    setProgress(-1);
    setTotal(-1);
    setInitialLoadIsDone(true);
  };

  return {
    refresh: () =>
      loadOrRefreshData(false)
        .then(() => setIsLoading(false))
        .catch((error) => {
          setIsLoading(false);
          capture(error);
        }),
    startInitialLoad: () =>
      loadOrRefreshData(true)
        .then(() => setIsLoading(false))
        .catch((error) => {
          setIsLoading(false);
          capture(error);
        }),
    cleanupLoader,
    resetMMKVAndAtoms,
    isLoading: Boolean(isLoading),
    isFullScreen: Boolean(fullScreen),
  };
}

export function mergeItems<T extends { _id?: string; deletedAt?: any }>(
  oldItems: T[],
  newItems: T[] = [],
  { formatNewItemsFunction, filterNewItemsFunction }: { formatNewItemsFunction?: (item: T) => T; filterNewItemsFunction?: (item: T) => boolean } = {}
) {
  const newItemsCleanedAndFormatted: T[] = [];
  const newItemIds: Record<string, boolean> = {};

  for (const newItem of newItems) {
    newItemIds[newItem._id!] = true;
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

  const oldItemsPurged: T[] = [];
  for (const oldItem of oldItems) {
    if (oldItem.deletedAt) continue;
    if (!newItemIds[oldItem._id!]) {
      oldItemsPurged.push(oldItem);
    }
  }

  return [...oldItemsPurged, ...newItemsCleanedAndFormatted];
}
