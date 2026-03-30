import { atom } from "jotai";
import { currentTeamState, userState, usersState } from "./auth";
import { personsState } from "./persons";
import { placesState } from "./places";
import { relsPersonPlaceState } from "./relPersonPlace";
import { reportsState } from "./reports";
import { ageFromBirthdateAsYear, ageFromBirthdateAsMonths, dayjsInstance, formatBirthDate } from "../services/date";
import { customFieldsObsSelector, territoryObservationsState } from "./territoryObservations";
import { actionsState } from "./actions";
import { consultationsState, excludeConsultationsFieldsFromSearch } from "./consultations";
import { commentsState } from "./comments";
import { passagesState } from "./passages";
import { medicalFileState } from "./medicalFiles";
import { treatmentsState } from "./treatments";
import { rencontresState } from "./rencontres";
import { groupsState } from "./groups";
import { territoriesState } from "./territory";
import { extractInfosFromHistory } from "../utils/person-history";

// Shared frozen empty array to avoid creating new [] on every fallback
const EMPTY_ARRAY = Object.freeze([]);

export const usersObjectSelector = atom((get) => {
  const users = get(usersState);
  const usersObject = {};
  for (const user of users) {
    usersObject[user._id] = { ...user };
  }
  return usersObject;
});

export const currentTeamReportsSelector = atom((get) => {
  const reports = get(reportsState);
  const currentTeam = get(currentTeamState);
  return reports.filter((a) => a.team === currentTeam?._id);
});

