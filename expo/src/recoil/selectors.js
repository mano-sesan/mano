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
import { formatAge, formatBirthDate } from "../services/dateDayjs";
import { passagesState } from "./passages";

export const actionsObjectSelector = atom((get) => {
  const actions = get(actionsState);
  const actionsObject = {};
  for (const action of actions) {
    actionsObject[action._id] = { ...action };
  }
  return actionsObject;
});

export const actionsWithCommentsSelector = atom((get) => {
  const actions = get(actionsState);
  const comments = get(commentsState);
  const actionsObject = {};
  for (const action of actions) {
    actionsObject[action._id] = { ...action, comments: [] };
  }
  for (const comment of comments) {
    if (!actionsObject[comment.action]) continue;
    actionsObject[comment.action].comments.push(comment);
  }
  return actionsObject;
});

const placesObjectSelector = atom((get) => {
  const places = get(placesState);
  const placesObject = {};
  for (const place of places) {
    if (!place?.name) continue;
    placesObject[place._id] = place;
  }
  return placesObject;
});

export const itemsGroupedByPersonSelector = atom((get) => {
  const persons = get(personsState);
  const personsObject = {};
  for (const person of persons) {
    const age = person.birthdate ? formatAge(person.birthdate) : 0;
    const nameLowercased = person.name.toLocaleLowerCase();
    // replace all accents with normal letters
    const nameNormalized = nameLowercased.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    personsObject[person._id] = {
      ...person,
      nameNormalized,
      formattedBirthDate: person.birthdate ? `${age} (${formatBirthDate(person.birthdate)})` : null,
      age,
      // remove anything that is not a number
      formattedPhoneNumber: person.phone?.replace(/\D/g, ""),
    };
  }
  const actions = Object.values(get(actionsWithCommentsSelector));
  const comments = get(commentsState);
  const consultations = get(consultationsState);
  const treatments = get(treatmentsState);
  const medicalFiles = [...get(medicalFileState)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
      if (!document.group) continue;
      for (const personIdInGroup of personsObject[person._id].group.persons) {
        if (personIdInGroup === person._id) continue;
        if (!personsObject[personIdInGroup]) continue;
        if (!personsObject[personIdInGroup].groupDocuments) {
          personsObject[personIdInGroup].groupDocuments = [];
        }
        personsObject[personIdInGroup].groupDocuments.push({ ...document, person: person._id, personPopulated: person });
      }
    }
  }

  for (const action of actions) {
    if (!personsObject[action.person]) continue;
    personsObject[action.person].actions = personsObject[action.person].actions || [];
    personsObject[action.person].actions.push(action);
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
    if (!personsObject[comment.person]) continue;
    personsObject[comment.person].comments = personsObject[comment.person].comments || [];
    personsObject[comment.person].comments.push(comment);
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
    personsObject[relPersonPlace.person].places.push(place.name);
    personsObject[relPersonPlace.person].relsPersonPlace = personsObject[relPersonPlace.person].relsPersonPlace || [];
    personsObject[relPersonPlace.person].relsPersonPlace.push(relPersonPlace);
  }
  for (const consultation of consultations) {
    if (!personsObject[consultation.person]) continue;
    personsObject[consultation.person].consultations = personsObject[consultation.person].consultations || [];
    personsObject[consultation.person].consultations.push(consultation);
  }
  for (const treatment of treatments) {
    if (!personsObject[treatment.person]) continue;
    personsObject[treatment.person].treatments = personsObject[treatment.person].treatments || [];
    personsObject[treatment.person].treatments.push(treatment);
  }
  for (const medicalFile of medicalFiles) {
    if (!personsObject[medicalFile.person]) continue;
    if (personsObject[medicalFile.person].medicalFile) {
      const nextDocuments = {};
      const nextComments = {};
      const existingMedicalFile = personsObject[medicalFile.person].medicalFile;
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
    if (!personsObject[passage.person]) continue;
    personsObject[passage.person].passages = personsObject[passage.person].passages || [];
    personsObject[passage.person].passages.push(passage);
  }
  for (const rencontre of rencontres) {
    if (!personsObject[rencontre.person]) continue;
    personsObject[rencontre.person].rencontres = personsObject[rencontre.person].rencontres || [];
    personsObject[rencontre.person].rencontres.push(rencontre);
  }
  return personsObject;
});

export const arrayOfitemsGroupedByPersonSelector = atom((get) => {
  const itemsGroupedByPerson = get(itemsGroupedByPersonSelector);
  return Object.values(itemsGroupedByPerson).sort((a, b) => (a.nameNormalized > b.nameNormalized ? 1 : -1));
});

export const usePersonsSearchSelector = (search) => {
  const persons = useAtomValue(arrayOfitemsGroupedByPersonSelector);
  if (!search?.length) return persons;
  const filteredPersons = filterBySearch(search, persons);
  return filteredPersons;
};

export const actionsForCurrentTeamSelector = atom((get) => {
  const actions = get(actionsState);
  const currentTeam = get(currentTeamState);
  const filteredActions = actions.filter((a) => (Array.isArray(a.teams) ? a.teams.includes(currentTeam?._id) : a.team === currentTeam?._id));
  return filteredActions;
});

export const PASSED = "PASSED";
export const TODAY = "TODAY";
export const INCOMINGDAYS = "INCOMINGDAYS";

/*

Actions and consultations

*/

const sortDoneOrCancel = (a, b) => {
  if (!a.completedAt) return -1;
  if (!b.completedAt) return 1;
  if (a.completedAt > b.completedAt) return -1;
  return 1;
};

const sortTodo = (a, b) => {
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  if (a.dueAt > b.dueAt) return 1;
  return -1;
};
/*

Actions and Consultations

*/

export const consultationsForCurrentTeamSelector = atom((get) => {
  const consultations = get(consultationsState);
  const currentTeam = get(currentTeamState);
  const filteredConsultations = [];
  for (const consultation of consultations) {
    if (!consultation.teams?.length || consultation.teams.includes(currentTeam._id)) {
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

const useActionsDoneSelectorSliced = (limit) => {
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

const useActionsCanceledSelectorSliced = (limit) => {
  const actionsCanceled = useAtomValue(actionsCanceledSelector);
  if (!limit) return actionsCanceled;
  return actionsCanceled.filter((_, index) => index < limit);
};

const filterByTimeframe = (actions, timeframe) => {
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

const filterByCategories = (actions, categories) => {
  if (!categories?.length) return actions;
  return actions.filter((action) => action.categories?.some((category) => categories.includes(category)));
};

export const useActionsByStatusAndTimeframeSelector = (status, limit, timeframe, filters) => {
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

export const useTotalActionsByStatusSelector = (status, timeframe, filters) => {
  const actions = useActionsByStatusAndTimeframeSelector(status, null, timeframe, filters);
  return actions.length;
};
