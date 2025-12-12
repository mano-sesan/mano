const timeUnits = ["day", "week", "month", "year"] as const;
type RecurrenceTypeForMonthAndYear = "absolute" | "relative" | "relativeLast";
export const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export type Recurrence = {
  startDate: Date;
  endDate: Date;
  timeInterval: number;
  timeUnit: (typeof timeUnits)[number];
  selectedDays?: typeof days;
  recurrenceTypeForMonthAndYear?: RecurrenceTypeForMonthAndYear;
};