// Maps each actionId to its array of enriched comments.
// Replaces actionsWithCommentsSelector: avoids spreading every action (O(actions)) just to attach comments.
// Only comments linked to an action are processed (typically much fewer than total actions).
const commentsByActionSelector = atom((get) => {
  const comments = get(commentsState);
  const map = new Map();
  for (const comment of comments) {
    if (!comment.action) continue;
    let arr = map.get(comment.action);
    if (!arr) {
      arr = [];
      map.set(comment.action, arr);
    }
    arr.push({ ...comment, date: comment.date || comment.createdAt });
  }
  return map;
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

export const personsObjectSelector = atom((get) => {
  const persons = get(personsState);
  const personsObject = {};
  for (const person of persons) {
    personsObject[person._id] = { ...person };
  }
  return personsObject;
});

// Extracted: only recomputes when groupsState changes (rare).
// Previously computed inline inside itemsGroupedByPersonSelector on every recalculation.
const groupMembershipSelector = atom((get) => {
  const groups = get(groupsState);
  const map = new Map();
  for (const group of groups) {
    if (!group.persons?.length) continue;
    for (const personId of group.persons) {
      map.set(personId, group);
    }
  }
  return map;
});

// Extracted: only recomputes when medicalFileState changes.
// Previously sorted inline ([...arr].sort()) on every recalculation of itemsGroupedByPersonSelector.
const sortedMedicalFilesSelector = atom((get) => {
  return [...get(medicalFileState)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

export const itemsGroupedByPersonSelector = atom((get) => {
  const now = dayjsInstance();
  const endOfToday = now.endOf("day").toISOString();
  const persons = get(personsState);
  const personsObject = {};
  const user = get(userState);
  const usersObject = get(usersObjectSelector);

  // Interactions tracked as Sets: avoids accumulating nulls/duplicates,
  // eliminates the sort+Set+filter pass at the end.
  const interactionsSets = new Map();

  for (const person of persons) {
    const { interactions, assignedTeamsPeriods } = extractInfosFromHistory(person);

    const iSet = new Set();
    for (let i = 0; i < interactions.length; i++) {
      if (interactions[i]) iSet.add(interactions[i]);
    }
    interactionsSets.set(person._id, iSet);

    personsObject[person._id] = {
      ...person,
      // `followedSince` is already in `...person` — no need to re-set it
      followSinceMonths: now.diff(person.followedSince, "months"),
      userPopulated: usersObject[person.user],
      formattedBirthDate: formatBirthDate(person.birthdate),
      age: ageFromBirthdateAsYear(person.birthdate),
      ageInMonths: ageFromBirthdateAsMonths(person.birthdate),
      formattedPhoneNumber: person.phone?.replace(/\D/g, ""),
      assignedTeamsPeriods,
      lastUpdateCheckForGDPR: person.followedSince,
      numberOfActions: 0,
      numberOfConsultations: 0,
      numberOfTreatments: 0,
      numberOfPassages: 0,
      numberOfRencontres: 0,
      hasAtLeastOneConsultation: false,
      // BUG FIX: we used to set an `outOfActiveListDate` even if `outOfActiveList` was false.
      // https://github.com/SocialGouv/mano/blob/34a86a3e6900b852e0b3fe828a03e6721d200973/dashboard/src/scenes/person/OutOfActiveList.js#L22
      // This was causing a bug in the "person suivies" stats, where people who were not out of active list were counted as out of active list.
      outOfActiveListDate: person.outOfActiveList ? person.outOfActiveListDate : null,
    };
  }

  const actions = get(actionsState);
  const commentsByAction = get(commentsByActionSelector);
  const comments = get(commentsState);

  const consultations = get(consultationsState);
  const treatments = get(treatmentsState);
  const medicalFiles = get(sortedMedicalFilesSelector);
  const passages = get(passagesState);
  const relsPersonPlace = get(relsPersonPlaceState);
  const places = get(placesObjectSelector);
  const rencontres = get(rencontresState);
  const groupMembership = get(groupMembershipSelector);
  const observations = get(territoryObservationsState);
  const territories = get(territoriesState);

  // Attach groups from extracted selector
  for (const [personId, group] of groupMembership) {
    if (personsObject[personId]) {
      personsObject[personId].group = group;
    }
  }

  for (const person of persons) {
    if (!person.documents?.length) continue;
    const personObj = personsObject[person._id];
    const documentsForModule = [];
    const uniqueDocIds = {}; // to avoid duplicates
    const iSet = interactionsSets.get(person._id);
    for (const document of person.documents) {
      if (!document) continue;
      if (uniqueDocIds[document._id]) continue;
      uniqueDocIds[document._id] = true;
      const documentForModule = {
        ...document,
        type: document.type ?? "document", // or 'folder'
        linkedItem: {
          _id: person._id,
          type: "person",
        },
      };
      documentsForModule.push(documentForModule);
      if (document.createdAt) iSet.add(document.createdAt);
      if (!document.group) continue;
      if (!personObj.group) continue;
      for (const personIdInGroup of personObj.group.persons) {
        if (personIdInGroup === person._id) continue;
        if (!personsObject[personIdInGroup]) continue;
        if (!personsObject[personIdInGroup].groupDocuments) {
          personsObject[personIdInGroup].groupDocuments = [];
        }
        personsObject[personIdInGroup].groupDocuments.push(documentForModule);
      }
    }
    personObj.documentsForModule = documentsForModule;
  }

  // Maps for efficient comment dispatch: actionId → personId, actionId → action
  const personPerAction = new Map();
  const actionsById = new Map();
  // to help adding action categories to persons efficiently
  const personActionCategoriesObject = {};

  for (const action of actions) {
    const personObj = personsObject[action.person];
    if (!personObj) continue;
    personPerAction.set(action._id, action.person);
    actionsById.set(action._id, action);
    const actionWithComments = { ...action, comments: commentsByAction.get(action._id) ?? EMPTY_ARRAY };
    if (!personObj.actions) personObj.actions = [];
    personObj.actions.push(actionWithComments);
    personObj.numberOfActions++;
    const iSet = interactionsSets.get(action.person);
    if (action.dueAt) iSet.add(action.dueAt);
    if (action.createdAt) iSet.add(action.createdAt);
    if (action.completedAt) iSet.add(action.completedAt);
    if (action.categories?.length) {
      if (!personActionCategoriesObject[action.person]) personActionCategoriesObject[action.person] = {};
      if (!personObj.actionCategories) personObj.actionCategories = [];
      for (const category of action.categories) {
        if (!personActionCategoriesObject[action.person][category]) {
          personActionCategoriesObject[action.person][category] = true;
          personObj.actionCategories.push(category);
        }
      }
    }
    if (action.group) {
      const group = personObj.group;
      if (!group) continue;
      for (const person of group.persons) {
        if (!personsObject[person]) continue;
        if (person === action.person) continue;
        if (!personsObject[person].actions) personsObject[person].actions = [];
        personsObject[person].actions.push(actionWithComments);
      }
    }
    if (action.documents) {
      for (const document of action.documents) {
        if (!document) continue;
        if (!personObj.documentsForModule) personObj.documentsForModule = [];
        personObj.documentsForModule.push({
          ...document,
          type: "document",
          linkedItem: {
            _id: action._id,
            type: "action",
          },
          parentId: document.parentId ?? "actions",
        });
        // Cas très particulier des documents liés à des actions de groupe
        // (on doit retrouver les documents dans toutes les fiches des personnes)
        // Ça fait beaucoup de complexité pour ce cas particulier.
        if (action.group) {
          const group = personObj.group;
          if (!group) continue;
          for (const person of group.persons) {
            if (!personsObject[person]) continue;
            if (person === action.person) continue;
            if (!personsObject[person].documentsForModule) personsObject[person].documentsForModule = [];
            personsObject[person].documentsForModule.push({
              ...document,
              type: "document",
              linkedItem: {
                _id: action._id,
                type: "action",
              },
              parentId: document.parentId ?? "actions",
            });
          }
        }
      }
    }
  }

  for (const comment of comments) {
    if (comment.action) {
      const personId = personPerAction.get(comment.action);
      if (!personId) continue;
      const personObj = personsObject[personId];
      if (!personObj) continue;
      if (!personObj.comments) personObj.comments = [];
      personObj.comments.push({ ...comment, type: "action", date: comment.date || comment.createdAt });
      // Dans le cas où l'action est liée à un groupe, on doit ajouter les commentaires aux personnes du groupe.
      const action = actionsById.get(comment.action);
      if (action?.group) {
        const actionPersonGroup = personsObject[action.person]?.group;
        if (actionPersonGroup) {
          for (const personOfGroup of actionPersonGroup.persons) {
            if (!personsObject[personOfGroup]) continue;
            if (personOfGroup === personId) continue;
            if (!personsObject[personOfGroup].comments) personsObject[personOfGroup].comments = [];
            personsObject[personOfGroup].comments.push({ ...comment, type: "action", date: comment.date || comment.createdAt });
          }
        }
      }
      continue;
    }
    const personObj = personsObject[comment.person];
    if (!personObj) continue;
    if (!personObj.comments) personObj.comments = [];
    personObj.comments.push({ ...comment, type: "person", date: comment.date || comment.createdAt });
    const commentDate = comment.date || comment.createdAt;
    const commentISet = interactionsSets.get(comment.person);
    if (commentDate && commentISet) commentISet.add(commentDate);
    if (comment.group) {
      const group = personObj.group;
      if (!group) continue;
      for (const person of group.persons) {
        if (!personsObject[person]) continue;
        if (person === comment.person) continue;
        if (!personsObject[person].comments) personsObject[person].comments = [];
        personsObject[person].comments.push({ ...comment, type: "person", date: comment.date || comment.createdAt });
      }
    }
  }
  for (const relPersonPlace of relsPersonPlace) {
    const personObj = personsObject[relPersonPlace.person];
    if (!personObj) continue;
    const place = places[relPersonPlace.place];
    if (!place) continue;
    if (!personObj.places) personObj.places = [];
    personObj.places.push(place.name);
    if (!personObj.relsPersonPlace) personObj.relsPersonPlace = [];
    personObj.relsPersonPlace.push(relPersonPlace);
    const relISet = interactionsSets.get(relPersonPlace.person);
    if (relPersonPlace.createdAt && relISet) relISet.add(relPersonPlace.createdAt);
  }
  for (const consultation of consultations) {
    const personObj = personsObject[consultation.person];
    if (!personObj) continue;

    if (!personObj.consultations) personObj.consultations = [];
    if (!personObj.flattenedConsultations) personObj.flattenedConsultations = {};
    const flatConsults = personObj.flattenedConsultations;
    for (const key of Object.keys(consultation)) {
      if (excludeConsultationsFieldsFromSearch.has(key)) continue;
      if (!flatConsults[key]) {
        flatConsults[key] = [];
      }
      if (Array.isArray(consultation[key])) {
        // push spread instead of concat: mutates in place, avoids creating intermediate array
        flatConsults[key].push(...consultation[key]);
      } else {
        flatConsults[key].push(consultation[key]);
      }
    }
    personObj.consultations.push(consultation);
    personObj.hasAtLeastOneConsultation = true;
    personObj.numberOfConsultations++;
    const iSet = interactionsSets.get(consultation.person);
    if (consultation.dueAt) iSet.add(consultation.dueAt);
    if (consultation.createdAt) iSet.add(consultation.createdAt);
    if (consultation.completedAt) iSet.add(consultation.completedAt);
    const consultationIsVisibleByMe = consultation.onlyVisibleBy.length === 0 || consultation.onlyVisibleBy.includes(user._id);
    for (const comment of consultation.comments || EMPTY_ARRAY) {
      if (comment.date) iSet.add(comment.date);
      if (!consultationIsVisibleByMe) continue;
      if (!personObj.commentsMedical) personObj.commentsMedical = [];
      personObj.commentsMedical.push({
        ...comment,
        consultation,
        person: consultation.person,
        type: "consultation",
      });
    }
  }
  for (const treatment of treatments) {
    const personObj = personsObject[treatment.person];
    if (!personObj) continue;
    if (!personObj.treatments) personObj.treatments = [];
    personObj.treatments.push(treatment);
    personObj.numberOfTreatments++;
    const iSet = interactionsSets.get(treatment.person);
    if (treatment.createdAt) iSet.add(treatment.createdAt);
    for (const comment of treatment.comments || EMPTY_ARRAY) {
      if (comment.date) iSet.add(comment.date);
      if (!personObj.commentsMedical) personObj.commentsMedical = [];
      personObj.commentsMedical.push({
        ...comment,
        treatment,
        person: treatment.person,
        type: "treatment",
      });
    }
  }
  for (const medicalFile of medicalFiles) {
    const personObj = personsObject[medicalFile.person];
    if (!personObj) continue;
    if (personObj.medicalFile) {
      const nextDocuments = {};
      const nextComments = {};
      const existingMedicalFile = personObj.medicalFile;
      for (const document of medicalFile.documents || EMPTY_ARRAY) {
        nextDocuments[document._id] = document;
      }
      for (const document of existingMedicalFile.documents || EMPTY_ARRAY) {
        nextDocuments[document._id] = document;
      }
      for (const comment of medicalFile.comments || EMPTY_ARRAY) {
        nextComments[comment._id] = comment;
      }
      for (const comment of existingMedicalFile.comments || EMPTY_ARRAY) {
        nextComments[comment._id] = comment;
      }
      personObj.medicalFile = {
        ...medicalFile,
        ...personObj.medicalFile,
        documents: Object.values(nextDocuments),
        comments: Object.values(nextComments),
      };
    } else {
      personObj.medicalFile = medicalFile;
    }
    const iSet = interactionsSets.get(medicalFile.person);
    if (medicalFile.createdAt) iSet.add(medicalFile.createdAt);
    for (const comment of medicalFile.comments || EMPTY_ARRAY) {
      if (comment.date) iSet.add(comment.date);
      if (!personObj.commentsMedical) personObj.commentsMedical = [];
      personObj.commentsMedical.push({
        ...comment,
        person: medicalFile.person,
        type: "medical-file",
      });
    }
  }
  for (const passage of passages) {
    const personObj = personsObject[passage.person];
    if (!personObj) continue;
    if (!personObj.passages) personObj.passages = [];
    personObj.passages.push({
      ...passage,
      type: "Non-anonyme",
      gender: personObj.gender || "Non renseigné",
    });
    personObj.numberOfPassages++;
    const passageDate = passage.date || passage.createdAt;
    const passageISet = interactionsSets.get(passage.person);
    if (passageDate && passageISet) passageISet.add(passageDate);
    if (passage.comment) {
      if (!personObj.comments) personObj.comments = [];
      personObj.comments.push({
        comment: passage.comment,
        type: "passage",
        team: passage.team,
        person: passage.person,
        passage: passage._id,
        date: passage.date,
        user: passage.user,
        _id: passage.date + passage._id,
      });
    }
  }

  // Single-pass rencontre processing with pre-built observation→territory lookup.
  // Replaces the original 3-pass approach (count+build lookup, build obs/territory maps, attach to persons).
  // Pre-build lookup maps for observations and territories (iterates all, but these are typically small collections).
  const observationTerritoryMap = new Map();
  for (const observation of observations) {
    observationTerritoryMap.set(observation._id, { territory: observation.territory });
  }
  const territoryNameMap = new Map();
  for (const territory of territories) {
    territoryNameMap.set(territory._id, { name: territory.name });
  }

  for (const rencontre of rencontres) {
    const personObj = personsObject[rencontre.person];
    if (!personObj) continue;
    personObj.numberOfRencontres++;
    if (!personObj.rencontres) personObj.rencontres = [];
    if (rencontre.observation) {
      const observationObject = observationTerritoryMap.get(rencontre.observation);
      if (!observationObject) {
        // concurrence entre la création de la rencontre et de l'observation -> l'obs n'est pas encore disponible
        personObj.rencontres.push(rencontre);
      } else {
        const territoryObject = territoryNameMap.get(observationObject.territory);
        personObj.rencontres.push({
          ...rencontre,
          observationObject,
          territoryObject,
        });
      }
    } else {
      personObj.rencontres.push(rencontre);
    }

    const rencontreDate = rencontre.date || rencontre.createdAt;
    const rencontreISet = interactionsSets.get(rencontre.person);
    if (rencontreDate && rencontreISet) rencontreISet.add(rencontreDate);
    if (rencontre.comment) {
      if (!personObj.comments) personObj.comments = [];
      personObj.comments.push({
        comment: rencontre.comment,
        type: "rencontre",
        rencontre: rencontre._id,
        person: rencontre.person,
        team: rencontre.team,
        user: rencontre.user,
        date: rencontre.date,
        _id: rencontre.date + rencontre._id,
      });
    }
  }

  // Finalize interactions: convert Sets to sorted arrays.
  // Sets already exclude nulls/undefined (checked before .add()) and duplicates.
  // Only a single sort is needed — no dedup pass, no filter pass.
  for (const personId of Object.keys(personsObject)) {
    const iSet = interactionsSets.get(personId);
    const sorted = Array.from(iSet).sort((a, b) => {
      // sort by date descending: the latest date at 0
      if (a > b) return -1;
      if (a < b) return 1;
      return 0;
    });
    personsObject[personId].interactions = sorted;
    // .find() instead of .filter()[0]: stops at first match (array is sorted descending)
    personsObject[personId].lastUpdateCheckForGDPR = sorted.find((a) => a < endOfToday);
  }

  return personsObject;
});

export const arrayOfitemsGroupedByPersonSelector = atom((get) => {
  const itemsGroupedByPerson = get(itemsGroupedByPersonSelector);
  return Object.values(itemsGroupedByPerson);
});

export const personsWithMedicalFileAndConsultationsMergedSelector = atom((get) => {
  const user = get(userState);
  const persons = get(arrayOfitemsGroupedByPersonSelector);
  if (!user.healthcareProfessional) return persons;
  return persons.map((person) => {
    return {
      ...(person.medicalFile || {}),
      ...(person.flattenedConsultations || {}),
      ...person,
    };
  });
});

const personsWithPlacesSelector = atom((get) => {
  const persons = get(personsState);
  const personsObject = {};
  for (const person of persons) {
    personsObject[person._id] = { ...person };
  }
  const relsPersonPlace = get(relsPersonPlaceState);
  const places = get(placesObjectSelector);

  for (const relPersonPlace of relsPersonPlace) {
    if (!personsObject[relPersonPlace.person]) continue;
    const place = places[relPersonPlace.place];
    if (!place) continue;
    personsObject[relPersonPlace.person].places = personsObject[relPersonPlace.person].places || {};
    personsObject[relPersonPlace.person].places[place._id] = place.name;
  }
  return personsObject;
});

// Refactored: uses commentsByActionSelector + actionsState directly.
// Old version used actionsWithCommentsSelector which spread every action to attach comments,
// then this selector spread them again to add personPopulated/userPopulated = double spread.
// New version: single spread per action, comments looked up from Map.
export const itemsGroupedByActionSelector = atom((get) => {
  const actions = get(actionsState);
  const commentsByAction = get(commentsByActionSelector);
  const personsWithPlacesObject = get(personsWithPlacesSelector);
  const usersObject = get(usersObjectSelector);

  const actionsObject = {};
  for (const action of actions) {
    actionsObject[action._id] = {
      ...action,
      comments: commentsByAction.get(action._id) ?? [],
      personPopulated: personsWithPlacesObject[action.person],
      userPopulated: action.user ? usersObject[action.user] : null,
    };
  }
  return actionsObject;
});

export const arrayOfitemsGroupedByActionSelector = atom((get) => {
  const itemsGroupedByAction = get(itemsGroupedByActionSelector);
  const itemsGroupedByActionArray = Object.values(itemsGroupedByAction);
  return itemsGroupedByActionArray;
});

export const itemsGroupedByConsultationSelector = atom((get) => {
  const consultations = get(consultationsState);
  const personsWithPlacesObject = get(personsWithPlacesSelector);
  const usersObject = get(usersObjectSelector);

  const consultationObject = {};
  for (const consultation of consultations) {
    consultationObject[consultation._id] = {
      ...consultation,
      personPopulated: personsWithPlacesObject[consultation.person],
      userPopulated: consultation.user ? usersObject[consultation.user] : null,
    };
  }
  return consultationObject;
});

export const arrayOfitemsGroupedByConsultationSelector = atom((get) => {
  const itemsGroupedByConsultation = get(itemsGroupedByConsultationSelector);
  const itemsGroupedByConsultationArray = Object.values(itemsGroupedByConsultation);
  return itemsGroupedByConsultationArray;
});

export const itemsGroupedByTreatmentSelector = atom((get) => {
  const treatments = get(treatmentsState);
  const personsWithPlacesObject = get(personsWithPlacesSelector);
  const usersObject = get(usersObjectSelector);

  const treatmentsObject = {};
  for (const treatment of treatments) {
    treatmentsObject[treatment._id] = {
      ...treatment,
      personPopulated: personsWithPlacesObject[treatment.person],
      userPopulated: treatment.user ? usersObject[treatment.user] : null,
    };
  }
  return treatmentsObject;
});

export const onlyFilledObservationsTerritories = atom((get) => {
  const customFieldsObs = get(customFieldsObsSelector);
  const territoryObservations = get(territoryObservationsState);

  const observationsKeyLabels = {};
  for (const field of customFieldsObs) {
    observationsKeyLabels[field.name] = field.label;
  }

  return territoryObservations.map((obs) => {
    const obsWithOnlyFilledFields = {};
    for (let key of Object.keys(obs)) {
      if (observationsKeyLabels[key]) {
        if (obs[key] != null) obsWithOnlyFilledFields[key] = obs[key];
      } else {
        obsWithOnlyFilledFields[key] = obs[key];
      }
    }
    const nextObs = { _id: obs._id, territory: obs.territory, ...obsWithOnlyFilledFields };
    return nextObs;
  });
});

// Optimization: depends on personsObjectSelector (lightweight) instead of itemsGroupedByPersonSelector (heavy).
// Only needs person existence check + gender — no need to trigger the full person enrichment.
// This breaks the cascading dependency: changes to actions/comments/consultations/etc.
// no longer trigger recomputation of populatedPassagesSelector.
export const populatedPassagesSelector = atom((get) => {
  const passages = get(passagesState);
  const allPersonsAsObject = get(personsObjectSelector);
  return passages
    .map((passage) => {
      if (!!passage.person && !allPersonsAsObject[passage.person]) return null;
      return {
        ...passage,
        type: passage.person ? "Non-anonyme" : "Anonyme",
        gender: !passage.person ? null : allPersonsAsObject[passage.person].gender || "Non renseigné",
      };
    })
    .filter(Boolean);
});
