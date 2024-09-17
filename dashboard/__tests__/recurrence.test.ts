import { dayjsInstance } from "../src/services/date";
import { Recurrence } from "../src/types/recurrence";
import { getOccurrences } from "../src/utils/recurrence";

// 01/01/2024 was a Monday 🎉 (easier to review)

function occurrences(
  startDate: string,
  endDate: string,
  timeInterval: Recurrence["timeInterval"],
  timeUnit: Recurrence["timeUnit"],
  selectedDays?: Recurrence["selectedDays"],
  recurrenceTypeForMonthAndYear?: Recurrence["recurrenceTypeForMonthAndYear"]
) {
  return getOccurrences({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    timeInterval,
    timeUnit,
    selectedDays,
    recurrenceTypeForMonthAndYear,
  });
}

function toDates(dates: string[]) {
  return dates.map((date) => dayjsInstance(date).toDate());
}

describe("Recurrence", () => {
  describe("getNextOccurrences", () => {
    it("every 1 day", () => {
      let actual = occurrences("2024-01-01", "2024-01-03", 1, "day");
      let expected = toDates(["2024-01-01", "2024-01-02", "2024-01-03"]);
      expect(actual).toEqual(expected);
      actual = occurrences("2023-12-31", "2024-01-01", 1, "day");
      expected = toDates(["2023-12-31", "2024-01-01"]);
      expect(actual).toEqual(expected);
    });

    it("every 2 day", () => {
      let actual = occurrences("2023-12-31", "2024-01-07", 2, "day");
      let expected = toDates(["2023-12-31", "2024-01-02", "2024-01-04", "2024-01-06"]);
      expect(actual).toEqual(expected);
      actual = occurrences("2024-01-01", "2024-01-04", 2, "day");
      expected = toDates(["2024-01-01", "2024-01-03"]);
      expect(actual).toEqual(expected);
    });

    it("every 1 week on monday and tuesday", () => {
      let actual = occurrences("2024-01-01", "2024-01-17", 1, "week", ["Lundi", "Mardi"]);
      let expected = toDates(["2024-01-01", "2024-01-02", "2024-01-08", "2024-01-09", "2024-01-15", "2024-01-16"]);
      expect(actual).toEqual(expected);
      actual = occurrences("2024-01-02", "2024-01-16", 1, "week", ["Lundi", "Mardi"]);
      expected = toDates(["2024-01-02", "2024-01-08", "2024-01-09", "2024-01-15", "2024-01-16"]);
    });

    it("every 2 weeks on monday and sunday", () => {
      const actual = occurrences("2024-01-01", "2024-02-04", 2, "week", ["Lundi", "Dimanche"]);
      const expected = toDates(["2024-01-01", "2024-01-07", "2024-01-15", "2024-01-21", "2024-01-29", "2024-02-04"]);
      expect(actual).toEqual(expected);
    });

    it("every n months, the 10th", () => {
      let actual = occurrences("2024-01-10", "2024-04-01", 1, "month", undefined, "absolute");
      let expected = toDates(["2024-01-10", "2024-02-10", "2024-03-10"]);
      expect(actual).toEqual(expected);
      actual = occurrences("2024-01-10", "2024-04-10", 1, "month", undefined, "absolute");
      expected = toDates(["2024-01-10", "2024-02-10", "2024-03-10", "2024-04-10"]);
      expect(actual).toEqual(expected);
      actual = occurrences("2024-01-10", "2024-04-20", 2, "month", undefined, "absolute");
      expected = toDates(["2024-01-10", "2024-03-10"]);
      expect(actual).toEqual(expected);
    });

    it("every n months, the first sunday", () => {
      let actual = occurrences("2024-01-07", "2024-04-01", 1, "month", undefined, "relative");
      let expected = toDates(["2024-01-07", "2024-02-04", "2024-03-03"]);
      expect(actual).toEqual(expected);
      actual = occurrences("2024-01-07", "2024-03-03", 1, "month", undefined, "relative");
      expected = toDates(["2024-01-07", "2024-02-04", "2024-03-03"]);
      expect(actual).toEqual(expected);
      actual = occurrences("2024-01-07", "2024-03-03", 2, "month", undefined, "relative");
      expected = toDates(["2024-01-07", "2024-03-03"]);
      expect(actual).toEqual(expected);
    });

    it("every n months, the last sunday", () => {
      let actual = occurrences("2024-01-28", "2024-04-01", 1, "month", undefined, "relativeLast");
      let expected = toDates(["2024-01-28", "2024-02-25", "2024-03-31"]);
      expect(actual).toEqual(expected);
      actual = occurrences("2024-01-28", "2024-03-31", 1, "month", undefined, "relativeLast");
      expected = toDates(["2024-01-28", "2024-02-25", "2024-03-31"]);
      expect(actual).toEqual(expected);
      actual = occurrences("2024-01-28", "2024-03-31", 2, "month", undefined, "relativeLast");
      expected = toDates(["2024-01-28", "2024-03-31"]);
      expect(actual).toEqual(expected);
    });

    it("every 1 years, the 10th of january", () => {
      let actual = occurrences("2024-01-10", "2026-01-01", 1, "year", undefined, "absolute");
      let expected = toDates(["2024-01-10", "2025-01-10"]);
      expect(actual).toEqual(expected);
      actual = occurrences("2024-01-10", "2026-01-10", 1, "year", undefined, "absolute");
      expected = toDates(["2024-01-10", "2025-01-10", "2026-01-10"]);
      expect(actual).toEqual(expected);
    });

    it("every n years, the first sunday of january", () => {
      let actual = occurrences("2024-01-07", "2026-01-01", 1, "year", undefined, "relative");
      let expected = toDates(["2024-01-07", "2025-01-05"]);
      expect(actual).toEqual(expected);
      actual = occurrences("2024-01-07", "2025-01-05", 1, "year", undefined, "relative");
      expected = toDates(["2024-01-07", "2025-01-05"]);
      expect(actual).toEqual(expected);
    });

    it("every n years, the last sunday of january", () => {
      let actual = occurrences("2024-01-28", "2026-01-01", 1, "year", undefined, "relativeLast");
      let expected = toDates(["2024-01-28", "2025-01-26"]);
      expect(actual).toEqual(expected);
      actual = occurrences("2024-01-28", "2025-01-26", 1, "year", undefined, "relativeLast");
      expected = toDates(["2024-01-28", "2025-01-26"]);
      expect(actual).toEqual(expected);
    });
  });
});
