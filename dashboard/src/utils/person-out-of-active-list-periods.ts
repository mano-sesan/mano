import { dayjsInstance } from "../services/date";
import type { PersonInstance } from "../types/person";

/**
 * Extracts the periods during which a person was out of the active list (outOfActiveList === true).
 * Follows the same pattern as extractInfosFromHistory in person-history.ts
 * and uses the backdated outOfActiveListDate logic from person-snapshot.ts.
 */
export function extractOutOfActiveListPeriods(person: PersonInstance): Array<{ isoStartDate: string; isoEndDate: string }> {
  const periods: Array<{ isoStartDate: string; isoEndDate: string }> = [];

  if (person.outOfActiveList) {
    // Temporary: we know there's a current open period ending now
    // We'll set the start date after walking history
    periods.push({
      isoStartDate: null, // placeholder, will be filled
      isoEndDate: dayjsInstance().startOf("day").add(1, "day").toISOString(),
    });
  }

  if (person.history?.length) {
    // History is sorted oldest to newest, we walk newest to oldest (like extractInfosFromHistory)
    for (let i = person.history.length - 1; i >= 0; i--) {
      const historyEntry = person.history[i];
      const data = historyEntry.data as Record<string, unknown>;

      if (!data.outOfActiveList) continue;

      const outOfActiveListChange = data.outOfActiveList as { oldValue?: boolean; newValue?: boolean };

      // Determine reference date (use backdated outOfActiveListDate when available, like person-snapshot.ts)
      let referenceDate: string;
      if (
        data.outOfActiveListDate &&
        outOfActiveListChange.newValue === true
      ) {
        // Sortie de file active with a backdated date
        const outOfActiveListDateEntry = data.outOfActiveListDate as { oldValue?: unknown; newValue?: unknown };
        if (outOfActiveListDateEntry?.newValue) {
          const indicatedDate = outOfActiveListDateEntry.newValue;
          if (typeof indicatedDate === "number") {
            referenceDate = dayjsInstance(new Date(indicatedDate)).startOf("day").toISOString();
          } else if (typeof indicatedDate === "string") {
            referenceDate = dayjsInstance(new Date(indicatedDate)).startOf("day").toISOString();
          } else {
            referenceDate = dayjsInstance(historyEntry.date).startOf("day").toISOString();
          }
        } else {
          referenceDate = dayjsInstance(historyEntry.date).startOf("day").toISOString();
        }
      } else {
        referenceDate = dayjsInstance(historyEntry.date).startOf("day").toISOString();
      }

      if (outOfActiveListChange.oldValue === false && outOfActiveListChange.newValue === true) {
        // Transition: in active list → out of active list (start of an out-period)
        // This sets the start date for the most recent unstarted period
        const unstarted = periods.find((p) => p.isoStartDate === null);
        if (unstarted) {
          unstarted.isoStartDate = referenceDate;
        } else {
          // This shouldn't normally happen, but handle gracefully
          periods.unshift({
            isoStartDate: referenceDate,
            isoEndDate: referenceDate, // degenerate period
          });
        }
      } else if (outOfActiveListChange.oldValue === true && outOfActiveListChange.newValue === false) {
        // Transition: out of active list → in active list (end of an out-period)
        // The previous period (further back in time) needs this as its end date
        periods.unshift({
          isoStartDate: null, // will be filled by the next (older) transition
          isoEndDate: referenceDate,
        });
      }
    }
  }

  // Fill any remaining null start dates with followedSince (earliest possible date)
  const fallbackStart = person.followedSince
    ? dayjsInstance(person.followedSince).startOf("day").toISOString()
    : dayjsInstance("1970-01-01").toISOString();

  for (const period of periods) {
    if (period.isoStartDate === null) {
      period.isoStartDate = fallbackStart;
    }
  }

  // Sort by start date
  periods.sort((a, b) => (a.isoStartDate < b.isoStartDate ? -1 : 1));

  return periods;
}

/**
 * Check if a given ISO date falls within any out-of-active-list period.
 */
export function isDateInOutOfActiveListPeriod(
  isoDate: string,
  outOfActiveListPeriods: Array<{ isoStartDate: string; isoEndDate: string }>
): boolean {
  for (const period of outOfActiveListPeriods) {
    if (isoDate >= period.isoStartDate && isoDate < period.isoEndDate) {
      return true;
    }
  }
  return false;
}
