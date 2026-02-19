import dayjs from "dayjs";
import { filterItem } from "../../components/Filters";
import { filterPersonByAssignedTeamDuringQueryPeriod } from "../../utils/person-merge-assigned-team-periods-with-query-period";
import { extractOutOfActiveListPeriods, isDateInOutOfActiveListPeriod } from "../../utils/person-out-of-active-list-periods";
import { dayjsInstance } from "../../services/date";

/**
 * Check if a given ISO date falls within a period when the person was assigned
 * to at least one of the selected teams.
 */
function isDateInAssignedTeamPeriod(isoDate, assignedTeamsPeriods, selectedTeamsObjectWithOwnPeriod, viewAllOrganisationData) {
  if (viewAllOrganisationData) {
    const allPeriods = assignedTeamsPeriods?.all;
    if (!allPeriods?.length) return false;
    for (const period of allPeriods) {
      if (isoDate >= period.isoStartDate && (period.isoEndDate == null || isoDate < period.isoEndDate)) return true;
    }
    return false;
  }
  for (const [teamId, periods] of Object.entries(assignedTeamsPeriods || {})) {
    if (teamId === "all") continue;
    if (!selectedTeamsObjectWithOwnPeriod[teamId]) continue;
    for (const period of periods) {
      if (isoDate >= period.isoStartDate && (period.isoEndDate == null || isoDate < period.isoEndDate)) return true;
    }
  }
  return false;
}

/**
 * V2 version of itemsForStatsSelector.
 * Adds support for personType: "all" | "modified" | "followed" | "created"
 *
 * - "all" (Toutes les personnes): all persons assigned to a selected team during the period, regardless of interactions
 * - "modified" (Personnes mises à jour): same as V1 personsUpdated logic
 * - "followed" (Personnes suivies): excludes interactions during out-of-active-list or out-of-selected-teams periods
 * - "created" (Nouvelles personnes): followedSince in period OR first assignment to a selected team during period
 */
