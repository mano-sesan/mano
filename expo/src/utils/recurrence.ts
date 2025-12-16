import structuredClone from "@ungap/structured-clone";
import { dayjsInstance } from "../services/dateDayjs";
import { Recurrence } from "@/types/recurrence";
import { ActionInstance } from "@/types/action";
import { UUIDV4 } from "@/types/uuid";
import { Dayjs } from "dayjs";

const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const ucFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function toDayIndex(day: string) {
  return days.indexOf(ucFirst(day));
}

export function getOccurrences(recurrence: Recurrence) {
  const { startDate, endDate, timeInterval, timeUnit, selectedDays, recurrenceTypeForMonthAndYear } = recurrence;
  const occurrences = [];
  let nextDate = dayjsInstance(startDate).startOf("day");
  if (timeUnit === "day") {
    while (nextDate.isBefore(dayjsInstance(endDate).endOf("day"))) {
      occurrences.push(nextDate);
      nextDate = nextDate.add(timeInterval, "day");
    }
  } else if (timeUnit === "week") {
    while (nextDate.isBefore(dayjsInstance(endDate).endOf("day"))) {
      for (const day of days) {
        if (selectedDays?.includes(day)) {
          const dayOfWeekIndex = toDayIndex(day);
          const occurrence = nextDate.startOf("week").add(dayOfWeekIndex, "day");
          if (occurrence.isBefore(dayjsInstance(endDate).endOf("day")) && !dayjsInstance(startDate).startOf("day").isAfter(occurrence)) {
            occurrences.push(occurrence);
          }
        }
      }
      nextDate = nextDate.startOf("week").add(timeInterval, "week");
    }
  } else if (timeUnit === "month") {
    while (nextDate.isBefore(dayjsInstance(endDate).endOf("day"))) {
      if (recurrenceTypeForMonthAndYear === "absolute") {
        const occurrence = nextDate.date(dayjsInstance(startDate).date());
        if (occurrence.isBefore(dayjsInstance(endDate).endOf("day")) && !dayjsInstance(startDate).startOf("day").isAfter(occurrence)) {
          occurrences.push(occurrence);
        }
        nextDate = nextDate.add(timeInterval, "month");
      } else if (recurrenceTypeForMonthAndYear === "relative") {
        const targetDayOfWeek = dayjsInstance(startDate).day();
        let occurrence = nextDate.startOf("month").day(targetDayOfWeek);
        if (occurrence.isBefore(nextDate.startOf("month"))) {
          occurrence = occurrence.add(1, "week");
        }
        const weekOffset = Math.floor((dayjsInstance(startDate).date() - 1) / 7);
        const relativeOccurrence = occurrence.add(weekOffset, "week");

        if (
          relativeOccurrence.isBefore(dayjsInstance(endDate).endOf("day")) &&
          !dayjsInstance(startDate).startOf("day").isAfter(relativeOccurrence)
        ) {
          occurrences.push(relativeOccurrence);
        }
        nextDate = nextDate.startOf("month").add(timeInterval, "month");
      } else if (recurrenceTypeForMonthAndYear === "relativeLast") {
        const targetDayOfWeek = dayjsInstance(startDate).day();
        let lastOccurrence = nextDate.endOf("month").day(targetDayOfWeek).startOf("day");
        if (lastOccurrence.isAfter(nextDate.endOf("month"))) {
          lastOccurrence = lastOccurrence.subtract(1, "week");
        }
        if (lastOccurrence.isBefore(dayjsInstance(endDate).endOf("day")) && !dayjsInstance(startDate).startOf("day").isAfter(lastOccurrence)) {
          occurrences.push(lastOccurrence);
        }
        nextDate = nextDate.startOf("month").add(timeInterval, "month");
      }
    }
  } else if (timeUnit === "year") {
    while (nextDate.isBefore(dayjsInstance(endDate).endOf("day"))) {
      if (recurrenceTypeForMonthAndYear === "absolute") {
        const occurrence = nextDate.date(dayjsInstance(startDate).date()).month(dayjsInstance(startDate).month());
        if (occurrence.isBefore(dayjsInstance(endDate).endOf("day")) && !dayjsInstance(startDate).startOf("day").isAfter(occurrence)) {
          occurrences.push(occurrence);
        }
        nextDate = nextDate.add(1, "year");
      } else if (recurrenceTypeForMonthAndYear === "relative") {
        const targetDayOfWeek = dayjsInstance(startDate).day();
        let occurrence = nextDate.startOf("month").day(targetDayOfWeek);
        if (occurrence.isBefore(nextDate.startOf("month"))) {
          occurrence = occurrence.add(1, "week");
        }
        const weekOffset = Math.floor((dayjsInstance(startDate).date() - 1) / 7);
        const relativeOccurrence = occurrence.add(weekOffset, "week");

        if (
          relativeOccurrence.isBefore(dayjsInstance(endDate).endOf("day")) &&
          !dayjsInstance(startDate).startOf("day").isAfter(relativeOccurrence)
        ) {
          occurrences.push(relativeOccurrence);
        }
        nextDate = nextDate.startOf("month").add(1, "year");
      } else if (recurrenceTypeForMonthAndYear === "relativeLast") {
        const targetDayOfWeek = dayjsInstance(startDate).day();
        let lastOccurrence = nextDate.endOf("month").day(targetDayOfWeek).startOf("day");
        if (lastOccurrence.isAfter(nextDate.endOf("month"))) {
          lastOccurrence = lastOccurrence.subtract(1, "week");
        }
        if (lastOccurrence.isBefore(dayjsInstance(endDate).endOf("day")) && !dayjsInstance(startDate).startOf("day").isAfter(lastOccurrence)) {
          occurrences.push(lastOccurrence);
        }
        nextDate = nextDate.startOf("month").add(1, "year");
      }
    }
  }

  return occurrences.map((date) => date.toDate());
}

