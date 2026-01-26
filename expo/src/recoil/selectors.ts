import { atom, useAtomValue } from "jotai";
import { actionsState, CANCEL, DONE, TODO } from "./actions";
import { currentTeamState } from "./auth";
import { commentsState } from "./comments";
import { personsState } from "./persons";
import { placesState } from "./places";
import { relsPersonPlaceState } from "./relPersonPlace";
import { isComingInDays, isPassed, isToday, isTomorrow } from "../services/date";
import { filterBySearch } from "../utils/search";
import { consultationsState } from "./consultations";
import { rencontresState } from "./rencontres";
import { treatmentsState } from "./treatments";
import { medicalFileState } from "./medicalFiles";
import { groupsState } from "./groups";
import { dayjsInstance, formatAge, formatBirthDate } from "../services/dateDayjs";
import { passagesState } from "./passages";
import { PersonInstance, PersonPopulated } from "@/types/person";
import { Document, Folder } from "@/types/document";
import { CommentInstance } from "@/types/comment";
import { ActionInstance, ActionStatus } from "@/types/action";
import { PlaceInstance } from "@/types/place";
import { ConsultationInstance } from "@/types/consultation";

export const actionsObjectSelector = atom<Record<ActionInstance["_id"], ActionInstance>>((get) => {
  const actions = get(actionsState);
  const actionsObject: Record<ActionInstance["_id"], ActionInstance> = {};
  for (const action of actions) {
    actionsObject[action._id] = { ...action };
  }
  return actionsObject;
});

type ActionWithComments = ActionInstance & { comments: CommentInstance[] };
export const actionsWithCommentsSelector = atom<Record<ActionInstance["_id"], ActionWithComments>>((get) => {
  const actions = get(actionsState);
  const comments = get(commentsState);
  const actionsObject: Record<ActionInstance["_id"], ActionWithComments> = {};
  for (const action of actions) {
    actionsObject[action._id] = { ...action, comments: [] };
  }
  for (const comment of comments) {
    if (!comment.action) continue;
    if (!actionsObject[comment.action]) continue;
    actionsObject[comment.action].comments.push(comment);
  }
  return actionsObject;
});

const placesObjectSelector = atom<Record<string, PlaceInstance>>((get) => {
  const places = get(placesState);
  const placesObject: Record<string, PlaceInstance> = {};
  for (const place of places) {
    if (!place?.name) continue;
    placesObject[place._id!] = place;
  }
  return placesObject;
});