export const itemsForStatsV2Selector = ({
  period,
  filterPersons,
  selectedTeamsObjectWithOwnPeriod,
  viewAllOrganisationData,
  allPersons,
  teams,
  territories,
  personType = "all",
}) => {
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
    (f) =>
      f.value &&
      !relativeFilters.includes(f.field) &&
      f.field !== "outOfActiveList" &&
      f.field !== "outOfTeamsDuringPeriod" &&
      f.field !== "territories"
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

  const personsForStats = {};
  const personsUpdatedWithActions = {};
  // Counts for the 4 person types (used by Général tab)
  let countAll = 0;
  let countModified = 0;
  let countFollowed = 0;
  let countCreated = 0;
  let countFollowedWithActions = 0;
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

  // Pre-compute team IDs for outOfTeamsDuringPeriod filter
  const outOfTeamsDuringPeriodTeamIds = filterByOutOfTeamsDuringPeriod?.value?.length
    ? new Set(teams.filter((t) => filterByOutOfTeamsDuringPeriod.value.includes(t.name)).map((t) => t._id))
    : null;

  const filterByTerritoriesIds = filterByTerritories?.value?.length
    ? new Set(territories.filter((t) => filterByTerritories.value.includes(t.name)).map((t) => t._id))
    : null;

  for (let person of allPersons) {
    // get the persons concerned by filters
    if (!filterItem(activeFilters)(person)) continue;
    if (outOfActiveListFilter === "Oui" && !person.outOfActiveList) continue;

    // Filter by team exit during period
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

    // get persons for stats for period
    const createdDate = person.followedSince;

    const personIsInAssignedTeamDuringPeriod = filterPersonByAssignedTeamDuringQueryPeriod({
      viewAllOrganisationData,
      selectedTeamsObjectWithOwnPeriod,
      assignedTeamsPeriods: person.assignedTeamsPeriods,
      isoEndDate: defaultIsoDates.isoEndDate,
      isoStartDate: defaultIsoDates.isoStartDate,
      filterByStartFollowBySelectedTeamDuringPeriod,
    });

    let isFollowed = false;

    if (personIsInAssignedTeamDuringPeriod) {
      // Always compute all 4 person type counts (for Général tab)
      // 1. "all" — always included
      countAll++;

      // 2. "modified" — has any interaction in period
      let isModified = false;
      if (noPeriodSelected) {
        isModified = true;
      } else {
        for (const date of person.interactions) {
          if (date < defaultIsoDates.isoStartDate) continue;
          if (date >= defaultIsoDates.isoEndDate) continue;
          isModified = true;
          break;
        }
      }
      if (isModified) countModified++;

      // 3. "followed" — has valid interaction (not out-of-active-list, in assigned team)
      if (noPeriodSelected) {
        isFollowed = true;
      } else {
        const outOfActiveListPeriods = extractOutOfActiveListPeriods(person);
        for (const date of person.interactions) {
          if (date < defaultIsoDates.isoStartDate) continue;
          if (date >= defaultIsoDates.isoEndDate) continue;
          const isoDate = dayjsInstance(date).startOf("day").toISOString();
          if (isDateInOutOfActiveListPeriod(isoDate, outOfActiveListPeriods)) continue;
          if (!isDateInAssignedTeamPeriod(isoDate, person.assignedTeamsPeriods, selectedTeamsObjectWithOwnPeriod, viewAllOrganisationData))
            continue;
          isFollowed = true;
          break;
        }
      }
      if (isFollowed) countFollowed++;

      // 4. "created" — followedSince in period OR first assignment to a selected team during period
      let isCreated = false;
      if (noPeriodSelected) {
        isCreated = true;
      } else {
        if (createdDate >= defaultIsoDates.isoStartDate && createdDate < defaultIsoDates.isoEndDate) {
          isCreated = true;
        }
        if (!isCreated && person.assignedTeamsPeriods) {
          for (const [teamId, teamPeriods] of Object.entries(person.assignedTeamsPeriods)) {
            if (teamId === "all") continue;
            if (!viewAllOrganisationData && !selectedTeamsObjectWithOwnPeriod[teamId]) continue;
            if (teamPeriods.length > 0) {
              const firstPeriodStart = teamPeriods[0].isoStartDate;
              if (firstPeriodStart >= defaultIsoDates.isoStartDate && firstPeriodStart < defaultIsoDates.isoEndDate) {
                isCreated = true;
                break;
              }
            }
          }
        }
      }
      if (isCreated) countCreated++;

      // Populate personsForStats based on the selected personType
      if (
        personType === "all" ||
        (personType === "modified" && isModified) ||
        (personType === "followed" && isFollowed) ||
        (personType === "created" && isCreated)
      ) {
        personsForStats[person._id] = person;
      }
    }

    let numberOfActions = 0;
    for (const action of person.actions || []) {
      if (!filterItemByTeam(action, "teams")) continue;
      if (noPeriodSelected) {
        actionsFilteredByPersons[action._id] = action;
        numberOfActions++;
        if (personsForStats[person._id]) personsUpdatedWithActions[person._id] = person;
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
      if (personsForStats[person._id]) personsUpdatedWithActions[person._id] = person;
    }
    if (isFollowed && numberOfActions > 0) countFollowedWithActions++;
    if (filterByNumberOfActions.length) {
      if (!filterItem(filterByNumberOfActions)({ numberOfActions })) {
        delete personsForStats[person._id];
        delete personsUpdatedWithActions[person._id];
        for (const action of person.actions || []) {
          delete actionsFilteredByPersons[action._id];
        }
        continue;
      }
    }

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
        delete personsForStats[person._id];
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
        delete personsForStats[person._id];
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
        delete personsForStats[person._id];
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
        delete personsForStats[person._id];
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

  return {
    personsForStats: Object.values(personsForStats),
    personsUpdatedWithActions: Object.keys(personsUpdatedWithActions).length,
    countFollowedWithActions,
    personTypeCounts: { all: countAll, modified: countModified, followed: countFollowed, created: countCreated },
    actionsFilteredByPersons: Object.values(actionsFilteredByPersons),
    personsWithConsultations: Object.keys(personsWithConsultations).length,
    consultationsFilteredByPersons,
    personsWithPassages: Object.values(personsWithPassages),
    personsInPassagesBeforePeriod,
    passagesFilteredByPersons,
    personsInRencontresBeforePeriod,
    rencontresFilteredByPersons,
  };
};
