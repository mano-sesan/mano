import dayjs from "dayjs";
import { filterItem } from "../../components/Filters";
import {
  filterPersonByAssignedTeamDuringQueryPeriod,
  mergedPersonAssignedTeamPeriodsWithQueryPeriod,
} from "../../utils/person-merge-assigned-team-periods-with-query-period";

/**
 * Extracts "active list" periods from a person's history.
 * Returns an array of { start, end } ISO date strings where the person was in active list.
 * "start" is either followedSince or the date they re-entered active list.
 * "end" is the outOfActiveListDate when they left, or null if still active.
 */
export function getActiveListPeriods(person) {
  const history = person.history || [];
  const followedSince = person.followedSince;

  // Filter history entries that have outOfActiveList changes
  const outOfActiveListEntries = history.filter((hist) => !!hist.data.outOfActiveListDate && !!hist.data.outOfActiveList);

  if (!outOfActiveListEntries.length) {
    // Never left active list: single period from followedSince to now (represented as null end)
    if (person.outOfActiveList) {
      // Currently out but no history entries => can't determine periods, treat as empty
      return [];
    }
    return [{ start: followedSince, end: null }];
  }

  const periods = [];
  let currentStart = followedSince;

  for (const historyEntry of outOfActiveListEntries) {
    if (historyEntry.data.outOfActiveList.newValue === true) {
      // Person left active list
      const outDate = historyEntry.data.outOfActiveListDate.newValue;
      if (!outDate) continue;
      const formattedDate = typeof outDate === "number" ? new Date(outDate).toISOString() : typeof outDate === "string" ? outDate : dayjs(outDate).toISOString();
      if (currentStart) {
        periods.push({ start: currentStart, end: formattedDate });
      }
      currentStart = null;
    } else {
      // Person re-entered active list
      currentStart = historyEntry.date;
    }
  }

  // If currently in active list and we have a start, add open-ended period
  if (!person.outOfActiveList && currentStart) {
    periods.push({ start: currentStart, end: null });
  }

  return periods;
}

/**
 * Checks if a date falls within any of the intersected periods
 * (active list periods intersected with team assignment periods).
 */