export const itemsGroupedByPersonSelector = atom<Record<PersonInstance["_id"], PersonPopulated>>((get) => {
  const persons = get(personsState);
  const personsObject: Record<PersonInstance["_id"], PersonPopulated> = {};
  for (const person of persons) {
    const age = person.birthdate ? formatAge(person.birthdate) : 0;
    const nameLowercased = person.name.toLocaleLowerCase();
    // replace all accents with normal letters
    const nameNormalized = nameLowercased.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Calculate follow since months
    const followSinceMonths = Math.abs(dayjsInstance().diff(person.followedSince || person.createdAt, "months"));
    personsObject[person._id] = {
      ...person,
      nameNormalized,
      formattedBirthDate: person.birthdate ? `${age} (${formatBirthDate(person.birthdate)})` : undefined,
      age: age ? Number(age) : undefined,
      followSinceMonths,
      // remove anything that is not a number
      formattedPhoneNumber: person.phone?.replace(/\D/g, ""),
      // Initialize counters for filters
      numberOfActions: 0,
      numberOfConsultations: 0,
      numberOfTreatments: 0,
      numberOfPassages: 0,
      numberOfRencontres: 0,
      hasAtLeastOneConsultation: false,
      actionCategories: [],
    };
  }
  const actions = Object.values(get(actionsWithCommentsSelector));
  const comments = get(commentsState);
  const consultations = get(consultationsState);
  const treatments = get(treatmentsState);
  const medicalFiles = [...get(medicalFileState)].sort((a, b) => dayjsInstance(b.createdAt).diff(dayjsInstance(a.createdAt)));
  const relsPersonPlace = get(relsPersonPlaceState);
  const places = get(placesObjectSelector);
  const rencontres = get(rencontresState);
  const passages = get(passagesState);
  const groups = get(groupsState);

  for (const group of groups) {
    if (!group.persons?.length) continue;
    for (const person of group.persons) {
      if (!personsObject[person]) continue;
      personsObject[person].group = group;
    }
  }

  for (const person of persons) {
    if (!person.documents?.length) continue;
    if (!personsObject[person._id].group) continue;
    for (const document of person.documents) {
      if (!(document as Document).group) continue;
      for (const personIdInGroup of personsObject[person._id].group!.persons) {
        if (personIdInGroup === person._id) continue;
        if (!personsObject[personIdInGroup]) continue;
        if (!personsObject[personIdInGroup].groupDocuments) {
          personsObject[personIdInGroup].groupDocuments = [];
        }
        personsObject[personIdInGroup].groupDocuments.push({
          ...(document as Document),
          person: person._id,
          personPopulated: person,
          linkedItem: {
            _id: person._id,
            type: "person",
          },
        });
      }
    }
  }

  // Helper object to track unique action categories per person
  const personActionCategoriesObject: Record<string, Record<string, boolean>> = {};

  for (const action of actions) {
    if (!action.person) continue;
    if (!personsObject[action.person]) continue;
    personsObject[action.person].actions = personsObject[action.person].actions || [];
    personsObject[action.person].actions!.push(action);

    // Increment numberOfActions
    personsObject[action.person].numberOfActions = (personsObject[action.person].numberOfActions || 0) + 1;

    // Track action categories (unique list)
    if (action.categories?.length) {
      for (const category of action.categories) {
        personActionCategoriesObject[action.person] = personActionCategoriesObject[action.person] || {};
        if (!personActionCategoriesObject[action.person][category]) {
          personActionCategoriesObject[action.person][category] = true;
          personsObject[action.person].actionCategories = personsObject[action.person].actionCategories || [];
          personsObject[action.person].actionCategories!.push(category);
        }
      }
    }

    if (!!action.group) {
      const group = personsObject[action.person].group;
      if (!group) continue;
      for (const person of group.persons) {
        if (!personsObject[person]) continue;
        if (person === action.person) continue;
        personsObject[person].actions = personsObject[person].actions || [];
        personsObject[person].actions.push(action);
      }
    }
  }
  for (const [index, comment] of Object.entries(comments)) {
    if (!comment.person) continue;
    if (!personsObject[comment.person]) continue;
    personsObject[comment.person].comments = personsObject[comment.person].comments || [];
    personsObject[comment.person].comments!.push(comment);
    if (!!comment.group) {
      const group = personsObject[comment.person].group;
      if (!group) continue;
      for (const person of group.persons) {
        if (!personsObject[person]) continue;
        if (person === comment.person) continue;
        personsObject[person].comments = personsObject[person].comments || [];
        personsObject[person].comments.push(comment);
      }
    }
  }
  for (const relPersonPlace of relsPersonPlace) {
    if (!personsObject[relPersonPlace.person]) continue;
    const place = places[relPersonPlace.place];
    if (!place) continue;
    personsObject[relPersonPlace.person].places = personsObject[relPersonPlace.person].places || [];
    personsObject[relPersonPlace.person].places!.push(place.name);
    personsObject[relPersonPlace.person].relsPersonPlace = personsObject[relPersonPlace.person].relsPersonPlace || [];
    personsObject[relPersonPlace.person].relsPersonPlace!.push(relPersonPlace);
  }
  for (const consultation of consultations) {
    if (!personsObject[consultation.person]) continue;
    personsObject[consultation.person].consultations = personsObject[consultation.person].consultations || [];
    personsObject[consultation.person].consultations!.push(consultation);
    personsObject[consultation.person].hasAtLeastOneConsultation = true;
    personsObject[consultation.person].numberOfConsultations = (personsObject[consultation.person].numberOfConsultations || 0) + 1;
  }
  for (const treatment of treatments) {
    if (!personsObject[treatment.person]) continue;
    personsObject[treatment.person].treatments = personsObject[treatment.person].treatments || [];
    personsObject[treatment.person].treatments!.push(treatment);
    personsObject[treatment.person].numberOfTreatments = (personsObject[treatment.person].numberOfTreatments || 0) + 1;
  }
  for (const medicalFile of medicalFiles) {
    if (!personsObject[medicalFile.person]) continue;
    if (personsObject[medicalFile.person].medicalFile) {
      const nextDocuments: Record<string, Document | Folder> = {};
      const nextComments: Record<CommentInstance["_id"], CommentInstance> = {};
      const existingMedicalFile = personsObject[medicalFile.person].medicalFile!;
      for (const document of medicalFile.documents || []) {
        nextDocuments[document._id] = document;
      }
      for (const document of existingMedicalFile.documents || []) {
        nextDocuments[document._id] = document;
      }
      for (const comment of medicalFile.comments || []) {
        nextComments[comment._id] = comment;
      }
      for (const comment of existingMedicalFile.comments || []) {
        nextComments[comment._id] = comment;
      }
      personsObject[medicalFile.person].medicalFile = {
        ...medicalFile,
        ...personsObject[medicalFile.person].medicalFile,
        documents: Object.values(nextDocuments),
        comments: Object.values(nextComments),
      };
    } else {
      personsObject[medicalFile.person].medicalFile = medicalFile;
    }
  }

  for (const passage of passages) {
    if (!passage.person) continue;
    if (!personsObject[passage.person]) continue;
    personsObject[passage.person].passages = personsObject[passage.person].passages || [];
    personsObject[passage.person].passages!.push(passage);
    personsObject[passage.person].numberOfPassages = (personsObject[passage.person].numberOfPassages || 0) + 1;
  }
  for (const rencontre of rencontres) {
    if (!rencontre.person) continue;
    if (!personsObject[rencontre.person]) continue;
    personsObject[rencontre.person].rencontres = personsObject[rencontre.person].rencontres || [];
    personsObject[rencontre.person].rencontres!.push(rencontre);
    personsObject[rencontre.person].numberOfRencontres = (personsObject[rencontre.person].numberOfRencontres || 0) + 1;
  }
  return personsObject;
});