// On donne une liste d'action et on retire les actions récurrentes qui sont après la prochaine occurrence.
// Utile pour ne pas afficher toutes les actions du futur dans les notifications
export function actionsWithoutFutureRecurrences(actionsToSet: ActionInstance[]) {
  const now = dayjsInstance().startOf("day");

  const getActionDate = (action: ActionInstance) => {
    return action.completedAt ? dayjsInstance(action.completedAt) : dayjsInstance(action.dueAt);
  };

  const actionsWithoutRecurrence = structuredClone(actionsToSet.filter((action) => !action.recurrence)); // null ou undefined
  const actionsGroupedByRecurrence = structuredClone(
    actionsToSet.reduce((acc, action) => {
      if (action.recurrence) {
        if (!acc[action.recurrence]) {
          acc[action.recurrence] = [];
        }
        acc[action.recurrence].push(action);
      }
      return acc;
    }, {} as Record<UUIDV4, ActionInstance[]>)
  );

  const actionsWithRecurrence = Object.values(actionsGroupedByRecurrence).flatMap((group) => {
    // Trier les actions dans le groupe par date
    const sortedGroup = group.sort((a, b) => (getActionDate(a).isAfter(getActionDate(b)) ? 1 : -1));
    // Trouver la première action à venir
    const firstUpcomingIndex = sortedGroup.findIndex((action) => !now.isAfter(getActionDate(action)));
    // Si aucune action à venir, retourner tout le groupe
    if (firstUpcomingIndex === -1) {
      return sortedGroup;
    }

    // On garde les actions jusqu'à la première action à venir (inclus)
    const actionsToDisplay: Array<ActionInstance & { nextOccurrence?: Dayjs }> = sortedGroup.slice(0, firstUpcomingIndex + 1);
    // Enrichir la dernière action (la première à venir) avec la date de la suivante, si elle existe
    if (firstUpcomingIndex + 1 < sortedGroup.length) {
      const nextAction = sortedGroup[firstUpcomingIndex + 1];
      actionsToDisplay[firstUpcomingIndex].nextOccurrence = getActionDate(nextAction);
    }

    return actionsToDisplay;
  });

  const finalActions = [...actionsWithoutRecurrence, ...actionsWithRecurrence];
  return finalActions;
}

