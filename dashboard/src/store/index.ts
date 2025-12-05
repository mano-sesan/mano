import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { subscribeWithSelector } from "zustand/middleware";
import { setCacheItem } from "../services/dataManagement";
import { AppSentry } from "../services/sentry";
import type { OrganisationInstance } from "../types/organisation";
import type { UserInstance } from "../types/user";
import type { TeamInstance } from "../types/team";
import type { PersonInstance } from "../types/person";
import type { ActionInstance } from "../types/action";
import type { ConsultationInstance } from "../types/consultation";
import type { ReportInstance } from "../types/report";
import type { GroupInstance } from "../types/group";
import type { TerritoryInstance } from "../types/territory";
import type { TerritoryObservationInstance } from "../types/territoryObs";
import type { RencontreInstance } from "../types/rencontre";
import type { MedicalFileInstance } from "../types/medicalFile";
import type { TreatmentInstance } from "../types/treatment";
import { keepOnlyOneReportAndReturnReportToDelete } from "../utils/delete-duplicated-reports";
import { capture } from "../services/sentry";
import API from "../services/api";

// Types for entities without explicit type files
export interface PassageInstance {
  _id: string;
  person?: string;
  team: string;
  user: string;
  date: string;
  comment?: string;
  organisation: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PlaceInstance {
  _id: string;
  name: string;
  user: string;
  organisation: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface RelPersonPlaceInstance {
  _id: string;
  person: string;
  place: string;
  user: string;
  organisation: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CommentInstance {
  _id: string;
  comment: string;
  person?: string;
  action?: string;
  group?: boolean;
  team: string;
  user: string;
  date: string;
  urgent?: boolean;
  organisation: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface RecurrenceInstance {
  _id: string;
  startDate: string;
  endDate?: string;
  timeInterval: number;
  timeUnit: string;
  organisation: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Modal types
export interface ModalActionState {
  open: boolean;
  from?: string;
  isForMultiplePerson?: boolean;
  isEditing?: boolean;
  isEditingAllNextOccurences?: boolean;
  action?: Partial<ActionInstance> | null;
}

export interface ModalObservationState {
  open: boolean;
  from?: string;
  isEditing?: boolean;
  observation?: Partial<TerritoryObservationInstance> | null;
  rencontresInProgress?: RencontreInstance[];
}

// Data state type
interface DataState {
  persons: PersonInstance[];
  groups: GroupInstance[];
  actions: ActionInstance[];
  consultations: ConsultationInstance[];
  treatments: TreatmentInstance[];
  medicalFiles: MedicalFileInstance[];
  reports: ReportInstance[];
  passages: PassageInstance[];
  rencontres: RencontreInstance[];
  territories: TerritoryInstance[];
  territoryObservations: TerritoryObservationInstance[];
  places: PlaceInstance[];
  relsPersonPlace: RelPersonPlaceInstance[];
  comments: CommentInstance[];
  recurrences: RecurrenceInstance[];
}

// Auth state type
interface AuthState {
  user: UserInstance | null;
  organisation: OrganisationInstance | null;
  teams: TeamInstance[];
  users: UserInstance[];
  deletedUsers: UserInstance[];
  currentTeam: TeamInstance | null;
  sessionInitialDateTimestamp: number | null;
  encryptionKeyLength: number | null;
}

// Loading state type
interface LoadingState {
  isLoading: boolean;
  fullScreen: boolean;
  progress: number | null;
  total: number | null;
  totalLoadingDuration: number;
  loadingText: string;
  initialLoadIsDone: boolean;
}

// Version state type
interface VersionState {
  deploymentDate: string | null;
  deploymentCommit: string | null;
}

// Modal confirm state type
export interface ModalConfirmState {
  open: boolean;
  options: {
    title: string;
    subTitle: string;
    buttons: {
      text: string;
      onClick?: () => void;
      style?: string;
      className?: string;
    }[];
  };
}

const defaultModalConfirmState = (): ModalConfirmState => ({
  open: false,
  options: {
    title: "Voulez-vous enregistrer cet élément ?",
    subTitle: "",
    buttons: [],
  },
});

// Modal state type
interface ModalState {
  modalAction: ModalActionState;
  modalObservation: ModalObservationState;
  modalConfirm: ModalConfirmState;
}

// UI state type
interface UIState {
  showDrawer: boolean;
}

// Full store type
interface Store extends DataState, AuthState, LoadingState, VersionState, ModalState, UIState {
  // Data setters
  setPersons: (persons: PersonInstance[] | ((prev: PersonInstance[]) => PersonInstance[])) => void;
  setGroups: (groups: GroupInstance[] | ((prev: GroupInstance[]) => GroupInstance[])) => void;
  setActions: (actions: ActionInstance[] | ((prev: ActionInstance[]) => ActionInstance[])) => void;
  setConsultations: (consultations: ConsultationInstance[] | ((prev: ConsultationInstance[]) => ConsultationInstance[])) => void;
  setTreatments: (treatments: TreatmentInstance[] | ((prev: TreatmentInstance[]) => TreatmentInstance[])) => void;
  setMedicalFiles: (medicalFiles: MedicalFileInstance[] | ((prev: MedicalFileInstance[]) => MedicalFileInstance[])) => void;
  setReports: (reports: ReportInstance[] | ((prev: ReportInstance[]) => ReportInstance[])) => void;
  setPassages: (passages: PassageInstance[] | ((prev: PassageInstance[]) => PassageInstance[])) => void;
  setRencontres: (rencontres: RencontreInstance[] | ((prev: RencontreInstance[]) => RencontreInstance[])) => void;
  setTerritories: (territories: TerritoryInstance[] | ((prev: TerritoryInstance[]) => TerritoryInstance[])) => void;
  setTerritoryObservations: (
    observations: TerritoryObservationInstance[] | ((prev: TerritoryObservationInstance[]) => TerritoryObservationInstance[])
  ) => void;
  setPlaces: (places: PlaceInstance[] | ((prev: PlaceInstance[]) => PlaceInstance[])) => void;
  setRelsPersonPlace: (rels: RelPersonPlaceInstance[] | ((prev: RelPersonPlaceInstance[]) => RelPersonPlaceInstance[])) => void;
  setComments: (comments: CommentInstance[] | ((prev: CommentInstance[]) => CommentInstance[])) => void;
  setRecurrences: (recurrences: RecurrenceInstance[] | ((prev: RecurrenceInstance[]) => RecurrenceInstance[])) => void;

  // Auth setters
  setUser: (user: UserInstance | null) => void;
  setOrganisation: (organisation: OrganisationInstance | null) => void;
  setTeams: (teams: TeamInstance[]) => void;
  setUsers: (users: UserInstance[]) => void;
  setDeletedUsers: (users: UserInstance[]) => void;
  setCurrentTeam: (team: TeamInstance | null) => void;
  setSessionInitialDateTimestamp: (timestamp: number | null) => void;
  setEncryptionKeyLength: (length: number | null) => void;

  // Loading setters
  setIsLoading: (loading: boolean) => void;
  setFullScreen: (fullScreen: boolean) => void;
  setProgress: (progress: number | null | ((prev: number | null) => number | null)) => void;
  setTotal: (total: number | null) => void;
  setTotalLoadingDuration: (duration: number | ((prev: number) => number)) => void;
  setLoadingText: (text: string) => void;
  setInitialLoadIsDone: (done: boolean) => void;

  // Version setters
  setDeploymentDate: (date: string | null) => void;
  setDeploymentCommit: (commit: string | null) => void;

  // Modal setters
  setModalAction: (state: Partial<ModalActionState>) => void;
  setModalObservation: (state: Partial<ModalObservationState>) => void;
  setModalConfirm: (state: Partial<ModalConfirmState> | ((prev: ModalConfirmState) => ModalConfirmState)) => void;

  // UI setters
  setShowDrawer: (show: boolean) => void;

  // Reset
  reset: () => void;
}

// Default modal states
const defaultModalActionState = (): ModalActionState => ({
  open: false,
  from: "/reception",
  isEditing: false,
  isForMultiplePerson: false,
  isEditingAllNextOccurences: false,
  action: null,
});

const defaultModalObservationState = (): ModalObservationState => ({
  open: false,
  from: "/territory",
  isEditing: false,
  observation: null,
  rencontresInProgress: [],
});

// Initial loading text
const initialLoadingText = "En attente de chargement";

// Load modal state from localStorage
const loadModalActionFromStorage = (): ModalActionState => {
  try {
    const saved = localStorage.getItem("modalActionValue");
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return defaultModalActionState();
};

const loadModalObservationFromStorage = (): ModalObservationState => {
  try {
    const saved = localStorage.getItem("modalObservationValue");
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return defaultModalObservationState();
};

// Create the store
export const useStore = create<Store>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Data state - initial values
      persons: [],
      groups: [],
      actions: [],
      consultations: [],
      treatments: [],
      medicalFiles: [],
      reports: [],
      passages: [],
      rencontres: [],
      territories: [],
      territoryObservations: [],
      places: [],
      relsPersonPlace: [],
      comments: [],
      recurrences: [],

      // Auth state - initial values
      user: null,
      organisation: null,
      teams: [],
      users: [],
      deletedUsers: [],
      currentTeam: null,
      sessionInitialDateTimestamp: null,
      encryptionKeyLength: null,

      // Loading state - initial values
      isLoading: false,
      fullScreen: true,
      progress: null,
      total: null,
      totalLoadingDuration: 0,
      loadingText: initialLoadingText,
      initialLoadIsDone: false,

      // Version state - initial values
      deploymentDate: null,
      deploymentCommit: null,

      // Modal state - initial values (loaded from localStorage)
      modalAction: loadModalActionFromStorage(),
      modalObservation: loadModalObservationFromStorage(),
      modalConfirm: defaultModalConfirmState(),

      // UI state - initial values
      showDrawer: false,

      // Data setters - support both direct value and updater function
      setPersons: (persons) =>
        set((state) => {
          state.persons = typeof persons === "function" ? persons(state.persons) : persons;
        }),
      setGroups: (groups) =>
        set((state) => {
          state.groups = typeof groups === "function" ? groups(state.groups) : groups;
        }),
      setActions: (actions) =>
        set((state) => {
          state.actions = typeof actions === "function" ? actions(state.actions) : actions;
        }),
      setConsultations: (consultations) =>
        set((state) => {
          state.consultations = typeof consultations === "function" ? consultations(state.consultations) : consultations;
        }),
      setTreatments: (treatments) =>
        set((state) => {
          state.treatments = typeof treatments === "function" ? treatments(state.treatments) : treatments;
        }),
      setMedicalFiles: (medicalFiles) =>
        set((state) => {
          state.medicalFiles = typeof medicalFiles === "function" ? medicalFiles(state.medicalFiles) : medicalFiles;
        }),
      setReports: (reports) =>
        set((state) => {
          state.reports = typeof reports === "function" ? reports(state.reports) : reports;
        }),
      setPassages: (passages) =>
        set((state) => {
          state.passages = typeof passages === "function" ? passages(state.passages) : passages;
        }),
      setRencontres: (rencontres) =>
        set((state) => {
          state.rencontres = typeof rencontres === "function" ? rencontres(state.rencontres) : rencontres;
        }),
      setTerritories: (territories) =>
        set((state) => {
          state.territories = typeof territories === "function" ? territories(state.territories) : territories;
        }),
      setTerritoryObservations: (observations) =>
        set((state) => {
          state.territoryObservations = typeof observations === "function" ? observations(state.territoryObservations) : observations;
        }),
      setPlaces: (places) =>
        set((state) => {
          state.places = typeof places === "function" ? places(state.places) : places;
        }),
      setRelsPersonPlace: (rels) =>
        set((state) => {
          state.relsPersonPlace = typeof rels === "function" ? rels(state.relsPersonPlace) : rels;
        }),
      setComments: (comments) =>
        set((state) => {
          state.comments = typeof comments === "function" ? comments(state.comments) : comments;
        }),
      setRecurrences: (recurrences) =>
        set((state) => {
          state.recurrences = typeof recurrences === "function" ? recurrences(state.recurrences) : recurrences;
        }),

      // Auth setters
      setUser: (user) =>
        set((state) => {
          state.user = user;
        }),
      setOrganisation: (organisation) =>
        set((state) => {
          state.organisation = organisation;
        }),
      setTeams: (teams) =>
        set((state) => {
          state.teams = teams;
        }),
      setUsers: (users) =>
        set((state) => {
          state.users = users;
        }),
      setDeletedUsers: (users) =>
        set((state) => {
          state.deletedUsers = users;
        }),
      setCurrentTeam: (team) =>
        set((state) => {
          state.currentTeam = team;
        }),
      setSessionInitialDateTimestamp: (timestamp) =>
        set((state) => {
          state.sessionInitialDateTimestamp = timestamp;
        }),
      setEncryptionKeyLength: (length) =>
        set((state) => {
          state.encryptionKeyLength = length;
        }),

      // Loading setters
      setIsLoading: (loading) =>
        set((state) => {
          state.isLoading = loading;
        }),
      setFullScreen: (fullScreen) =>
        set((state) => {
          state.fullScreen = fullScreen;
        }),
      setProgress: (progress) =>
        set((state) => {
          state.progress = typeof progress === "function" ? progress(state.progress) : progress;
        }),
      setTotal: (total) =>
        set((state) => {
          state.total = total;
        }),
      setTotalLoadingDuration: (duration) =>
        set((state) => {
          state.totalLoadingDuration = typeof duration === "function" ? duration(state.totalLoadingDuration) : duration;
        }),
      setLoadingText: (text) =>
        set((state) => {
          state.loadingText = text;
        }),
      setInitialLoadIsDone: (done) =>
        set((state) => {
          state.initialLoadIsDone = done;
        }),

      // Version setters
      setDeploymentDate: (date) =>
        set((state) => {
          state.deploymentDate = date;
        }),
      setDeploymentCommit: (commit) =>
        set((state) => {
          state.deploymentCommit = commit;
        }),

      // Modal setters
      setModalAction: (newState) =>
        set((state) => {
          Object.assign(state.modalAction, newState);
        }),
      setModalObservation: (newState) =>
        set((state) => {
          Object.assign(state.modalObservation, newState);
        }),
      setModalConfirm: (newState) =>
        set((state) => {
          if (typeof newState === "function") {
            state.modalConfirm = newState(state.modalConfirm);
          } else {
            Object.assign(state.modalConfirm, newState);
          }
        }),

      // UI setters
      setShowDrawer: (show) =>
        set((state) => {
          state.showDrawer = show;
        }),

      // Reset - clears all state
      reset: () =>
        set((state) => {
          // Reset data
          state.persons = [];
          state.groups = [];
          state.actions = [];
          state.consultations = [];
          state.treatments = [];
          state.medicalFiles = [];
          state.reports = [];
          state.passages = [];
          state.rencontres = [];
          state.territories = [];
          state.territoryObservations = [];
          state.places = [];
          state.relsPersonPlace = [];
          state.comments = [];
          state.recurrences = [];
          // Reset auth
          state.user = null;
          state.organisation = null;
          state.teams = [];
          state.users = [];
          state.deletedUsers = [];
          state.currentTeam = null;
          state.sessionInitialDateTimestamp = null;
          state.encryptionKeyLength = null;
          // Reset loading
          state.isLoading = false;
          state.fullScreen = true;
          state.progress = null;
          state.total = null;
          state.loadingText = initialLoadingText;
          state.initialLoadIsDone = false;
          // Reset modals
          state.modalAction = defaultModalActionState();
          state.modalObservation = defaultModalObservationState();
          state.modalConfirm = defaultModalConfirmState();
          // Reset UI
          state.showDrawer = false;
        }),
    }))
  )
);

// Setup subscriptions for IndexedDB caching and side effects
// These run outside of React to avoid re-renders

// Cache data to IndexedDB when it changes
useStore.subscribe(
  (state) => state.persons,
  (persons) => setCacheItem("person", persons)
);
useStore.subscribe(
  (state) => state.groups,
  (groups) => setCacheItem("group", groups)
);
useStore.subscribe(
  (state) => state.actions,
  (actions) => setCacheItem("action", actions)
);
useStore.subscribe(
  (state) => state.passages,
  (passages) => setCacheItem("passage", passages)
);
useStore.subscribe(
  (state) => state.rencontres,
  (rencontres) => setCacheItem("rencontre", rencontres)
);
useStore.subscribe(
  (state) => state.territories,
  (territories) => setCacheItem("territory", territories)
);
useStore.subscribe(
  (state) => state.territoryObservations,
  (obs) => setCacheItem("territory-observation", obs)
);
useStore.subscribe(
  (state) => state.places,
  (places) => setCacheItem("place", places)
);
useStore.subscribe(
  (state) => state.relsPersonPlace,
  (rels) => setCacheItem("relPersonPlace", rels)
);
useStore.subscribe(
  (state) => state.comments,
  (comments) => setCacheItem("comment", comments)
);
useStore.subscribe(
  (state) => state.recurrences,
  (recurrences) => setCacheItem("recurrence", recurrences)
);

// Reports have special logic for duplicate detection
useStore.subscribe(
  (state) => state.reports,
  async (reports) => {
    setCacheItem("report", reports);

    // Check for duplicate reports
    const duplicateReports = Object.entries(
      reports.reduce<Record<string, Array<ReportInstance>>>((reportsByDate, report) => {
        if (!report.date || report.date < "2022-11-25") return reportsByDate;
        if (!reportsByDate[`${report.date}-${report.team}`]) reportsByDate[`${report.date}-${report.team}`] = [];
        reportsByDate[`${report.date}-${report.team}`].push(report);
        return reportsByDate;
      }, {})
    ).filter(([_key, reportsByDate]) => reportsByDate.length > 1);

    if (duplicateReports.length > 0) {
      for (const [key, reportsByDate] of duplicateReports) {
        const reportsToDelete = keepOnlyOneReportAndReturnReportToDelete(reportsByDate);
        for (const reportToDelete of reportsToDelete) {
          await API.delete({ path: `/report/${reportToDelete._id}` });
        }
        capture(new Error("Duplicated reports " + key), {
          extra: {
            [key]: reportsByDate.map((report) => ({
              _id: report._id,
              date: report.date,
              team: report.team,
              createdAt: report.createdAt,
              deletedAt: report.deletedAt,
              description: report.description,
              collaborations: report.collaborations,
              organisation: report.organisation,
            })),
            reportsToDelete: reportsToDelete.map((report) => ({
              _id: report._id,
              date: report.date,
              team: report.team,
              createdAt: report.createdAt,
              deletedAt: report.deletedAt,
              description: report.description,
              collaborations: report.collaborations,
              organisation: report.organisation,
            })),
          },
          tags: { unique_id: key },
        });
      }
    }
  }
);

// Sentry tracking for user
useStore.subscribe(
  (state) => state.user,
  (user) => {
    AppSentry.setUser({
      id: user?._id,
      email: user?.email,
      organisation: user?.organisation,
    });
  }
);

// Sentry tracking for organisation
useStore.subscribe(
  (state) => state.organisation,
  (organisation) => {
    AppSentry.setTag("organisationId", organisation?._id ?? "unauthenticated");
  }
);

// Sentry tracking for currentTeam
useStore.subscribe(
  (state) => state.currentTeam,
  (currentTeam) => {
    AppSentry.setTag("currentTeam", currentTeam?._id ?? "");
  }
);

// LocalStorage for loading duration
useStore.subscribe(
  (state) => state.totalLoadingDuration,
  (duration) => {
    window.localStorage.setItem("totalLoadingDuration", String(duration));
  }
);

// LocalStorage for modal states
useStore.subscribe(
  (state) => state.modalAction,
  (modalAction) => {
    localStorage.setItem("modalActionValue", JSON.stringify(modalAction));
  }
);
useStore.subscribe(
  (state) => state.modalObservation,
  (modalObservation) => {
    localStorage.setItem("modalObservationValue", JSON.stringify(modalObservation));
  }
);

// Export default modal state creators
export { defaultModalActionState, defaultModalObservationState };

// For accessing state outside React (replacement for recoil-nexus)
export const getState = useStore.getState;
export const setState = useStore.setState;
