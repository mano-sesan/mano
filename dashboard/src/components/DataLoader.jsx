/* eslint-disable no-inner-declarations */
import { useEffect } from "react";
import { atom, useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
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
import { RandomPicture, RandomPicturePreloader } from "./LoaderRandomPicture";
import ProgressBar from "./LoaderProgressBar";
import useDataMigrator from "./DataMigrator";
import { decryptItem } from "../services/encryption";
import { errorMessage } from "../utils";
import { capture } from "../services/sentry";
import { getDebugMixedOrgsBug } from "../utils/debug-mixed-orgs-bug";
import { recurrencesState } from "../recoil/recurrences";

// Update to flush cache.
const isLoadingState = atom({ key: "isLoadingState", default: false });
const fullScreenState = atom({ key: "fullScreenState", default: true });
const progressState = atom({ key: "progressState", default: null });
const totalState = atom({ key: "totalState", default: null });
export const totalLoadingDurationState = atom({
  key: "totalLoadingDurationState",
  default: 0,
  effects: [({ onSet }) => onSet((newValue) => window.localStorage.setItem("totalLoadingDuration", newValue))],
});
const initialLoadingTextState = "En attente de chargement";
export const loadingTextState = atom({ key: "loadingTextState", default: initialLoadingTextState });
export const initialLoadIsDoneState = atom({ key: "initialLoadIsDoneState", default: false });

export default function DataLoader() {
  const isLoading = useRecoilValue(isLoadingState);
  const fullScreen = useRecoilValue(fullScreenState);
  const loadingText = useRecoilValue(loadingTextState);
  const progress = useRecoilValue(progressState);
  const total = useRecoilValue(totalState);

  if (!isLoading) return <RandomPicturePreloader />;
  if (!total && !fullScreen) return null;

  if (fullScreen) {
    return (
      <div className="tw-absolute tw-inset-0 tw-z-[1000] tw-box-border tw-flex tw-w-full tw-items-center tw-justify-center tw-bg-white">
        <div className="tw-flex tw-h-[50vh] tw-max-h-[50vw] tw-w-[50vw] tw-max-w-[50vh] tw-flex-col tw-items-center tw-justify-center">
          <RandomPicture />
          <ProgressBar progress={progress} total={total} loadingText={loadingText} />
        </div>
      </div>
    );
  }

  return (
    <div className="tw-absolute tw-left-0 tw-top-0 tw-z-[1000] tw-box-border tw-w-full">
      <ProgressBar progress={progress} total={total} loadingText={loadingText} />
    </div>
  );
}

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

    setLoadingText("Récupération des données dans le cache");
    await Promise.resolve()
      .then(() => getCacheItemDefaultValue("person", []))
      .then((persons) => setPersons([...persons]))
      .then(() => getCacheItemDefaultValue("group", []))
      .then((groups) => setGroups([...groups]))
      .then(() => getCacheItemDefaultValue("report", []))
      .then((reports) => setReports([...reports]))
      .then(() => getCacheItemDefaultValue("passage", []))
      .then((passages) => setPassages([...passages]))
      .then(() => getCacheItemDefaultValue("rencontre", []))
      .then((rencontres) => setRencontres([...rencontres]))
      .then(() => getCacheItemDefaultValue("action", []))
      .then((actions) => setActions([...actions]))
      .then(() => getCacheItemDefaultValue("recurrence", []))
      .then((recurrences) => setRecurrences([...recurrences]))
      .then(() => getCacheItemDefaultValue("territory", []))
      .then((territories) => setTerritories([...territories]))
      .then(() => getCacheItemDefaultValue("place", []))
      .then((places) => setPlaces([...places]))
      .then(() => getCacheItemDefaultValue("relPersonPlace", []))
      .then((relsPersonPlace) => setRelsPersonPlace([...relsPersonPlace]))
      .then(() => getCacheItemDefaultValue("territory-observation", []))
      .then((territoryObservations) => setTerritoryObservations([...territoryObservations]))
      .then(() => getCacheItemDefaultValue("comment", []))
      .then((comments) => setComments([...comments]))
      .then(() => getCacheItemDefaultValue("consultation", []))
      .then((consultations) => setConsultations([...consultations]))
      .then(() => getCacheItemDefaultValue("treatment", []))
      .then((treatments) => setTreatments([...treatments]))
      .then(() => getCacheItemDefaultValue("medical-file", []))
      .then((medicalFiles) => setMedicalFiles([...medicalFiles]));

    if (stats.persons > 0) {
      let newItems = [];
      setLoadingText("Chargement des personnes");
      async function loadPersons(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/person", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "persons" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadPersons(page + 1);
        if (newItems.length) {
          const newPersons = mergeItems(persons, newItems);
          // Check if some people from previous organisations are still in the list
          const personsFromOtherOrgs = newPersons.filter((p) => p.organisation !== organisationId);
          if (personsFromOtherOrgs.length) {
            // get the logs to try to understand what happened
            const logs = getDebugMixedOrgsBug();
            capture("DataLoader: personsFromOtherOrgs amélioré", {
              extra: {
                logs,
                organisationId,
                totalPersonsFromOtherOrgs: personsFromOtherOrgs.length,
                personFromOtherOrg: {
                  _id: personsFromOtherOrgs[0]?._id,
                  organisation: personsFromOtherOrgs[0]?.organisation,
                  createdAt: personsFromOtherOrgs[0]?.createdAt,
                  updatedAt: personsFromOtherOrgs[0]?.updatedAt,
                  deletedAt: personsFromOtherOrgs[0]?.deletedAt,
                },
              },
            });
          }
          setPersons(newPersons);
        }
        return true;
      }
      const personSuccess = await loadPersons(0);
      if (!personSuccess) return false;
    }
    if (stats.groups > 0) {
      let newItems = [];
      setLoadingText("Chargement des familles");
      async function loadGroups(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/group", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "groups" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadGroups(page + 1);
        if (newItems.length) setGroups(mergeItems(groups, newItems));
        return true;
      }
      const groupsSuccess = await loadGroups(0);
      if (!groupsSuccess) return false;
    }
    if (stats.reports > 0) {
      let newItems = [];
      setLoadingText("Chargement des comptes-rendus");
      async function loadReports(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/report", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "reports" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadReports(page + 1);
        if (newItems.length) setReports(mergeItems(reports, newItems, { filterNewItemsFunction: (r) => !!r.team && !!r.date }));
        return true;
      }
      const reportsSuccess = await loadReports(0);
      if (!reportsSuccess) return false;
    }
    if (stats.passages > 0) {
      let newItems = [];
      setLoadingText("Chargement des passages");
      async function loadPassages(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/passage", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "passages" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadPassages(page + 1);
        if (newItems.length) setPassages(mergeItems(passages, newItems));
        return true;
      }
      const passagesSuccess = await loadPassages(0);
      if (!passagesSuccess) return false;
    }
    if (stats.rencontres > 0) {
      let newItems = [];
      setLoadingText("Chargement des rencontres");
      async function loadRencontres(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/rencontre", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "rencontres" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadRencontres(page + 1);
        if (newItems.length) setRencontres(mergeItems(rencontres, newItems));
        return true;
      }
      const rencontresSuccess = await loadRencontres(0);
      if (!rencontresSuccess) return false;
    }
    if (stats.actions > 0) {
      let newItems = [];
      setLoadingText("Chargement des actions");
      async function loadActions(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/action", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "actions" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadActions(page + 1);
        if (newItems.length) setActions(mergeItems(actions, newItems));
        return true;
      }
      const actionsSuccess = await loadActions(0);
      if (!actionsSuccess) return false;
    }
    if (stats.recurrences > 0) {
      let newItems = [];
      setLoadingText("Chargement des actions récurrentes");
      async function loadRecurrences(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/recurrence", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "recurrence" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadRecurrences(page + 1);
        if (newItems.length) setRecurrences(mergeItems(recurrences, newItems));
        return true;
      }
      const recurrencesSuccess = await loadRecurrences(0);
      if (!recurrencesSuccess) return false;
    }
    if (stats.territories > 0) {
      let newItems = [];
      setLoadingText("Chargement des territoires");
      async function loadTerritories(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/territory", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "territories" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadTerritories(page + 1);
        if (newItems.length) setTerritories(mergeItems(territories, newItems));
        return true;
      }
      const territoriesSuccess = await loadTerritories(0);
      if (!territoriesSuccess) return false;
    }
    if (stats.places > 0) {
      let newItems = [];
      setLoadingText("Chargement des lieux");
      async function loadPlaces(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/place", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "places" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadPlaces(page + 1);
        if (newItems.length) setPlaces(mergeItems(places, newItems));
        return true;
      }
      const placesSuccess = await loadPlaces(0);
      if (!placesSuccess) return false;
    }
    if (stats.relsPersonPlace > 0) {
      let newItems = [];
      setLoadingText("Chargement des relations personne-lieu");
      async function loadRelPersonPlaces(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/relPersonPlace", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "relsPersonPlace" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadRelPersonPlaces(page + 1);
        if (newItems.length) setRelsPersonPlace(mergeItems(relsPersonPlace, newItems));
        return true;
      }
      const relsPersonPlacesSuccess = await loadRelPersonPlaces(0);
      if (!relsPersonPlacesSuccess) return false;
    }
    if (stats.territoryObservations > 0) {
      let newItems = [];
      setLoadingText("Chargement des observations de territoire");
      async function loadObservations(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/territory-observation", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "territoryObservations" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadObservations(page + 1);
        if (newItems.length) setTerritoryObservations(mergeItems(territoryObservations, newItems));
        return true;
      }
      const territoryObservationsSuccess = await loadObservations(0);
      if (!territoryObservationsSuccess) return false;
    }
    if (stats.comments > 0) {
      let newItems = [];
      setLoadingText("Chargement des commentaires");
      async function loadComments(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/comment", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "comments" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadComments(page + 1);
        if (newItems.length) setComments(mergeItems(comments, newItems));
        return true;
      }
      const commentsSuccess = await loadComments(0);
      if (!commentsSuccess) return false;
    }
    if (stats.consultations > 0) {
      let newItems = [];
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
        newItems.push(...decryptedData);
        if (res.hasMore) return loadConsultations(page + 1);
        if (newItems.length) setConsultations(mergeItems(consultations, newItems, { formatNewItemsFunction: formatConsultation }));
        return true;
      }
      const consultationsSuccess = await loadConsultations(0);
      if (!consultationsSuccess) return false;
    }
    if (["admin", "normal"].includes(latestUser.role) && stats.treatments > 0) {
      let newItems = [];
      setLoadingText("Chargement des traitements");
      async function loadTreatments(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/treatment", query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "treatments" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newItems.push(...decryptedData);
        if (res.hasMore) return loadTreatments(page + 1);
        if (newItems.length) setTreatments(mergeItems(treatments, newItems));
        return true;
      }
      const treatmentsSuccess = await loadTreatments(0);
      if (!treatmentsSuccess) return false;
    }
    if (["admin", "normal"].includes(latestUser.role) && stats.medicalFiles > 0) {
      let newItems = [];
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
        newItems.push(...decryptedData);
        if (res.hasMore) return loadMedicalFiles(page + 1);
        if (newItems.length) setMedicalFiles(mergeItems(medicalFiles, newItems));
        return true;
      }
      const medicalFilesSuccess = await loadMedicalFiles(0);
      if (!medicalFilesSuccess) return false;
    }

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