export const arrayOfitemsGroupedByPersonSelector = atom((get) => {
  const itemsGroupedByPerson = get(itemsGroupedByPersonSelector);
  return Object.values(itemsGroupedByPerson).sort((a, b) => (a.nameNormalized > b.nameNormalized ? 1 : -1));
});

export const usePersonsSearchSelector = (search: string) => {
  const persons = useAtomValue(arrayOfitemsGroupedByPersonSelector);
  if (!search?.length) return persons;
  const filteredPersons = filterBySearch(search, persons);
  return filteredPersons;
};

export const actionsForCurrentTeamSelector = atom((get) => {
  const actions = get(actionsState);
  const currentTeam = get(currentTeamState)!;
  const filteredActions = actions.filter((a) => (Array.isArray(a.teams) ? a.teams.includes(currentTeam?._id) : a.team === currentTeam?._id));
  return filteredActions;
});

export const PASSED = "PASSED";
export const TODAY = "TODAY";
export const INCOMINGDAYS = "INCOMINGDAYS";

/*

Actions and consultations

*/

type CommonActionOrConsultation = Pick<ActionInstance, "status" | "completedAt" | "dueAt">;
const sortDoneOrCancel = (a: CommonActionOrConsultation, b: CommonActionOrConsultation) => {
  if (!a.completedAt) return -1;
  if (!b.completedAt) return 1;
  if (a.completedAt > b.completedAt) return -1;
  return 1;
};

