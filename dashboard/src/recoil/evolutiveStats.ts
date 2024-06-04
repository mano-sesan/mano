import { selector, selectorFamily } from "recoil";
import structuredClone from "@ungap/structured-clone";
import { capture } from "../services/sentry";
import type { PersonPopulated } from "../types/person";
import type { CustomOrPredefinedField } from "../types/field";
import type { IndicatorsSelection } from "../types/evolutivesStats";
import type { EvolutiveStatsPersonFields, EvolutiveStatOption, EvolutiveStatDateYYYYMMDD } from "../types/evolutivesStats";
import { dayjsInstance } from "../services/date";
import { personFieldsIncludingCustomFieldsSelector } from "./persons";
import type { Dayjs } from "dayjs";
import { currentTeamState } from "./auth";

export const evolutiveStatsIndicatorsBaseSelector = selector({
  key: "evolutiveStatsIndicatorsBaseSelector",
  get: ({ get }) => {
    const allFields = get(personFieldsIncludingCustomFieldsSelector);
    const currentTeam = get(currentTeamState);
    const indicatorsBase = allFields
      .filter((a) => a.enabled || a.enabledTeams?.includes(currentTeam._id))
      .filter((f) => {
        if (f.name === "history") return false;
        if (f.name === "documents") return false;
        switch (f.type) {
          case "text":
          case "textarea":
          case "date":
          case "duration":
          case "date-with-time":
            return false;
          case "multi-choice":
          case "number":
          case "yes-no":
          case "enum":
          case "boolean":
          default:
            return f.filterable;
        }
      });

    return indicatorsBase;
  },
});

export const startHistoryFeatureDate = "2022-09-23";

type FieldsMap = Record<CustomOrPredefinedField["name"], CustomOrPredefinedField>;

function getValuesOptionsByField(field: CustomOrPredefinedField, fieldsMap: FieldsMap): Array<EvolutiveStatOption> {
  if (!field) return [];
  const current = fieldsMap[field.name];
  if (!current) return [];
  if (["yes-no"].includes(current.type)) return ["Oui", "Non", "Non renseigné"];
  if (["boolean"].includes(current.type)) return ["Oui", "Non"];
  if (current?.name === "outOfActiveList") return current.options ?? ["Oui", "Non"];
  if (current?.options?.length) {
    // eslint-disable-next-line no-unsafe-optional-chaining
    return [...current?.options, "Non renseigné"].filter((option) => {
      if (option.includes("Choisissez un genre")) return false;
      return true;
    });
  }
  return ["Non renseigné"];
}

function getValueByField(fieldName: CustomOrPredefinedField["name"], fieldsMap: FieldsMap, value: any): string | Array<string> {
  if (!fieldName) return "";
  const current = fieldsMap[fieldName];
  if (!current) return "";
  if (["yes-no"].includes(current.type)) {
    if (value === "Oui") return "Oui";
    return "Non";
  }
  if (["boolean"].includes(current.type)) {
    if (value === true || value === "Oui") return "Oui";
    return "Non";
  }
  if (current?.name === "outOfActiveList") {
    if (value === true) return "Oui";
    return "Non";
  }
  if (current.type === "multi-choice") {
    if (Array.isArray(value)) {
      if (value.length === 0) return ["Non renseigné"];
      return value;
    }
    if (value == null || value === "") {
      return [];
    }
    return [value];
  }
  if (value == null || value === "") {
    return "Non renseigné"; // we cover the case of undefined, null, empty string
  }
  if (value.includes("Choisissez un genre")) return "Non renseigné";
  return value;
}

function getPersonSnapshotAtDate({
  person,
  snapshotDate,
  fieldsMap,
}: {
  person: PersonPopulated;
  fieldsMap: FieldsMap;
  snapshotDate: string; // YYYYMMDD
}): PersonPopulated | null {
  let snapshot = structuredClone(person);
  const followedSince = dayjsInstance(snapshot.followedSince || snapshot.createdAt).format("YYYYMMDD");
  if (followedSince > snapshotDate) return null;
  const history = snapshot.history;
  if (!history?.length) return snapshot;
  const reversedHistory = [...history].reverse();
  for (const historyItem of reversedHistory) {
    const historyDate = dayjsInstance(historyItem.date).format("YYYYMMDD");
    // history is: before the date
    // snapshot is: after the date
    // what should we do for a history change on the same day as the snapshot ?
    // 2 options: we keep the snapshot, or we keep the history change
    // we keep the snapshot because it's more coherent with L258-L259
    if (historyDate <= snapshotDate) return snapshot; // if snapshot's day is history's day, we return the snapshot
    for (const historyChangeField of Object.keys(historyItem.data)) {
      const oldValue = getValueByField(historyChangeField, fieldsMap, historyItem.data[historyChangeField].oldValue);
      const historyNewValue = getValueByField(historyChangeField, fieldsMap, historyItem.data[historyChangeField].newValue);
      const currentPersonValue = getValueByField(historyChangeField, fieldsMap, snapshot[historyChangeField]);
      if (JSON.stringify(historyNewValue) !== JSON.stringify(currentPersonValue)) {
        console.log("Incoherent snapshot history");
        capture(new Error("Incoherent snapshot history"), {
          extra: {
            historyItem,
            historyChangeField,
            oldValue,
            historyNewValue,
            currentPersonValue,
          },
        });
      }
      if (oldValue === "") continue;
      snapshot = {
        ...snapshot,
        [historyChangeField]: oldValue,
      };
    }
  }
  return snapshot;
}