export function isInteractionDuringActivePeriod(interactionDate, activeListPeriods, teamPeriods) {
  if (!interactionDate || !activeListPeriods?.length || !teamPeriods?.length) return false;
  for (const activePeriod of activeListPeriods) {
    const activeStart = activePeriod.start;
    const activeEnd = activePeriod.end; // null means ongoing

    for (const teamPeriod of teamPeriods) {
      const teamStart = teamPeriod.isoStartDate;
      const teamEnd = teamPeriod.isoEndDate;

      // Compute intersection
      const intersectStart = activeStart > teamStart ? activeStart : teamStart;
      const intersectEnd = activeEnd === null ? teamEnd : activeEnd < teamEnd ? activeEnd : teamEnd;

      if (intersectStart >= intersectEnd) continue;

      // Check if interaction falls within intersection
      if (interactionDate >= intersectStart && interactionDate < intersectEnd) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Main computation function for the new stats page.
 * Similar to itemsForStatsSelector but with personFilterMode support.
 */
export function computeStatsData({
  period,
  filterPersons,
  selectedTeamsObjectWithOwnPeriod,
  viewAllOrganisationData,
  allPersons,
  teams,
  territories,
  personFilterMode,
}) {
  // DEBUG — à supprimer après résolution du bug
  console.log("[computeStatsData] inputs", {
    allPersonsLength: allPersons?.length,
    filterPersonsLength: filterPersons?.length,
    selectedTeamsKeys: Object.keys(selectedTeamsObjectWithOwnPeriod || {}),
    viewAllOrganisationData,
    personFilterMode,
    noPeriodSelected: !period.startDate || !period.endDate,
    period,
  });
  const relativeFilters = [
    "startFollowBySelectedTeamDuringPeriod",
    "hasAtLeastOneConsultation",
    "numberOfConsultations",
    "numberOfActions",
    "numberOfTreatments",
    "numberOfPassages",
    "numberOfRencontres",
  ];

  const activeFilters = filterPersons.filter(
    (f) => f.value && !relativeFilters.includes(f.field) && f.field !== "outOfActiveList" && f.field !== "outOfTeamsDuringPeriod" && f.field !== "territories"
  );
  const outOfActiveListFilter = filterPersons.find((f) => f.field === "outOfActiveList")?.value;
  const filterByStartFollowBySelectedTeamDuringPeriod = filterPersons.filter((f) => f.field === "startFollowBySelectedTeamDuringPeriod");
  const filterByNumberOfActions = filterPersons.filter((f) => f.field === "numberOfActions");
  const filterByNumberOfConsultations = filterPersons.filter((f) => f.field === "numberOfConsultations");
  const filterHasAtLeastOneConsultation = filterPersons.filter((f) => f.field === "hasAtLeastOneConsultation");
  const filterByNumberOfPassages = filterPersons.filter((f) => f.field === "numberOfPassages");
  const filterByNumberOfRencontres = filterPersons.filter((f) => f.field === "numberOfRencontres");
  const filterByNumberOfTreatments = filterPersons.filter((f) => f.field === "numberOfTreatments");
  const filterByOutOfTeamsDuringPeriod = filterPersons.find((f) => f.field === "outOfTeamsDuringPeriod");
  const filterByTerritories = filterPersons.find((f) => f.field === "territories");

  const filterItemByTeam = (item, key) => {
    if (viewAllOrganisationData) return true;
    if (Array.isArray(item[key])) {
      for (const team of item[key]) {
        if (selectedTeamsObjectWithOwnPeriod[team]) return true;
      }
    }
    return !!selectedTeamsObjectWithOwnPeriod[item[key]];
  };

  const personsCreated = {};
  const personsUpdated = {};
  const personsFollowed = {};
  const personsUpdatedWithActions = {};
  const actionsFilteredByPersons = {};
  const consultationsFilteredByPersons = [];
  const personsWithConsultations = {};
  const passagesFilteredByPersons = [];
  const personsWithPassages = {};
  const personsInPassagesBeforePeriod = {};
  const rencontresFilteredByPersons = [];
  const personsInRencontresBeforePeriod = {};
  const noPeriodSelected = !period.startDate || !period.endDate;
  const defaultIsoDates = {
    isoStartDate: period.startDate ? dayjs(period.startDate).startOf("day").toISOString() : null,
    isoEndDate: period.endDate ? dayjs(period.endDate).startOf("day").add(1, "day").toISOString() : null,
  };

  const outOfTeamsDuringPeriodTeamIds = filterByOutOfTeamsDuringPeriod?.value?.length
    ? new Set(teams.filter((t) => filterByOutOfTeamsDuringPeriod.value.includes(t.name)).map((t) => t._id))
    : null;

  const filterByTerritoriesIds = filterByTerritories?.value?.length
    ? new Set(territories.filter((t) => filterByTerritories.value.includes(t.name)).map((t) => t._id))
    : null;

  // DEBUG counters
  let _dbgTotal = 0, _dbgPassedFilters = 0, _dbgPassedTeam = 0;

  for (let person of allPersons) {
    _dbgTotal++;
    if (!filterItem(activeFilters)(person)) continue;
    if (outOfActiveListFilter === "Oui" && !person.outOfActiveList) continue;

    if (outOfTeamsDuringPeriodTeamIds) {
      let wasOutOfSelectedTeam = false;
      for (const historyEntry of person.history || []) {
        const historyDate = historyEntry.date;
        if (!noPeriodSelected) {
          if (historyDate < defaultIsoDates.isoStartDate) continue;
          if (historyDate >= defaultIsoDates.isoEndDate) continue;
        }
        const outOfTeamsInformations = historyEntry.data?.outOfTeamsInformations;
        if (outOfTeamsInformations) {
          for (const info of outOfTeamsInformations) {
            if (outOfTeamsDuringPeriodTeamIds.has(info.team)) {
              wasOutOfSelectedTeam = true;
              break;
            }
          }
        }
        if (wasOutOfSelectedTeam) break;
      }
      if (!wasOutOfSelectedTeam) continue;
    }
    if (outOfActiveListFilter === "Non" && !!person.outOfActiveList) continue;

    if (filterByNumberOfTreatments.length) {
      let numberOfTreatments = 0;
      if (person.treatments?.length) {
        for (const treatment of person.treatments) {
          if (noPeriodSelected) {
            numberOfTreatments++;
            continue;
          }
          const date = treatment.date;
          const { isoStartDate, isoEndDate } = selectedTeamsObjectWithOwnPeriod[treatment.team] ?? defaultIsoDates;
          if (date < isoStartDate) continue;
          if (date >= isoEndDate) continue;
          numberOfTreatments++;
        }
      }
      if (!filterItem(filterByNumberOfTreatments)({ numberOfTreatments })) continue;
    }

    if (filterByTerritoriesIds) {
      const includeNoTerritory = filterByTerritories.value.includes("Non renseigné");
      let hasRencontreInTerritory = false;
      for (const rencontre of person.rencontres || []) {
        const territoryId = rencontre.observationObject?.territory;
        if (!territoryId) {
          if (!includeNoTerritory) continue;
        } else {
          if (!filterByTerritoriesIds.has(territoryId)) continue;
        }
        if (noPeriodSelected) {
          hasRencontreInTerritory = true;
          break;
        }
        const date = rencontre.date;
        const { isoStartDate, isoEndDate } = selectedTeamsObjectWithOwnPeriod[rencontre.team] ?? defaultIsoDates;
        if (date < isoStartDate) continue;
        if (date >= isoEndDate) continue;
        hasRencontreInTerritory = true;
        break;
      }
      if (!hasRencontreInTerritory) continue;
    }

    _dbgPassedFilters++;
    const createdDate = person.followedSince;

    const personIsInAssignedTeamDuringPeriod = filterPersonByAssignedTeamDuringQueryPeriod({
      viewAllOrganisationData,
      selectedTeamsObjectWithOwnPeriod,
      assignedTeamsPeriods: person.assignedTeamsPeriods,
      isoEndDate: defaultIsoDates.isoEndDate,
      isoStartDate: defaultIsoDates.isoStartDate,
      filterByStartFollowBySelectedTeamDuringPeriod:
        personFilterMode === "created" ? [{ field: "startFollowBySelectedTeamDuringPeriod", value: "Oui" }] : filterByStartFollowBySelectedTeamDuringPeriod,
    });

    if (personIsInAssignedTeamDuringPeriod) {
      _dbgPassedTeam++;
      if (noPeriodSelected) {
        // "modified" mode: all persons
        personsUpdated[person._id] = person;
        personsCreated[person._id] = person;
        personsFollowed[person._id] = person;
      } else {
        const { isoStartDate, isoEndDate } = selectedTeamsObjectWithOwnPeriod[person.assignedTeams] ?? defaultIsoDates;

        // "created" mode: persons created during period
        if (createdDate >= isoStartDate && createdDate < isoEndDate) {
          personsCreated[person._id] = person;
          personsUpdated[person._id] = person;
        }

        // "modified" mode: persons with at least one interaction during period
        for (const date of person.interactions) {
          if (date < isoStartDate) continue;
          if (date >= isoEndDate) continue;
          personsUpdated[person._id] = person;
          break;
        }

        // "followed" mode: same as modified but only interactions while in active list AND in selected teams
        if (personFilterMode === "followed") {
          const activeListPeriods = getActiveListPeriods(person);
          const teamPeriods = mergedPersonAssignedTeamPeriodsWithQueryPeriod({
            viewAllOrganisationData,
            isoStartDate: defaultIsoDates.isoStartDate,
            isoEndDate: defaultIsoDates.isoEndDate,
            selectedTeamsObjectWithOwnPeriod,
            assignedTeamsPeriods: person.assignedTeamsPeriods,
          });

          let hasValidInteraction = false;

          // Check if creation falls in an active+team period
          if (personsCreated[person._id] && createdDate >= isoStartDate && createdDate < isoEndDate) {
            if (isInteractionDuringActivePeriod(createdDate, activeListPeriods, teamPeriods)) {
              hasValidInteraction = true;
            }
          }

          // Check interactions
          if (!hasValidInteraction) {
            for (const date of person.interactions) {
              if (date < isoStartDate) continue;
              if (date >= isoEndDate) continue;
              if (isInteractionDuringActivePeriod(date, activeListPeriods, teamPeriods)) {
                hasValidInteraction = true;
                break;
              }
            }
          }

          if (hasValidInteraction) {
            personsFollowed[person._id] = person;
          }
        }
      }
    }

    // Actions
    let numberOfActions = 0;
    for (const action of person.actions || []) {
      if (!filterItemByTeam(action, "teams")) continue;
      if (noPeriodSelected) {
        actionsFilteredByPersons[action._id] = action;
        numberOfActions++;
        if (personsUpdated[person._id]) personsUpdatedWithActions[person._id] = person;
        continue;
      }
      const date = action.completedAt || action.dueAt;
      if (Array.isArray(action.teams)) {
        let isIncluded = false;
        for (const team of action.teams) {
          const { isoStartDate, isoEndDate } = selectedTeamsObjectWithOwnPeriod[team] ?? defaultIsoDates;
          if (date < isoStartDate) continue;
          if (date >= isoEndDate) continue;
          isIncluded = true;
        }
        if (!isIncluded) continue;
      } else {
        const { isoStartDate, isoEndDate } = selectedTeamsObjectWithOwnPeriod[action.team] ?? defaultIsoDates;
        if (date < isoStartDate) continue;
        if (date >= isoEndDate) continue;
      }
      numberOfActions++;
      actionsFilteredByPersons[action._id] = action;
      if (personsUpdated[person._id]) personsUpdatedWithActions[person._id] = person;
    }
    if (filterByNumberOfActions.length) {
      if (!filterItem(filterByNumberOfActions)({ numberOfActions })) {
        delete personsUpdated[person._id];
        delete personsCreated[person._id];
        delete personsFollowed[person._id];
        delete personsUpdatedWithActions[person._id];
        for (const action of person.actions || []) {
          delete actionsFilteredByPersons[action._id];
        }
        continue;
      }
    }

    // Consultations
    let numberOfConsultations = 0;
    for (const consultation of person.consultations || []) {
      if (!filterItemByTeam(consultation, "teams")) continue;
      if (noPeriodSelected) {
        consultationsFilteredByPersons.push(consultation);
        numberOfConsultations++;
        personsWithConsultations[person._id] = person;
        continue;
      }
      const date = consultation.completedAt || consultation.dueAt;
      if (Array.isArray(consultation.teams)) {
        let isIncluded = false;
        for (const team of consultation.teams) {
          const { isoStartDate, isoEndDate } = selectedTeamsObjectWithOwnPeriod[team] ?? defaultIsoDates;
          if (date < isoStartDate) continue;
          if (date >= isoEndDate) continue;
          isIncluded = true;
        }
        if (!isIncluded) continue;
      } else {
        const { isoStartDate, isoEndDate } = selectedTeamsObjectWithOwnPeriod[consultation.team] ?? defaultIsoDates;
        if (date < isoStartDate) continue;
        if (date >= isoEndDate) continue;
      }
      numberOfConsultations++;
      consultationsFilteredByPersons.push(consultation);
      personsWithConsultations[person._id] = person;
    }
    if (filterByNumberOfConsultations.length) {
      if (!filterItem(filterByNumberOfConsultations)({ numberOfConsultations })) {
        delete personsUpdated[person._id];
        delete personsCreated[person._id];
        delete personsFollowed[person._id];
        delete personsUpdatedWithActions[person._id];
        for (const action of person.actions || []) {
          delete actionsFilteredByPersons[action._id];
        }
        delete personsWithConsultations[person._id];
        for (let i = 0; i < numberOfConsultations; i++) {
          consultationsFilteredByPersons.pop();
        }
        continue;
      }
    }
    if (filterHasAtLeastOneConsultation.length) {
      if (!filterItem(filterHasAtLeastOneConsultation)({ hasAtLeastOneConsultation: numberOfConsultations > 0 })) {
        delete personsUpdated[person._id];
        delete personsCreated[person._id];
        delete personsFollowed[person._id];
        delete personsUpdatedWithActions[person._id];
        for (const action of person.actions || []) {
          delete actionsFilteredByPersons[action._id];
        }
        delete personsWithConsultations[person._id];
        for (let i = 0; i < numberOfConsultations; i++) {
          consultationsFilteredByPersons.pop();
        }
        continue;
      }
    }

    // Passages
    let numberOfPassages = 0;
    if (person.passages?.length) {
      for (const passage of person.passages) {
        if (!filterItemByTeam(passage, "team")) continue;
        if (noPeriodSelected) {
          passagesFilteredByPersons.push(passage);
          personsWithPassages[person._id] = person;
          numberOfPassages++;
          continue;
        }
        const date = passage.date;
        const { isoStartDate, isoEndDate } = selectedTeamsObjectWithOwnPeriod[passage.team] ?? defaultIsoDates;
        if (date < isoStartDate) continue;
        if (date >= isoEndDate) continue;
        numberOfPassages++;
        passagesFilteredByPersons.push(passage);
        personsWithPassages[person._id] = person;
        if (createdDate < isoStartDate) {
          personsInPassagesBeforePeriod[person._id] = person;
        }
      }
    }
    if (filterByNumberOfPassages.length) {
      if (!filterItem(filterByNumberOfPassages)({ numberOfPassages })) {
        delete personsUpdated[person._id];
        delete personsCreated[person._id];
        delete personsFollowed[person._id];
        delete personsUpdatedWithActions[person._id];
        for (const action of person.actions || []) {
          delete actionsFilteredByPersons[action._id];
        }
        delete personsWithConsultations[person._id];
        for (let i = 0; i < numberOfConsultations; i++) {
          consultationsFilteredByPersons.pop();
        }
        delete personsWithPassages[person._id];
        delete personsInPassagesBeforePeriod[person._id];
        for (let i = 0; i < numberOfPassages; i++) {
          passagesFilteredByPersons.pop();
        }
        continue;
      }
    }

    // Rencontres
    let numberOfRencontres = 0;
    if (person.rencontres?.length) {
      for (const rencontre of person.rencontres) {
        if (!filterItemByTeam(rencontre, "team")) continue;
        if (noPeriodSelected) {
          rencontresFilteredByPersons.push({ ...rencontre, gender: person.gender });
          numberOfRencontres++;
          continue;
        }
        const date = rencontre.date;
        const { isoStartDate, isoEndDate } = selectedTeamsObjectWithOwnPeriod[rencontre.team] ?? defaultIsoDates;
        if (date < isoStartDate) continue;
        if (date >= isoEndDate) continue;
        numberOfRencontres++;
        rencontresFilteredByPersons.push({ ...rencontre, gender: person.gender });
        if (createdDate < isoStartDate) personsInRencontresBeforePeriod[person._id] = person;
      }
    }
    if (filterByNumberOfRencontres.length) {
      if (!filterItem(filterByNumberOfRencontres)({ numberOfRencontres })) {
        delete personsUpdated[person._id];
        delete personsCreated[person._id];
        delete personsFollowed[person._id];
        delete personsUpdatedWithActions[person._id];
        for (const action of person.actions || []) {
          delete actionsFilteredByPersons[action._id];
        }
        delete personsWithConsultations[person._id];
        for (let i = 0; i < numberOfConsultations; i++) {
          consultationsFilteredByPersons.pop();
        }
        delete personsWithPassages[person._id];
        delete personsInPassagesBeforePeriod[person._id];
        for (let i = 0; i < numberOfPassages; i++) {
          passagesFilteredByPersons.pop();
        }
        delete personsInRencontresBeforePeriod[person._id];
        for (let i = 0; i < numberOfRencontres; i++) {
          rencontresFilteredByPersons.pop();
        }
        continue;
      }
    }
  }

  // DEBUG — à supprimer après résolution du bug
  console.log("[computeStatsData] pipeline", {
    total: _dbgTotal,
    passedFilters: _dbgPassedFilters,
    passedTeam: _dbgPassedTeam,
    personsUpdatedCount: Object.keys(personsUpdated).length,
    personsCreatedCount: Object.keys(personsCreated).length,
    personsFollowedCount: Object.keys(personsFollowed).length,
    actionsCount: Object.keys(actionsFilteredByPersons).length,
  });
  if (_dbgTotal > 0 && _dbgPassedTeam === 0 && _dbgPassedFilters > 0) {
    // Log first person for debugging team filter issue
    const firstPerson = allPersons[0];
    console.log("[computeStatsData] first person debug", {
      _id: firstPerson?._id,
      assignedTeams: firstPerson?.assignedTeams,
      assignedTeamsPeriods: firstPerson?.assignedTeamsPeriods,
      interactions: firstPerson?.interactions?.slice(0, 5),
      hasHistory: !!firstPerson?.history?.length,
    });
  }

  return {
    personsCreated: Object.values(personsCreated),
    personsUpdated: Object.values(personsUpdated),
    personsFollowed: Object.values(personsFollowed),
    personsUpdatedWithActions: Object.keys(personsUpdatedWithActions).length,
    actionsFilteredByPersons: Object.values(actionsFilteredByPersons),
    personsWithConsultations: Object.keys(personsWithConsultations).length,
    consultationsFilteredByPersons,
    personsWithPassages: Object.values(personsWithPassages),
    personsInPassagesBeforePeriod,
    passagesFilteredByPersons,
    personsInRencontresBeforePeriod,
    rencontresFilteredByPersons,
  };
}