const sortTodo = (a: CommonActionOrConsultation, b: CommonActionOrConsultation) => {
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  if (a.dueAt > b.dueAt) return 1;
  return -1;
};
/*

Actions and Consultations

*/

export const consultationsForCurrentTeamSelector = atom<Array<ConsultationInstance & { isConsultation: boolean }>>((get) => {
  const consultations = get(consultationsState);
  const currentTeam = get(currentTeamState)!;
  const filteredConsultations = [];
  for (const consultation of consultations) {
    if (!consultation.teams?.length || consultation.teams.includes(currentTeam?._id)) {
      filteredConsultations.push({
        ...consultation,
        isConsultation: true,
      });
    }
  }
  return filteredConsultations;
});

const actionsAndConsultationsSelector = atom((get) => {
  const actions = get(actionsForCurrentTeamSelector);
  const consultations = get(consultationsForCurrentTeamSelector);
  const merged = [...actions, ...consultations];
  return merged;
});

const actionsDoneSelector = atom((get) => {
  const actions = get(actionsAndConsultationsSelector);
  const filteredActions = actions.filter((a) => a.status === DONE).sort(sortDoneOrCancel);
  return filteredActions;
});

const useActionsDoneSelectorSliced = (limit?: number) => {
  const actionsDone = useAtomValue(actionsDoneSelector);
  if (!limit) return actionsDone;
  return actionsDone.filter((_, index) => index < limit);
};

const actionsTodoSelector = atom((get) => {
  const actions = get(actionsAndConsultationsSelector);
  const filteredActions = actions.filter((a) => a.status === TODO).sort(sortTodo);
  return filteredActions;
});

const actionsCanceledSelector = atom((get) => {
  const actions = get(actionsAndConsultationsSelector);
  const filteredActions = actions.filter((a) => a.status === CANCEL).sort(sortDoneOrCancel);
  return filteredActions;
});

const useActionsCanceledSelectorSliced = (limit?: number) => {
  const actionsCanceled = useAtomValue(actionsCanceledSelector);
  if (!limit) return actionsCanceled;
  return actionsCanceled.filter((_, index) => index < limit);
};

const filterByTimeframe = (actions: CommonActionOrConsultation[], timeframe?: string) => {
  switch (timeframe) {
    case PASSED:
      return actions.filter((action) => isPassed(action.dueAt));
    case TODAY:
      return actions.filter((action) => isToday(action.dueAt));
    case INCOMINGDAYS:
      return actions.filter((action) => isComingInDays(action.dueAt, 1));
    default:
      return actions;
  }
};

const filterByCategories = (actions: CommonActionOrConsultation[], categories?: string[]) => {
  if (!categories?.length) return actions;
  return actions.filter((action) => (action as ActionInstance).categories?.some((category) => categories.includes(category)));
};

export const useActionsByStatusAndTimeframeSelector = (
  status: ActionStatus,
  limit?: number,
  timeframe?: string,
  filters?: { categories?: string[] }
) => {
  if (status === DONE) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const actions = useActionsDoneSelectorSliced(limit);
    return filterByCategories(actions, filters?.categories);
  }
  if (status === TODO) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const actions = useAtomValue(actionsTodoSelector);
    const timeFiltered = filterByTimeframe(actions, timeframe);
    return filterByCategories(timeFiltered, filters?.categories);
  }
  if (status === CANCEL) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const actions = useActionsCanceledSelectorSliced(limit);
    return filterByCategories(actions, filters?.categories);
  }
  return [];
};

export const useTotalActionsByStatusSelector = (status: ActionStatus, timeframe?: string, filters?: { categories?: string[] }) => {
  const actions = useActionsByStatusAndTimeframeSelector(status, undefined, timeframe, filters);
  return actions.length;
};
