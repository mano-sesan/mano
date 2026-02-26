/* eslint-disable no-inner-declarations */
// Pour l'historique git, avant le code était ici : dashboard/src/components/DataLoader.jsx
import { useEffect } from "react";
import { atom, useAtom, useSetAtom } from "jotai";
import { toast } from "react-toastify";

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

import {
  clearCache,
  dashboardCurrentCacheKey,
  getCacheItemDefaultValue,
  setCacheItem,
  enableCacheWrites,
  broadcastLoadingOrg,
} from "./dataManagement";
import API, { tryFetch, tryFetchExpectOk } from "./api";
import { logout } from "./logout";
import useDataMigrator from "../components/DataMigrator";
import { decryptItem, getHashedOrgEncryptionKey } from "./encryption";
import { errorMessage } from "../utils";
import { recurrencesState } from "../atoms/recurrences";
import { capture } from "./sentry";
import { awaitSetAtomAndIDBCache } from "../store";

// Update to flush cache.
export const isLoadingState = atom(false);
export const fullScreenState = atom(true);
export const progressState = atom(-1);
export const totalState = atom(-1);

// Atom with localStorage effect
const initialLoadingTextState = "En attente de chargement";
export const loadingTextState = atom(initialLoadingTextState);
export const initialLoadIsDoneState = atom(false);

// IMPORTANT:
// - Non-medical entity caches (person, action, ...) are persisted DECRYPTED in IndexedDB via awaitSetAtomAndIDBCache.
// - Medical entity caches (consultation, treatment, medical-file) are persisted ENCRYPTED in IndexedDB.
//   Decryption only happens in memory when populating Jotai atoms.
// - The "after" cursor used for delta sync MUST be per-tab, otherwise one tab can move the global
//   cursor forward and make other tabs permanently miss updates (then mergeItems keeps stale entities).
const perTabLastRefreshKey = `mano-last-refresh-local-${dashboardCurrentCacheKey}`;

