import { useEffect, useRef } from "react";
import API from "../services/api";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { appCurrentCacheKey, getData, getDataWithRaw, getEncryptedCacheItem, setEncryptedCacheItem } from "../services/dataManagement";
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
import { PersonInstance } from "@/types/person";
import { GroupInstance } from "@/types/group";
import { ConsultationInstance } from "@/types/consultation";
import { RelPersonPlaceInstance } from "@/types/place";
import { TerritoryObservationInstance } from "@/types/territoryObs";
import { PassageInstance } from "@/types/passage";

export const loadingState = atom("");

export const progressState = atom(0);

export const loaderFullScreenState = atom(false);

export const refreshTriggerState = atom({
  status: false,
  options: { showFullScreen: false, initialLoad: false },
});

export function mergeItems<T extends { _id?: string; deletedAt?: any }>(
  oldItems: T[],
  newItems: T[] = [],
  { formatNewItemsFunction, filterNewItemsFunction }: { formatNewItemsFunction?: (item: T) => T; filterNewItemsFunction?: (item: T) => boolean } = {},
): T[] {
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

export const DataLoader = () => {
  const [lastRefresh, setLastRefresh] = useMMKVNumber(appCurrentCacheKey);

  const setLoading = useSetAtom(loadingState);
  const setProgress = useSetAtom(progressState);
  const setFullScreen = useSetAtom(loaderFullScreenState);
  const [organisation, setOrganisation] = useAtom(organisationState);
  const user = useAtomValue(userState)!;
  const setUser = useSetAtom(userState);
  const organisationId = organisation?._id;

  const setPersons = useSetAtom(personsState);
  const setActions = useSetAtom(actionsState);
  const setGroups = useSetAtom(groupsState);
  const setConsultations = useSetAtom(consultationsState);
  const setTreatments = useSetAtom(treatmentsState);
  const setMedicalFiles = useSetAtom(medicalFileState);
  const setTerritories = useSetAtom(territoriesState);
  const setPlaces = useSetAtom(placesState);
  const setRelsPersonPlace = useSetAtom(relsPersonPlaceState);
  const setTerritoryObs = useSetAtom(territoryObservationsState);
  const setComments = useSetAtom(commentsState);
  const setPassages = useSetAtom(passagesState);
  const setRencontres = useSetAtom(rencontresState);
  const setReports = useSetAtom(reportsState);
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);

  // to prevent auto-refresh to trigger on the first render
  const initialLoadDone = useRef(false);

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
        // Medical data is cached encrypted in MMKV, but we still reload all on initial load for safety.
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
      const refreshedPersons: PersonInstance[] = await getData({
        collectionName: "person",
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedPersons) {
        const newPersons = refreshedPersons.map((p) => ({ ...p, followedSince: p.followedSince }));
        setPersons((oldPersons) => mergeItems(oldPersons, newPersons));
      }
    }
    /*
    Get groups
    */
    if (response.data.groups) {
      setLoading("Chargement des familles");
      const refreshedGroups: GroupInstance[] = await getData({
        collectionName: "group",
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
      const { decryptedData: refreshedConsultations, rawData: rawConsultations } = await getDataWithRaw({
        collectionName: "consultation",
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh: initialLoad ? 0 : lastRefresh,
      });
      if (initialLoad) {
        const encryptedCache = getEncryptedCacheItem<any[]>("consultation", []);
        const mergedEncrypted = rawConsultations.length ? mergeItems(encryptedCache, rawConsultations) : encryptedCache;
        setEncryptedCacheItem("consultation", mergedEncrypted);
        const allDecrypted = [];
        for (const item of mergedEncrypted) {
          const decryptedItem = await API.decryptDBItem({ ...item });
          allDecrypted.push(decryptedItem);
        }
        setConsultations(allDecrypted.filter(Boolean).map(formatConsultation));
      } else if (refreshedConsultations.length) {
        setConsultations((oldConsultations) => mergeItems(oldConsultations, refreshedConsultations, { formatNewItemsFunction: formatConsultation }));
        const encryptedCache = getEncryptedCacheItem<any[]>("consultation", []);
        setEncryptedCacheItem("consultation", mergeItems(encryptedCache, rawConsultations));
      }
    }
    /*
    Get treatments
    */
    if (["admin", "normal"].includes(user.role)) {
      if (response.data.treatments || initialLoad) {
        setLoading("Chargement des traitements");
        const { decryptedData: refreshedTreatments, rawData: rawTreatments } = await getDataWithRaw({
          collectionName: "treatment",
          setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
          lastRefresh: initialLoad ? 0 : lastRefresh,
        });
        if (initialLoad) {
          const encryptedCache = getEncryptedCacheItem<any[]>("treatment", []);
          const mergedEncrypted = rawTreatments.length ? mergeItems(encryptedCache, rawTreatments) : encryptedCache;
          setEncryptedCacheItem("treatment", mergedEncrypted);
          const allDecrypted = [];
          for (const item of mergedEncrypted) {
            const decryptedItem = await API.decryptDBItem({ ...item });
            allDecrypted.push(decryptedItem);
          }
          setTreatments(allDecrypted.filter(Boolean));
        } else if (refreshedTreatments.length) {
          setTreatments((oldTreatments) => mergeItems(oldTreatments, refreshedTreatments));
          const encryptedCache = getEncryptedCacheItem<any[]>("treatment", []);
          setEncryptedCacheItem("treatment", mergeItems(encryptedCache, rawTreatments));
        }
      }
      /*
      Get medicalFiles
      */
      if (response.data.medicalFiles || initialLoad) {
        setLoading("Chargement des dossiers médicaux");
        const { decryptedData: refreshedMedicalFiles, rawData: rawMedicalFiles } = await getDataWithRaw({
          collectionName: "medical-file",
          setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
          lastRefresh: initialLoad ? 0 : lastRefresh,
        });
        if (initialLoad) {
          const encryptedCache = getEncryptedCacheItem<any[]>("medical-file", []);
          const mergedEncrypted = rawMedicalFiles.length ? mergeItems(encryptedCache, rawMedicalFiles) : encryptedCache;
          setEncryptedCacheItem("medical-file", mergedEncrypted);
          const allDecrypted = [];
          for (const item of mergedEncrypted) {
            const decryptedItem = await API.decryptDBItem({ ...item });
            allDecrypted.push(decryptedItem);
          }
          setMedicalFiles(allDecrypted.filter(Boolean));
        } else if (refreshedMedicalFiles.length) {
          setMedicalFiles((oldMedicalFiles) => mergeItems(oldMedicalFiles, refreshedMedicalFiles));
          const encryptedCache = getEncryptedCacheItem<any[]>("medical-file", []);
          setEncryptedCacheItem("medical-file", mergeItems(encryptedCache, rawMedicalFiles));
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
        setProgress: (batch) => setProgress((p) => (p * total + batch) / total),
        lastRefresh,
      });
      if (refreshedPlaces) {
        setPlaces((oldPlaces) => mergeItems(oldPlaces, refreshedPlaces).sort((p1, p2) => p1.name!.localeCompare(p2.name!)));
      }
    }
    if (response.data.relsPersonPlace) {
      const refreshedRelPersonPlaces: RelPersonPlaceInstance[] = await getData({
        collectionName: "relPersonPlace",
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
      const refreshedObs: TerritoryObservationInstance[] = await getData({
        collectionName: "territory-observation",
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
      const refreshedPassages: PassageInstance[] = await getData({
        collectionName: "passage",
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
      requestIdleCallback(refresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger.status]);

  return null;
};
