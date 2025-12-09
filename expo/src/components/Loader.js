import { useEffect, useRef } from "react";
import API from "../services/api";
import { atom, useAtom, useSetAtom } from "jotai";
import { appCurrentCacheKey, getData } from "../services/dataManagement";
import { useMMKVNumber } from "react-native-mmkv";
import { organisationState, userState } from "../recoil/auth";
import { actionsState } from "../recoil/actions";
import { personsState } from "../recoil/persons";
import { territoriesState } from "../recoil/territory";
import { placesState } from "../recoil/places";
import { relsPersonPlaceState } from "../recoil/relPersonPlace";
import { territoryObservationsState } from "../recoil/territoryObservations";
import { commentsState } from "../recoil/comments";
import { capture } from "../services/sentry";
import { reportsState } from "../recoil/reports";
import { consultationsState, formatConsultation } from "../recoil/consultations";
import { medicalFileState } from "../recoil/medicalFiles";
import { treatmentsState } from "../recoil/treatments";
import { rencontresState } from "../recoil/rencontres";
import { passagesState } from "../recoil/passages";
import { groupsState } from "../recoil/groups";

export const loadingState = atom("");

export const progressState = atom(0);

export const loaderFullScreenState = atom(false);

export const refreshTriggerState = atom({
  status: false,
  options: { showFullScreen: false, initialLoad: false },
});

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