export function getNthWeekdayInMonth(date: Date | string | Dayjs): { nth: number; isLast: boolean } {
  const currentDay = dayjsInstance(date);
  const weekday = currentDay.day();
  const firstDayOfMonth = currentDay.startOf("month");
  let firstOfWeekdayInMonth = firstDayOfMonth;
  while (firstOfWeekdayInMonth.day() !== weekday) {
    firstOfWeekdayInMonth = firstOfWeekdayInMonth.add(1, "day");
  }
  const nth = Math.floor(currentDay.date() / 7) + 1;
  const lastDayOfMonth = currentDay.endOf("month");
  let lastOfWeekdayInMonth = lastDayOfMonth;
  while (lastOfWeekdayInMonth.day() !== weekday) {
    lastOfWeekdayInMonth = lastOfWeekdayInMonth.subtract(1, "day");
  }
  const isLast = currentDay.isSame(lastOfWeekdayInMonth, "day");

  return {
    nth, // 1er, 2ème, etc.
    isLast, // true si c'est le dernier jour de ce type dans le mois
  };
}

export function numberAsOrdinal(n: number, isLastWeek: boolean) {
  if (isLastWeek) return "dernier";
  if (n === 1) return "premier";
  if (n === 2) return "deuxième";
  if (n === 3) return "troisième";
  if (n === 4) return "quatrième";
  if (n === 5) return "cinquième";
}

function joinDays(days: string[]) {
  if (days.length === 0) {
    return "";
  }
  if (days.length === 1) {
    return days[0];
  }
  if (days.length === 2) {
    return `${days[0]} et ${days[1]}`;
  }
  return `${days.slice(0, -1).join(", ")}, et ${days[days.length - 1]}`;
}

export function recurrenceAsText({
  startDate,
  timeInterval,
  timeUnit,
  selectedDays,
  nthWeekdayInMonth,
  recurrenceTypeForMonthAndYear,
}: Recurrence & { nthWeekdayInMonth: { nth: number; isLast: boolean } }) {
  if (timeUnit === "day") {
    if (timeInterval === 1) {
      return "A lieu chaque jour";
    } else if (timeInterval === 2) {
      return "A lieu un jour sur deux";
    } else {
      return `A lieu tous les ${timeInterval} jours`;
    }
  }
  if (timeUnit === "week") {
    if (timeInterval === 1) {
      return `A lieu chaque ${joinDays(selectedDays || []).toLowerCase()}`;
    } else if (timeInterval === 2) {
      return `A lieu un ${joinDays(selectedDays || []).toLowerCase()} sur deux`;
    } else {
      return `A lieu toutes les ${timeInterval} semaines, le ${joinDays(selectedDays || []).toLowerCase()}`;
    }
  }
  if (timeUnit === "month") {
    if (timeInterval === 1) {
      if (recurrenceTypeForMonthAndYear === "absolute") {
        return `A lieu le ${dayjsInstance(startDate).date()} de chaque mois`;
      } else {
        return `A lieu le ${numberAsOrdinal(nthWeekdayInMonth.nth, recurrenceTypeForMonthAndYear === "relativeLast")} ${dayjsInstance(
          startDate
        ).format("dddd")} de chaque mois`;
      }
    } else {
      if (recurrenceTypeForMonthAndYear === "absolute") {
        return `A lieu tous les ${timeInterval} mois, le ${dayjsInstance(startDate).date()}`;
      } else {
        return `A lieu tous les ${timeInterval} mois, le ${numberAsOrdinal(
          nthWeekdayInMonth.nth,
          recurrenceTypeForMonthAndYear === "relativeLast"
        )} ${dayjsInstance(startDate).format("dddd")}`;
      }
    }
  }
  if (timeUnit === "year") {
    if (recurrenceTypeForMonthAndYear === "absolute") {
      return `A lieu chaque année, le ${dayjsInstance(startDate).format("D MMMM")}`;
    } else {
      return `A lieu chaque année, le ${numberAsOrdinal(nthWeekdayInMonth.nth, recurrenceTypeForMonthAndYear === "relativeLast")} ${dayjsInstance(
        startDate
      ).format("dddd")} de ${dayjsInstance(startDate).format("MMMM")}`;
    }
  }
  return null;
}