function getPerTabLastRefresh() {
  try {
    const v = window.sessionStorage?.getItem(perTabLastRefreshKey);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch (_error: unknown) {
    return null;
  }
}

function setPerTabLastRefresh(value: number) {
  try {
    window.sessionStorage?.setItem(perTabLastRefreshKey, String(Number(value) || 0));
  } catch (_error: unknown) {
    // ignore
  }
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
  const { migrateData } = useDataMigrator();

  const setPersons = awaitSetAtomAndIDBCache(personsState);
  const setGroups = awaitSetAtomAndIDBCache(groupsState);
  const setReports = awaitSetAtomAndIDBCache(reportsState);
  const setPassages = awaitSetAtomAndIDBCache(passagesState);
  const setRencontres = awaitSetAtomAndIDBCache(rencontresState);
  const setActions = awaitSetAtomAndIDBCache(actionsState);
  const setRecurrences = awaitSetAtomAndIDBCache(recurrencesState);
  const setTerritories = awaitSetAtomAndIDBCache(territoriesState);
  const setPlaces = awaitSetAtomAndIDBCache(placesState);
  const setRelsPersonPlace = awaitSetAtomAndIDBCache(relsPersonPlaceState);
  const setTerritoryObservations = awaitSetAtomAndIDBCache(territoryObservationsState);
  const setComments = awaitSetAtomAndIDBCache(commentsState);
  const setConsultations = useSetAtom(consultationsState);
  const setTreatments = useSetAtom(treatmentsState);
  const setMedicalFiles = useSetAtom(medicalFileState);

  useEffect(function refreshOnMountEffect() {
    if (options.refreshOnMount && !isLoading)
      loadOrRefreshData(false)
        .then(() => setIsLoading(false))
        .catch((error) => {
          capture(error);
          setIsLoading(false);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOrRefreshData(isStartingInitialLoad) {
    // premier check du chiffrement activé: si pas de clé de chiffrement, pas de donnée à télécharger
    if (!getHashedOrgEncryptionKey()) return false;
    setIsLoading(true);
    enableCacheWrites();
    setFullScreen(isStartingInitialLoad);
    setLoadingText(isStartingInitialLoad ? "Chargement des données" : "Mise à jour des données");

    // Use a per-tab cursor if available; otherwise bootstrap from the shared global cursor.
    // This keeps the cache persistent across sessions, but prevents multi-tab cursor skipping.
    const globalLastLoadValue = await getCacheItemDefaultValue(dashboardCurrentCacheKey, 0);
    const perTabLastLoadValue = getPerTabLastRefresh();
    // If the shared cache was wiped (IndexedDB cleared), global cursor will be reset to 0.
    // In that case, a remaining per-tab cursor from this tab would be stale and dangerous:
    // it would make us query `after=<old>`, download nothing, but still advance the global cursor,
    // leading to an empty cache considered "up-to-date".
    if ((globalLastLoadValue === 0 || globalLastLoadValue == null) && perTabLastLoadValue != null && perTabLastLoadValue > 0) {
      setPerTabLastRefresh(0);
    }
    const safePerTabLastLoadValue = getPerTabLastRefresh();
    let lastLoadValue = safePerTabLastLoadValue ?? globalLastLoadValue;

    // On vérifie s'il y a un autre identifiant d'organisation dans le cache pour le supprimer le cas échéant
    const otherOrganisationId = await getCacheItemDefaultValue("organisationId", null);
    if (otherOrganisationId && otherOrganisationId !== organisation._id) {
      setLoadingText("Nettoyage du cache de la précédente organisation");
      await clearCache("otherOrganisationId");
      lastLoadValue = 0;
      setPerTabLastRefresh(0);
    }

    // Écriture précoce de l'organisationId pour éviter qu'un chargement interrompu
    // laisse des données orphelines sans marqueur d'org
    await setCacheItem("organisationId", organisation._id);
    broadcastLoadingOrg(organisation._id);

    // Refresh organisation (and user), to get the latest organisation fields and the latest user roles
    const [userError, userResponse] = await tryFetch(() => {
      return API.getAbortable({ path: "/user/me" });
    });
    if (userError || !userResponse.ok) return resetLoaderOnError(userError || userResponse.error);
    // Si l'organisation est désactivée, on redirige vers la page d'organisation désactivé
    if (userResponse.user.organisation.disabledAt) {
      logout().finally(() => {
        window.localStorage.removeItem("previously-logged-in");
        return (window.location.href = "/organisation-desactivee");
      });
    }

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

    // Get date from server BEFORE any data operations to prevent miss window
    // Any data created during loading will be caught in the next refresh cycle
    const [serverDateError, serverDateResponse] = await tryFetchExpectOk(() => {
      return API.getAbortable({ path: "/now" });
    });
    if (serverDateError) return resetLoaderOnError(serverDateError);
    const serverDate = serverDateResponse.data;

    const [statsError, statsResponse] = await tryFetchExpectOk(() => {
      return API.getAbortable({
        path: "/organisation/stats",
        query: {
          organisation: organisationId,
          after: lastLoadValue,
          withDeleted: true,
          // Medical data is cached encrypted in IndexedDB, but we still reload all on initial load for safety.
          withAllMedicalData: isStartingInitialLoad,
        },
      });
    });

    if (statsError) return false;

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
      limit: String(organisationId === "8007248d-cd58-4a64-bf6d-1272b40dbf57" ? 2500 : 10000),
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
        await setPersons(mergeItems(cachePersons, newPersons));
      } else {
        await setPersons(cachePersons);
      }
    } else if (newPersons.length) {
      await setPersons((latestPersons) => mergeItems(latestPersons, newPersons));
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
        await setGroups(mergeItems(cacheGroups, newGroups));
      } else {
        await setGroups(cacheGroups);
      }
    } else if (newGroups.length) {
      await setGroups((latestGroups) => mergeItems(latestGroups, newGroups));
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
        await setReports(mergeItems(cacheReports, newReports, { filterNewItemsFunction: (r) => !!r.team && !!r.date }));
      } else {
        await setReports(cacheReports);
      }
    } else if (newReports.length) {
      await setReports((latestReports) => mergeItems(latestReports, newReports, { filterNewItemsFunction: (r) => !!r.team && !!r.date }));
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
        await setPassages(mergeItems(cachePassages, newPassages));
      } else {
        await setPassages(cachePassages);
      }
    } else if (newPassages.length) {
      await setPassages((latestPassages) => mergeItems(latestPassages, newPassages));
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
        await setRencontres(mergeItems(cacheRencontres, newRencontres));
      } else {
        await setRencontres(cacheRencontres);
      }
    } else if (newRencontres.length) {
      await setRencontres((latestRencontres) => mergeItems(latestRencontres, newRencontres));
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
        await setActions(mergeItems(cacheActions, newActions));
      } else {
        await setActions(cacheActions);
      }
    } else if (newActions.length) {
      await setActions((latestActions) => mergeItems(latestActions, newActions));
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
        await setRecurrences(mergeItems(cacheRecurrences, newRecurrences));
      } else {
        await setRecurrences(cacheRecurrences);
      }
    } else if (newRecurrences.length) {
      await setRecurrences((latestRecurrences) => mergeItems(latestRecurrences, newRecurrences));
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
        await setTerritories(mergeItems(cacheTerritories, newTerritories));
      } else {
        await setTerritories(cacheTerritories);
      }
    } else if (newTerritories.length) {
      await setTerritories((latestTerritories) => mergeItems(latestTerritories, newTerritories));
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
        await setPlaces(mergeItems(cachePlaces, newPlaces));
      } else {
        await setPlaces(cachePlaces);
      }
    } else if (newPlaces.length) {
      await setPlaces((latestPlaces) => mergeItems(latestPlaces, newPlaces));
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
        await setRelsPersonPlace(mergeItems(cacheRelsPersonPlace, newRelsPersonPlace));
      } else {
        await setRelsPersonPlace(cacheRelsPersonPlace);
      }
    } else if (newRelsPersonPlace.length) {
      await setRelsPersonPlace((latestRelsPersonPlace) => mergeItems(latestRelsPersonPlace, newRelsPersonPlace));
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
        await setTerritoryObservations(mergeItems(cacheTerritoryObservations, newTerritoryObservations));
      } else {
        await setTerritoryObservations(cacheTerritoryObservations);
      }
    } else if (newTerritoryObservations.length) {
      await setTerritoryObservations((latestTerritoryObservations) => mergeItems(latestTerritoryObservations, newTerritoryObservations));
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
        await setComments(mergeItems(cacheComments, newComments));
      } else {
        await setComments(cacheComments);
      }
    } else if (newComments.length) {
      await setComments((latestComments) => mergeItems(latestComments, newComments));
    }

    let newConsultations = [];
    let newConsultationsRaw = [];
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
        newConsultationsRaw.push(...structuredClone(res.data));
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
      const encryptedCache = await getCacheItemDefaultValue("consultation", []);
      const mergedEncrypted = newConsultationsRaw.length ? mergeItems(encryptedCache, newConsultationsRaw) : encryptedCache;
      await setCacheItem("consultation", mergedEncrypted);
      const allDecrypted = (await Promise.all(mergedEncrypted.map((p) => decryptItem(p, { type: "consultations" })))).filter((e) => e);
      setConsultations(allDecrypted.map(formatConsultation));
    } else if (newConsultations.length) {
      setConsultations((prev) => mergeItems(prev, newConsultations, { formatNewItemsFunction: formatConsultation }));
      const encryptedCache = await getCacheItemDefaultValue("consultation", []);
      await setCacheItem("consultation", mergeItems(encryptedCache, newConsultationsRaw));
    }

    if (["admin", "normal"].includes(latestUser.role)) {
      let newTreatments = [];
      let newTreatmentsRaw = [];
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
          newTreatmentsRaw.push(...structuredClone(res.data));
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
        const encryptedCache = await getCacheItemDefaultValue("treatment", []);
        const mergedEncrypted = newTreatmentsRaw.length ? mergeItems(encryptedCache, newTreatmentsRaw) : encryptedCache;
        await setCacheItem("treatment", mergedEncrypted);
        const allDecrypted = (await Promise.all(mergedEncrypted.map((p) => decryptItem(p, { type: "treatments" })))).filter((e) => e);
        setTreatments(allDecrypted);
      } else if (newTreatments.length) {
        setTreatments((prev) => mergeItems(prev, newTreatments));
        const encryptedCache = await getCacheItemDefaultValue("treatment", []);
        await setCacheItem("treatment", mergeItems(encryptedCache, newTreatmentsRaw));
      }
    }

    if (["admin", "normal"].includes(latestUser.role)) {
      let newMedicalFiles = [];
      let newMedicalFilesRaw = [];
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
          newMedicalFilesRaw.push(...structuredClone(res.data));
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
        const encryptedCache = await getCacheItemDefaultValue("medical-file", []);
        const mergedEncrypted = newMedicalFilesRaw.length ? mergeItems(encryptedCache, newMedicalFilesRaw) : encryptedCache;
        await setCacheItem("medical-file", mergedEncrypted);
        const allDecrypted = (await Promise.all(mergedEncrypted.map((p) => decryptItem(p, { type: "medicalFiles" })))).filter((e) => e);
        setMedicalFiles(allDecrypted);
      } else if (newMedicalFiles.length) {
        setMedicalFiles((prev) => mergeItems(prev, newMedicalFiles));
        const encryptedCache = await getCacheItemDefaultValue("medical-file", []);
        await setCacheItem("medical-file", mergeItems(encryptedCache, newMedicalFilesRaw));
      }
    }

    // deuxième check du chiffrement activé, dans le scénario où
    // 1. focus sur la page: on refresh
    // 2. session trop longue: on verrouille et la clé de chiffrement est supprimée MAIS le refresh est lancé avant
    // 3. problème: on a téléchargé des éléments mais non déchiffrés DONC
    // => pour éviter des problèmes de cache on n'enrteigtre pas le `await setCacheItem(dashboardCurrentCacheKey, serverDate);`
    if (!getHashedOrgEncryptionKey()) return false;
    await setCacheItem(dashboardCurrentCacheKey, serverDate);
    setPerTabLastRefresh(serverDate);
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

  async function resetLoaderOnError(error?: string | Error) {
    // an error was thrown, the data was not downloaded,
    // this can result in data corruption, we need to reset the loader
    await clearCache("resetLoaderOnError");
    setPerTabLastRefresh(0);
    // Pas de message d'erreur si la page est en train de se fermer
    // et que l'erreur est liée à une requête annulable.
    if (error instanceof Error && error.name === "BeforeUnloadAbortError") return false;
    const message = errorMessage(error || "Désolé, une erreur est survenue lors du chargement de vos données, veuillez réessayer");
    toast.error(message, {
      onClose: () => {
        if (message !== "Impossible de transmettre les données. Veuillez vérifier votre connexion internet.") {
          window.location.replace("/auth");
        }
      },
      autoClose: 5000,
    });
    return false;
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
    isLoading: Boolean(isLoading),
    isFullScreen: Boolean(fullScreen),
  };
}

export function mergeItems<T extends { _id?: string; deletedAt?: Date }>(
  oldItems: T[],
  newItems: T[] = [],
  { formatNewItemsFunction, filterNewItemsFunction }: { formatNewItemsFunction?: (item: T) => T; filterNewItemsFunction?: (item: T) => boolean } = {}
) {
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