export const DataLoader = () => {
  const [lastRefresh, setLastRefresh] = useMMKVNumber(appCurrentCacheKey);

  const setLoading = useSetAtom(loadingState);
  const setProgress = useSetAtom(progressState);
  const setFullScreen = useSetAtom(loaderFullScreenState);
  const [organisation, setOrganisation] = useAtom(organisationState);
  const [user, setUser] = useAtom(userState);
  const organisationId = organisation?._id;

  const [persons, setPersons] = useAtom(personsState);
  const [actions, setActions] = useAtom(actionsState);
  const [groups, setGroups] = useAtom(groupsState);
  const [consultations, setConsultations] = useAtom(consultationsState);
  const [treatments, setTreatments] = useAtom(treatmentsState);
  const [medicalFiles, setMedicalFiles] = useAtom(medicalFileState);
  const [territories, setTerritories] = useAtom(territoriesState);
  const [places, setPlaces] = useAtom(placesState);
  const [relsPersonPlace, setRelsPersonPlace] = useAtom(relsPersonPlaceState);
  const [territoryObservations, setTerritoryObs] = useAtom(territoryObservationsState);
  const [comments, setComments] = useAtom(commentsState);
  const [passages, setPassages] = useAtom(passagesState);
  const [rencontres, setRencontres] = useAtom(rencontresState);
  const [reports, setReports] = useAtom(reportsState);
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);

  // to prevent auto-refresh to trigger on the first render
  const initialLoadDone = useRef(null);

  const refresh = async () => {
    const { showFullScreen, initialLoad } = refreshTrigger.options;

    setLoading("Chargement...");
    setFullScreen(showFullScreen);

    /*
    Refresh organisation (and user), to get the latest organisation fields
    and the latest user roles
    */
    const userResponse = await API.get({ path: "/user/me" });
    if (userResponse.ok) {
      if (JSON.stringify(userResponse.user.organisation) !== JSON.stringify(organisation)) {
        setOrganisation(userResponse.user.organisation);
      }
      if (JSON.stringify(userResponse.user) !== JSON.stringify(user)) {
        setUser(userResponse.user);
      }
      if (userResponse.user.organisation.disabledAt) {
        setLoading("");
        setProgress(0);
        setFullScreen(false);
        setRefreshTrigger({
          status: false,
          options: { showFullScreen: false, initialLoad: false },
        });
        API.logout();
        return;
      }
    }

    const serverDateResponse = await API.get({ path: "/now" });
    const serverDate = serverDateResponse.data;
    /*
    Get number of data to download to show the appropriate loading progress bar
    */
    const response = await API.get({
      path: "/organisation/stats",
      query: {
        organisation: organisationId,
        after: lastRefresh,
        withDeleted: true,
        // Medical data is never saved in cache so we always have to download all at every page reload.
        withAllMedicalData: initialLoad,
      },
    });
    if (!response.ok) {
      capture("error getting stats", { extra: response });
      setRefreshTrigger({
        status: false,
        options: { showFullScreen: false, initialLoad: false },
      });
      return;
    }

    let total =
      response.data.actions +
      response.data.persons +
      response.data.territories +
      response.data.territoryObservations +
      response.data.places +
      response.data.comments +
      response.data.consultations +
      response.data.treatments +
      response.data.medicalFiles +
      response.data.passages +
      response.data.rencontres +
      response.data.reports +
      response.data.groups +
      response.data.relsPersonPlace;

    if (initialLoad) {
      total = total + Object.keys(response.data).length; // for the progress bar to be beautiful
    }
    /*
    Get persons
    */
    if (response.data.persons) {
      setLoading("Chargement des personnes");
      const refreshedPersons = await getData({
        collectionName: "person",
        data: persons,
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedPersons) {
        const newPersons = refreshedPersons.map((p) => ({ ...p, followedSince: p.followedSince || p.createdAt }));
        setPersons((oldPersons) => mergeItems(oldPersons, newPersons));
      }
    }
    /*
    Get groups
    */
    if (response.data.groups) {
      setLoading("Chargement des familles");
      const refreshedGroups = await getData({
        collectionName: "group",
        data: groups,
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedGroups) {
        setGroups((oldGroups) => mergeItems(oldGroups, refreshedGroups));
      }
    }
    /*
    Get consultations
    */
    if (response.data.consultations || initialLoad) {
      setLoading("Chargement des consultations");
      const refreshedConsultations = await getData({
        collectionName: "consultation",
        data: consultations,
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh: initialLoad ? 0 : lastRefresh, // because we never save medical data in cache
      });
      if (refreshedConsultations) {
        setConsultations((oldConsultations) => mergeItems(oldConsultations, refreshedConsultations, { formatNewItemsFunction: formatConsultation }));
      }
    }
    /*
    Get treatments
    */
    if (["admin", "normal"].includes(user.role)) {
      if (response.data.treatments || initialLoad) {
        setLoading("Chargement des traitements");
        const refreshedTreatments = await getData({
          collectionName: "treatment",
          data: treatments,
          setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
          lastRefresh: initialLoad ? 0 : lastRefresh, // because we never save medical data in cache
        });
        if (refreshedTreatments) {
          setTreatments((oldTreatments) => mergeItems(oldTreatments, refreshedTreatments));
        }
      }
      /*
      Get medicalFiles
      */
      if (response.data.medicalFiles || initialLoad) {
        setLoading("Chargement des dossiers médicaux");
        const refreshedMedicalFiles = await getData({
          collectionName: "medical-file",
          data: medicalFiles,
          setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
          lastRefresh: initialLoad ? 0 : lastRefresh, // because we never save medical data in cache
        });
        if (refreshedMedicalFiles) {
          setMedicalFiles((oldMedicalFiles) => mergeItems(oldMedicalFiles, refreshedMedicalFiles));
        }
      }
    }
    /*
    Get actions
    */
    if (response.data.actions) {
      setLoading("Chargement des actions");
      const refreshedActions = await getData({
        collectionName: "action",
        data: actions,
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedActions) {
        setActions((oldActions) => mergeItems(oldActions, refreshedActions));
      }
    }

    /*
    Get territories
    */
    if (response.data.territories) {
      setLoading("Chargement des territoires");
      const refreshedTerritories = await getData({
        collectionName: "territory",
        data: territories,
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedTerritories) {
        setTerritories((oldTerritories) => mergeItems(oldTerritories, refreshedTerritories));
      }
    }
    /*
    Get places
    */
    if (response.data.places) {
      setLoading("Chargement des lieux");
      const refreshedPlaces = await getData({
        collectionName: "place",
        data: places,
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedPlaces) {
        setPlaces((oldPlaces) => mergeItems(oldPlaces, refreshedPlaces).sort((p1, p2) => p1.name.localeCompare(p2.name)));
      }
    }
    if (response.data.relsPersonPlace) {
      const refreshedRelPersonPlaces = await getData({
        collectionName: "relPersonPlace",
        data: relsPersonPlace,
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedRelPersonPlaces) {
        setRelsPersonPlace((oldRelsPersonPlace) => mergeItems(oldRelsPersonPlace, refreshedRelPersonPlaces));
      }
    }
    /*
    Get observations territories
    */
    if (response.data.territoryObservations) {
      setLoading("Chargement des observations");
      const refreshedObs = await getData({
        collectionName: "territory-observation",
        data: territoryObservations,
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedObs) {
        setTerritoryObs((oldObs) => mergeItems(oldObs, refreshedObs));
      }
    }
    /*
    Get comments
    */
    if (response.data.comments) {
      setLoading("Chargement des commentaires");
      const refreshedComments = await getData({
        collectionName: "comment",
        data: comments,
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedComments) {
        setComments((oldComments) => mergeItems(oldComments, refreshedComments));
      }
    }

    /*
    Get passages
    */
    if (response.data.passages) {
      setLoading("Chargement des passages");
      const refreshedPassages = await getData({
        collectionName: "passage",
        data: passages,
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedPassages) {
        setPassages((oldPassages) => mergeItems(oldPassages, refreshedPassages));
      }
    }
    /*
    Get rencontres
    */
    if (response.data.rencontres) {
      setLoading("Chargement des rencontres");
      const refreshedRencontres = await getData({
        collectionName: "rencontre",
        data: rencontres,
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedRencontres) {
        setRencontres((oldRencontres) => mergeItems(oldRencontres, refreshedRencontres));
      }
    }

    /*
    Get reports
    */
    /*
    NOTA:
    From commit ef6e2751 (2022/02/08) until commit d76fcc35 (2022/02/25), commit of full encryption
    we had a bug where no encryption was save on report creation
    (https://github.com/SocialGouv/mano/blob/ef6e2751ce02f6f34933cf2472492b1d5cd028d6/api/src/controllers/report.js#L67)
    therefore, no date nor team was encryptely saved and those reports are just pollution
    TODO: migration to delete all those reports from each organisation
    QUICK WIN: filter those reports from recoil state
    */

    if (response.data.reports) {
      setLoading("Chargement des comptes-rendus");
      const refreshedReports = await getData({
        collectionName: "report",
        data: reports,
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedReports) {
        setReports((oldReports) => mergeItems(oldReports, refreshedReports, { filterNewItemsFunction: (r) => !!r.team && !!r.date }));
      }
    }

    /*
    Reset refresh trigger
    */
    initialLoadDone.current = true;
    await new Promise((res) => setTimeout(res, 150));
    setLastRefresh(serverDate);
    setLoading("");
    setProgress(0);
    setFullScreen(false);
    setRefreshTrigger({
      status: false,
      options: { showFullScreen: false, initialLoad: false },
    });
  };

  useEffect(() => {
    if (refreshTrigger.status === true) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger.status]);

  return null;
};