type EvolutiveStatRenderData = {
  indicatorFieldLabel: CustomOrPredefinedField["label"];
  valueStart: EvolutiveStatOption;
  valueEnd: EvolutiveStatOption;
  startDateConsolidated: Dayjs;
  endDateConsolidated: Dayjs;
  countSwitched: number;
  countPersonSwitched: number;
  percentSwitched: number;
  personsIdsSwitched: Array<PersonPopulated["id"]>;
  initPersonsIds: Array<PersonPopulated["id"]>;
};

export function computeEvolutiveStatsForPersons({
  startDate,
  endDate,
  persons,
  evolutiveStatsIndicators,
  evolutiveStatsIndicatorsBase,
}: {
  startDate: string | null;
  endDate: string | null;
  persons: Array<PersonPopulated>;
  evolutiveStatsIndicators: IndicatorsSelection;
  evolutiveStatsIndicatorsBase: Array<CustomOrPredefinedField>;
}): EvolutiveStatRenderData | null {
  // concepts:
  // we select "indicators" (for now only one by one is possible) that are fields of the person
  // one indicator is: one `field`, one `fromValue` and one `toValue`
  // we want to see the number of switches from `fromValue` to `toValue` for the `field` of the persons - one person can have multiple switches
  // if only `field` is defined, we present nothing for now
  // if `fromValue` is defined, we present nothing from now - we will present the number of switches to any values from the `fromValue`
  // if `toValue` is defined, we present two numbers only
  // how do we calculate ?
  // we start by the snapshot at the initial value
  // then we go forward in time, and when we meet an entry in the history for the field,
  // if the date is beyond the start date or the end date, we skip it
  // if the date is between the start date and the end date, we take the value of the field at this date
  // we keep this value until we meet another entry in the history for the field, etc. until today / until the end date

  let startDateConsolidated = startDate
    ? dayjsInstance(dayjsInstance(startDate).startOf("day").format("YYYY-MM-DD"))
    : dayjsInstance(startHistoryFeatureDate);

  let endDateConsolidated = endDate ? dayjsInstance(dayjsInstance(endDate).endOf("day").format("YYYY-MM-DD")) : dayjsInstance();

  if (startDateConsolidated.isSame(endDateConsolidated)) return null;

  let startDateFormatted = startDateConsolidated.format("YYYYMMDD");
  let endDateFormatted = endDateConsolidated.format("YYYYMMDD");
  let tonight = dayjsInstance().endOf("day").format("YYYYMMDD");
  endDateFormatted = endDateFormatted > tonight ? endDateFormatted : tonight;

  // for now we only support one indicator
  let indicator = evolutiveStatsIndicators[0];
  let indicatorFieldName = indicator?.fieldName; // ex: custom-field-1
  let indicatorFieldLabel = evolutiveStatsIndicatorsBase.find((f) => f.name === indicatorFieldName)?.label; // exemple: "Ressources"

  const fieldsMap: FieldsMap = evolutiveStatsIndicatorsBase
    .filter((f) => {
      if (evolutiveStatsIndicators.find((i) => i.fieldName === f.name)) return true;
      return false;
    })
    .reduce((acc, field) => {
      acc[field.name] = field;
      return acc;
    }, {} as FieldsMap);

  let valueStart = indicator?.fromValue;
  let valueEnd = indicator?.toValue;

  // we get the persons at the
  let initPersons = persons
    .map((p) => {
      const snapshot = getPersonSnapshotAtDate({ person: p, snapshotDate: startDateFormatted, fieldsMap });
      if (!snapshot) return null;
      let currentRawValue = getValueByField(indicatorFieldName ?? "", fieldsMap, snapshot[indicatorFieldName ?? ""]);
      let currentValue = Array.isArray(currentRawValue) ? currentRawValue : [currentRawValue].filter(Boolean);
      if (!currentValue.includes(valueStart)) return null;
      return snapshot;
    })
    .filter(Boolean);

  let personsIdsSwitchedByValue: Record<EvolutiveStatOption, Array<PersonPopulated["id"]>> = {};

  for (let person of initPersons) {
    let followedSince = dayjsInstance(person.followedSince || person.createdAt).format("YYYYMMDD");
    let minimumDate = followedSince < startDateFormatted ? startDateFormatted : followedSince;

    let countSwitchedValueDuringThePeriod = 0;

    let currentPerson = structuredClone(person);
    let currentRawValue = getValueByField(indicatorFieldName ?? "", fieldsMap, currentPerson[indicatorFieldName ?? ""]);
    let currentValue = Array.isArray(currentRawValue) ? currentRawValue : [currentRawValue].filter(Boolean);

    for (let historyItem of person.history ?? []) {
      const historyDate = dayjsInstance(historyItem.date).format("YYYYMMDD");
      if (historyDate < minimumDate) continue;
      if (historyDate > endDateFormatted) break;

      let nextPerson = structuredClone(currentPerson);
      for (const historyChangeField of Object.keys(historyItem.data)) {
        let oldValue = getValueByField(historyChangeField, fieldsMap, historyItem.data[historyChangeField].oldValue);
        let historyNewValue = getValueByField(historyChangeField, fieldsMap, historyItem.data[historyChangeField].newValue);
        let currentPersonValue = getValueByField(historyChangeField, fieldsMap, currentPerson[historyChangeField]);
        if (JSON.stringify(oldValue) !== JSON.stringify(currentPersonValue)) {
          capture(new Error("Incoherent history in computeEvolutiveStatsForPersons"), {
            extra: {
              historyItem,
              historyChangeField,
              oldValue,
              historyNewValue,
              currentPersonValue,
            },
          });
        }

        if (oldValue === "") continue;
        nextPerson = {
          ...nextPerson,
          [historyChangeField]: historyNewValue,
        };
      }
      // now we have the person at the date of the history item

      let nextRawValue = getValueByField(indicatorFieldName ?? "", fieldsMap, nextPerson[indicatorFieldName ?? ""]);
      let nextValue = Array.isArray(nextRawValue) ? nextRawValue : [nextRawValue].filter(Boolean);

      if (currentValue.includes(valueStart)) {
        if (!nextValue.includes(valueStart)) {
          countSwitchedValueDuringThePeriod++;
          for (let value of nextValue) {
            if (!personsIdsSwitchedByValue[value]) {
              personsIdsSwitchedByValue[value] = [];
            }
            personsIdsSwitchedByValue[value].push(person._id);
          }
        }
      }
      currentPerson = nextPerson;
      currentValue = nextValue;
    }

    if (countSwitchedValueDuringThePeriod === 0) {
      if (!personsIdsSwitchedByValue[valueStart]) {
        personsIdsSwitchedByValue[valueStart] = [];
      }
      personsIdsSwitchedByValue[valueStart].push(person._id); // from `fromValue` to `fromValue`
    }
  }

  // const fieldData = fieldsByOptionsAndDate[indicatorFieldName ?? ""] ?? {};

  let countSwitched = personsIdsSwitchedByValue[valueEnd]?.length ?? 0;
  let personsIdsSwitched = [...new Set(personsIdsSwitchedByValue[valueEnd] ?? [])];
  let countPersonSwitched = personsIdsSwitched.length;
  let percentSwitched = Math.round((initPersons.length ? countSwitched / initPersons.length : 0) * 100);

  return {
    initPersonsIds: initPersons.map((p) => p._id),
    countSwitched,
    countPersonSwitched,
    percentSwitched,
    indicatorFieldLabel,
    valueStart,
    valueEnd,
    startDateConsolidated,
    endDateConsolidated,
    personsIdsSwitched,
  };
}

export const evolutiveStatsForPersonsSelector = selectorFamily({
  key: "evolutiveStatsForPersonsSelector",
  get:
    ({
      startDate,
      endDate,
      persons,
      evolutiveStatsIndicators,
    }: {
      startDate: string | null;
      endDate: string | null;
      persons: Array<PersonPopulated>;
      evolutiveStatsIndicators: IndicatorsSelection;
    }) =>
    ({ get }) => {
      const evolutiveStatsIndicatorsBase = get(evolutiveStatsIndicatorsBaseSelector);

      return computeEvolutiveStatsForPersons({
        startDate,
        endDate,
        persons,
        evolutiveStatsIndicators,
        evolutiveStatsIndicatorsBase,
      });
    },
});
