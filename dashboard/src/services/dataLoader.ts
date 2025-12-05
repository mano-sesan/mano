/* eslint-disable no-inner-declarations */
// Pour l'historique git, avant le code était ici : dashboard/src/components/DataLoader.jsx
import { useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { useStore, getState } from "../store";
import { formatConsultation } from "../recoil/consultations";
import { clearCache, dashboardCurrentCacheKey, getCacheItemDefaultValue, setCacheItem } from "../services/dataManagement";
import API, { tryFetch, tryFetchExpectOk } from "../services/api";
import useDataMigrator from "../components/DataMigrator";
import { decryptItem, getHashedOrgEncryptionKey } from "../services/encryption";
import { errorMessage } from "../utils";
import { capture } from "./sentry";

export function useDataLoader(options = { refreshOnMount: false }) {
  // Get state and setters from zustand store
  const fullScreen = useStore((state) => state.fullScreen);
  const isLoading = useStore((state) => state.isLoading);
  const user = useStore((state) => state.user);
  const teams = useStore((state) => state.teams);
  const organisation = useStore((state) => state.organisation);

  const setFullScreen = useStore((state) => state.setFullScreen);
  const setIsLoading = useStore((state) => state.setIsLoading);
  const setLoadingText = useStore((state) => state.setLoadingText);
  const setInitialLoadIsDone = useStore((state) => state.setInitialLoadIsDone);
  const setTotalLoadingDuration = useStore((state) => state.setTotalLoadingDuration);
  const setProgress = useStore((state) => state.setProgress);
  const setTotal = useStore((state) => state.setTotal);

  const setUser = useStore((state) => state.setUser);
  const setTeams = useStore((state) => state.setTeams);
  const setOrganisation = useStore((state) => state.setOrganisation);

  const setPersons = useStore((state) => state.setPersons);
  const setGroups = useStore((state) => state.setGroups);
  const setReports = useStore((state) => state.setReports);
  const setPassages = useStore((state) => state.setPassages);
  const setRencontres = useStore((state) => state.setRencontres);
  const setActions = useStore((state) => state.setActions);
  const setRecurrences = useStore((state) => state.setRecurrences);
  const setTerritories = useStore((state) => state.setTerritories);
  const setPlaces = useStore((state) => state.setPlaces);
  const setRelsPersonPlace = useStore((state) => state.setRelsPersonPlace);
  const setTerritoryObservations = useStore((state) => state.setTerritoryObservations);
  const setComments = useStore((state) => state.setComments);
  const setConsultations = useStore((state) => state.setConsultations);
  const setTreatments = useStore((state) => state.setTreatments);
  const setMedicalFiles = useStore((state) => state.setMedicalFiles);

  const { migrateData } = useDataMigrator();

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

  const loadOrRefreshData = useCallback(
    async (isStartingInitialLoad: boolean) => {
      // premier check du chiffrement activé: si pas de clé de chiffrement, pas de donnée à télécharger
      if (!getHashedOrgEncryptionKey()) return false;

      // Get fresh state values
      const currentOrganisation = getState().organisation;
      const currentTeams = getState().teams;
      const currentUser = getState().user;

      setIsLoading(true);
      setFullScreen(isStartingInitialLoad);
      setLoadingText(isStartingInitialLoad ? "Chargement des données" : "Mise à jour des données");

      let lastLoadValue = await getCacheItemDefaultValue(dashboardCurrentCacheKey, 0);
      const now = Date.now();

      // On vérifie s'il y a un autre identifiant d'organisation dans le cache pour le supprimer le cas échéant
      const otherOrganisationId = await getCacheItemDefaultValue("organisationId", null);
      if (otherOrganisationId && otherOrganisationId !== currentOrganisation?._id) {
        setLoadingText("Nettoyage du cache de la précédente organisation");
        await clearCache("otherOrganisationId");
        lastLoadValue = 0;
      }

      // Refresh organisation (and user), to get the latest organisation fields and the latest user roles
      const [userError, userResponse] = await tryFetch(() => {
        return API.getAbortable({ path: "/user/me" });
      });
      if (userError || !userResponse.ok) return resetLoaderOnError(userError || userResponse.error);
      // Si l'organisation est désactivée, on redirige vers la page d'organisation désactivé
      if (userResponse.user.organisation.disabledAt) {
        tryFetchExpectOk(() => API.post({ path: "/user/logout" })).finally(() => {
          window.localStorage.removeItem("previously-logged-in");
          return (window.location.href = "/organisation-desactivee");
        });
      }

      const latestOrganisation = userResponse.user.organisation;
      const latestUser = userResponse.user;
      const latestTeams = userResponse.user.orgTeams;
      const organisationId = latestOrganisation._id;
      if (currentOrganisation?.encryptionLastUpdateAt !== latestOrganisation.encryptionLastUpdateAt) {
        return toast.error("La clé de chiffrement a changé ou a été régénérée. Veuillez vous déconnecter et vous reconnecter avec la nouvelle clé.");
      }
      if (JSON.stringify(latestOrganisation) !== JSON.stringify(currentOrganisation)) {
        setOrganisation(latestOrganisation);
      }
      if (JSON.stringify(latestTeams) !== JSON.stringify(currentTeams)) {
        setTeams(latestTeams);
      }
      if (JSON.stringify(latestUser) !== JSON.stringify(currentUser)) {
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
            // Medical data is never saved in cache so we always have to download all at every page reload.
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

      let newPersons: any[] = [];
      if (stats.persons > 0) {
        setLoadingText("Chargement des personnes");
        async function loadPersons(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({ path: "/person", query: { ...query, page: String(page) } });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "persons" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
        setPersons((latestPersons) => mergeItems(latestPersons, newPersons));
      }

      let newGroups: any[] = [];
      if (stats.groups > 0) {
        setLoadingText("Chargement des familles");
        async function loadGroups(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({ path: "/group", query: { ...query, page: String(page) } });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "groups" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
        setGroups((latestGroups) => mergeItems(latestGroups, newGroups));
      }

      let newReports: any[] = [];
      if (stats.reports > 0) {
        setLoadingText("Chargement des comptes-rendus");
        async function loadReports(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({ path: "/report", query: { ...query, page: String(page) } });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "reports" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
          setReports(mergeItems(cacheReports, newReports, { filterNewItemsFunction: (r: any) => !!r.team && !!r.date }));
        } else {
          setReports(cacheReports);
        }
      } else if (newReports.length) {
        setReports((latestReports) => mergeItems(latestReports, newReports, { filterNewItemsFunction: (r: any) => !!r.team && !!r.date }));
      }

      let newPassages: any[] = [];
      if (stats.passages > 0) {
        setLoadingText("Chargement des passages");
        async function loadPassages(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({ path: "/passage", query: { ...query, page: String(page) } });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "passages" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
        setPassages((latestPassages) => mergeItems(latestPassages, newPassages));
      }

      let newRencontres: any[] = [];
      if (stats.rencontres > 0) {
        setLoadingText("Chargement des rencontres");
        async function loadRencontres(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({ path: "/rencontre", query: { ...query, page: String(page) } });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "rencontres" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
        setRencontres((latestRencontres) => mergeItems(latestRencontres, newRencontres));
      }

      let newActions: any[] = [];
      if (stats.actions > 0) {
        setLoadingText("Chargement des actions");
        async function loadActions(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({ path: "/action", query: { ...query, page: String(page) } });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "actions" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
        setActions((latestActions) => mergeItems(latestActions, newActions));
      }

      let newRecurrences: any[] = [];
      if (stats.recurrences > 0) {
        setLoadingText("Chargement des actions récurrentes");
        async function loadRecurrences(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({ path: "/recurrence", query: { ...query, page: String(page) } });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "recurrence" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
        setRecurrences((latestRecurrences) => mergeItems(latestRecurrences, newRecurrences));
      }

      let newTerritories: any[] = [];
      if (stats.territories > 0) {
        setLoadingText("Chargement des territoires");
        async function loadTerritories(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({ path: "/territory", query: { ...query, page: String(page) } });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "territories" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
        setTerritories((latestTerritories) => mergeItems(latestTerritories, newTerritories));
      }

      let newPlaces: any[] = [];
      if (stats.places > 0) {
        setLoadingText("Chargement des lieux");
        async function loadPlaces(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({ path: "/place", query: { ...query, page: String(page) } });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "places" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
        setPlaces((latestPlaces) => mergeItems(latestPlaces, newPlaces));
      }

      let newRelsPersonPlace: any[] = [];
      if (stats.relsPersonPlace > 0) {
        setLoadingText("Chargement des relations personne-lieu");
        async function loadRelsPersonPlace(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({ path: "/relPersonPlace", query: { ...query, page: String(page) } });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "relsPersonPlace" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
        setRelsPersonPlace((latestRelsPersonPlace) => mergeItems(latestRelsPersonPlace, newRelsPersonPlace));
      }

      let newTerritoryObservations: any[] = [];
      if (stats.territoryObservations > 0) {
        setLoadingText("Chargement des observations de territoire");
        async function loadObservations(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({ path: "/territory-observation", query: { ...query, page: String(page) } });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "territoryObservations" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
        setTerritoryObservations((latestTerritoryObservations) => mergeItems(latestTerritoryObservations, newTerritoryObservations));
      }

      let newComments: any[] = [];
      if (stats.comments > 0) {
        setLoadingText("Chargement des commentaires");
        async function loadComments(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({ path: "/comment", query: { ...query, page: String(page) } });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "comments" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
        setComments((latestComments) => mergeItems(latestComments, newComments));
      }

      let newConsultations: any[] = [];
      if (stats.consultations > 0) {
        setLoadingText("Chargement des consultations");
        async function loadConsultations(page = 0): Promise<boolean> {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({
              path: "/consultation",
              query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue },
            });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "consultations" })))).filter((e) => e);
          setProgress((p) => (p ?? 0) + res.data.length);
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
        setConsultations((latestConsultations) => mergeItems(latestConsultations, newConsultations, { formatNewItemsFunction: formatConsultation }));
      }

      if (["admin", "normal"].includes(latestUser.role)) {
        let newTreatments: any[] = [];
        if (stats.treatments > 0) {
          setLoadingText("Chargement des traitements");
          async function loadTreatments(page = 0): Promise<boolean> {
            const [error, res] = await tryFetchExpectOk(async () => {
              return API.getAbortable({
                path: "/treatment",
                query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue },
              });
            });
            if (error) return resetLoaderOnError();
            const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "treatments" })))).filter((e) => e);
            setProgress((p) => (p ?? 0) + res.data.length);
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
          setTreatments((latestTreatments) => mergeItems(latestTreatments, newTreatments));
        }
      }

      if (["admin", "normal"].includes(latestUser.role)) {
        let newMedicalFiles: any[] = [];
        if (stats.medicalFiles > 0) {
          setLoadingText("Chargement des fichiers médicaux");
          async function loadMedicalFiles(page = 0): Promise<boolean> {
            const [error, res] = await tryFetchExpectOk(async () => {
              return API.getAbortable({
                path: "/medical-file",
                query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue },
              });
            });
            if (error) return resetLoaderOnError();
            const decryptedData = (await Promise.all(res.data.map((p: any) => decryptItem(p, { type: "medicalFiles" })))).filter((e) => e);
            setProgress((p) => (p ?? 0) + res.data.length);
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
          setMedicalFiles((latestMedicalFiles) => mergeItems(latestMedicalFiles, newMedicalFiles));
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
      if (!lastLoadValue) setTotalLoadingDuration((d) => d + Date.now() - now);
      await setCacheItem(dashboardCurrentCacheKey, serverDate);
      setLoadingText("En attente de rafraichissement");
      // On ne reset pas les valeurs de progress et total si on est en initial load
      // Car on le fait après la redirection pour éviter un flash de chargement
      if (!isStartingInitialLoad) {
        setProgress(null);
        setTotal(null);
        setInitialLoadIsDone(true);
      }
      return true;
    },
    [
      migrateData,
      setActions,
      setComments,
      setConsultations,
      setFullScreen,
      setGroups,
      setInitialLoadIsDone,
      setIsLoading,
      setLoadingText,
      setMedicalFiles,
      setOrganisation,
      setPassages,
      setPersons,
      setPlaces,
      setProgress,
      setRecurrences,
      setRelsPersonPlace,
      setRencontres,
      setReports,
      setTeams,
      setTerritories,
      setTerritoryObservations,
      setTotal,
      setTotalLoadingDuration,
      setTreatments,
      setUser,
    ]
  );

  async function resetLoaderOnError(error?: any): Promise<boolean> {
    // an error was thrown, the data was not downloaded,
    // this can result in data corruption, we need to reset the loader
    await clearCache("resetLoaderOnError");
    // Pas de message d'erreur si la page est en train de se fermer
    // et que l'erreur est liée à une requête annulable.
    if (error?.name === "BeforeUnloadAbortError") return false;
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

  const cleanupLoader = useCallback(() => {
    setProgress(null);
    setTotal(null);
    setInitialLoadIsDone(true);
  }, [setInitialLoadIsDone, setProgress, setTotal]);

  const refresh = useCallback(() => {
    return loadOrRefreshData(false)
      .then(() => setIsLoading(false))
      .catch((error) => {
        setIsLoading(false);
        capture(error);
      });
  }, [loadOrRefreshData, setIsLoading]);

  const startInitialLoad = useCallback(() => {
    return loadOrRefreshData(true)
      .then(() => setIsLoading(false))
      .catch((error) => {
        setIsLoading(false);
        capture(error);
      });
  }, [loadOrRefreshData, setIsLoading]);

  return {
    refresh,
    startInitialLoad,
    cleanupLoader,
    isLoading: Boolean(isLoading),
    isFullScreen: Boolean(fullScreen),
  };
}

export function mergeItems<T extends { _id: string; deletedAt?: string | null }>(
  oldItems: T[],
  newItems: T[] = [],
  options: { formatNewItemsFunction?: (item: T) => T; filterNewItemsFunction?: (item: T) => boolean } = {}
): T[] {
  const { formatNewItemsFunction, filterNewItemsFunction } = options;
  const newItemsCleanedAndFormatted: T[] = [];
  const newItemIds: Record<string, boolean> = {};

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

  const oldItemsPurged: T[] = [];
  for (const oldItem of oldItems) {
    if (oldItem.deletedAt) continue;
    if (!newItemIds[oldItem._id]) {
      oldItemsPurged.push(oldItem);
    }
  }

  return [...oldItemsPurged, ...newItemsCleanedAndFormatted];
}
