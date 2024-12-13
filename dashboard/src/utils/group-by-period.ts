import { dayjsInstance } from "../services/date";

type GroupBy = "month" | "year" | "day";

export function groupByPeriod(items: Array<any>, period: GroupBy, field: string = "date", groupedByKey: string = "groupedByKey") {
  const groupedItems = [];
  const options: Set<string> = new Set();
  let optionsArray: Array<string> = [];
  if (period === "year") {
    for (const item of items) {
      const year = `${dayjsInstance(item[field]).year()}`;
      const key = year;
      options.add(key);
      groupedItems.push({ ...item, [groupedByKey]: key });
    }
    const orderedYears = Array.from(options).sort((a, b) => dayjsInstance(a).diff(dayjsInstance(b)));
    const minYear = orderedYears[0];
    const maxYear = orderedYears[orderedYears.length - 1];
    let currentKey = minYear;
    while (currentKey !== maxYear) {
      if (!options.has(currentKey)) options.add(currentKey);
      const nextDate = dayjsInstance(`${currentKey}-01-01`).add(1, "year");
      currentKey = `${nextDate.year()}`;
    }
  }
  if (period === "month") {
    for (const item of items) {
      const month = (dayjsInstance(item[field]).month() + 1).toString().padStart(2, "0");
      const year = dayjsInstance(item[field]).year();
      const key = `${year}-${month}`;
      options.add(key);
      groupedItems.push({ ...item, [groupedByKey]: key });
    }
    const orderedKeys = Array.from(options).sort((a, b) => dayjsInstance(a).diff(dayjsInstance(b)));
    const minKey = orderedKeys[0];
    const maxKey = orderedKeys[orderedKeys.length - 1];
    let currentKey = minKey;
    while (currentKey !== maxKey) {
      if (!options.has(currentKey)) options.add(currentKey);
      const nextDate = dayjsInstance(`${currentKey}-01`).add(1, "month");
      currentKey = nextDate.format("YYYY-MM");
    }
  }
  if (period === "day") {
    for (const item of items) {
      const key = dayjsInstance(item[field]).format("YYYY-MM-DD");
      options.add(key);
      groupedItems.push({ ...item, [groupedByKey]: key });
    }
    const orderedKeys = Array.from(options).sort((a, b) => dayjsInstance(a).diff(dayjsInstance(b)));
    const minDay = orderedKeys[0];
    const maxDay = orderedKeys[orderedKeys.length - 1];
    let currentKey = minDay;
    while (currentKey !== maxDay) {
      if (!options.has(currentKey)) options.add(currentKey);
      const nextDate = dayjsInstance(currentKey).add(1, "day");
      currentKey = nextDate.format("YYYY-MM-DD");
    }
  }
  optionsArray = Array.from(options).sort((a, b) => dayjsInstance(a).diff(dayjsInstance(b)));

  return { data: groupedItems, options: optionsArray };
}
