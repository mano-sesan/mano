import type { PersonPopulated } from "../types/person";
import type { UUIDV4 } from "../types/uuid";
import type { PeriodISODate } from "../types/date";

export function filterPersonByAssignedTeam(
  viewAllOrganisationData: boolean,
  selectedTeamsObjectWithOwnPeriod: Record<UUIDV4, PeriodISODate>,
  assignedTeams: PersonPopulated["assignedTeams"],
  forTeamFiltering: PersonPopulated["forTeamFiltering"],
  debug = false
) {
  if (viewAllOrganisationData) return true;
  if (!assignedTeams?.length) return true; // no assignedTeam is currently forbidden, but hasn't always been the case

  // when is the person included ?
  // 4 cases:
  // 1. assigned team period is accross the start date of the selected period
  // 2. assigned team period is accross the end date of the selected period
  // 3. assigned team period is included in the selected period
  // 4. selected period is included in the assigned team period

  // when is the person not included ?
  // 1. assigned team period is before the start date of the selected period
  // 2. assigned team period is after the end date of the selected period
  // 3. no assigned team period is found in the selected period

  for (const [teamId, { isoEndDate, isoStartDate }] of Object.entries(selectedTeamsObjectWithOwnPeriod)) {
    // GOOD TO KNOW: forTeamFiltering is sorted by date from the oldest to the newest
    let mightBeIncluded = false;
    for (const teamChange of forTeamFiltering) {
      // if one of the date is included in the period, we can return true
      if (!teamChange.assignedTeams.includes(teamId)) {
        if (teamChange.date >= isoStartDate) {
          if (mightBeIncluded) {
            // it means the assigned team was accross the start date of the period
            return true;
          }
        }
        mightBeIncluded = false;
        continue;
      }
      if (teamChange.date <= isoStartDate) {
        mightBeIncluded = true;
        // will be included if no other teamChange is found in the period
      }
      if (teamChange.date >= isoStartDate && teamChange.date <= isoEndDate) {
        return true;
      }
    }
    if (mightBeIncluded) {
      return true;
    }
  }
  return false;
}
