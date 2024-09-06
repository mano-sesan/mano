import { useState } from "react";
import SelectCustom from "../components/SelectCustom";
import { dayjsInstance } from "../services/date";
import DatePicker from "../components/DatePicker";

export default function Sandbox() {
  return (
    <div className="main">
      <div className="tw-container tw-mx-auto tw-flex tw-flex-col tw-gap-8 tw-mt-8">
        <h1>Bac à sable</h1>
        <div className="">
          <Recurrence />
        </div>
      </div>
    </div>
  );
}

const numbers = Array.from({ length: 99 }, (_, i) => i + 1);
const timeUnits = ["day", "week", "month", "year"] as const;
type RecurrenceTypeForMonthAndYear = "absolute" | "relative" | "relativeLast";

const timeUnitsOptionsSingular = [
  { value: "day", label: "jour" },
  { value: "week", label: "semaine" },
  { value: "month", label: "mois" },
  { value: "year", label: "année" },
];

const timeUnitsOptionsPlural = [
  { value: "day", label: "jours" },
  { value: "week", label: "semaines" },
  { value: "month", label: "mois" },
  { value: "year", label: "années" },
];

const numbersOptions = numbers.map((number) => ({
  value: number,
  label: number,
}));

const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const ucFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Recurrence() {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(dayjsInstance(startDate).add(6, "month").toDate());
  const initialDayLabel = ucFirst(dayjsInstance(startDate).format("dddd"));
  const [timeInterval, setTimeInterval] = useState<number>(1);
  const [timeUnit, setTimeUnit] = useState<(typeof timeUnits)[number]>("week");
  const [selectedDays, setSelectedDays] = useState<typeof days>([initialDayLabel]);
  const [recurrenceTypeForMonthAndYear, setRecurrenceTypeForMonthAndYear] = useState<RecurrenceTypeForMonthAndYear>("relative");

  const shouldShowDays = timeUnit === "week" || (timeUnit === "day" && timeInterval === 1);
  const shouldShowDayRadio = timeUnit === "month" || timeUnit === "year";
  const nthWeekdayInMonth = getNthWeekdayInMonth(startDate);

  const handleChangeTimeUnitAndInterval = (unit: (typeof timeUnits)[number], interval: number) => {
    if (unit === "week" && interval === 1) {
      setSelectedDays([initialDayLabel]);
    }
    if (unit === "day" && interval === 1) {
      setSelectedDays(days);
    }
    if (unit === "year" && interval !== 1) {
      setTimeInterval(1);
    }
  };

  const handleChangeDays = (unit: (typeof timeUnits)[number], interval: number, updatedDays: typeof days) => {
    if (unit === "week" && interval === 1 && updatedDays.length === 7) {
      setTimeUnit("day");
    }
    if (unit === "day" && interval === 1 && updatedDays.length < 7) {
      setTimeUnit("week");
    }
  };

  const handleChangeStartDate = (date: Date, updatedDays: typeof days) => {
    if (updatedDays.length === 1) {
      const initialDayLabel = ucFirst(dayjsInstance(date).format("dddd"));
      setSelectedDays([initialDayLabel]);
    }
  };

  return (
    <div className="tw-flex tw-flex-col tw-gap-4">
      <div className="tw-flex tw-gap-2 tw-items-center tw-justify-start">
        <div>Début</div>
        <div className="tw-w-36">
          <DatePicker
            id="date"
            defaultValue={startDate}
            onChange={({ target: { value } }) => {
              handleChangeStartDate(value, selectedDays);
              setStartDate(value);
            }}
          />
        </div>
      </div>
      <div className="tw-flex tw-gap-2 tw-items-center tw-justify-start">
        Répéter chaque
        {timeUnit !== "year" ? (
          <div className="tw-w-20">
            <SelectCustom
              name="time-interval"
              id="time-interval"
              inputId="time-interval"
              classNamePrefix="time-interval"
              value={numbersOptions.find((o) => o.value === timeInterval)}
              onChange={(o) => {
                handleChangeTimeUnitAndInterval(timeUnit, o.value as number);
                setTimeInterval(o.value as number);
              }}
              options={numbersOptions}
            />
          </div>
        ) : null}
        <div className="tw-w-32">
          <SelectCustom
            name="time-unit"
            id="time-unit"
            inputId="time-unit"
            classNamePrefix="time-unit"
            value={(timeInterval === 1 ? timeUnitsOptionsSingular : timeUnitsOptionsPlural).find((o) => o.value === timeUnit)}
            onChange={(o) => {
              handleChangeTimeUnitAndInterval(o.value as (typeof timeUnits)[number], timeInterval);
              setTimeUnit(o.value as (typeof timeUnits)[number]);
            }}
            options={timeInterval === 1 ? timeUnitsOptionsSingular : timeUnitsOptionsPlural}
          />
        </div>
      </div>
      {shouldShowDays ? (
        <div className="tw-flex tw-gap-2">
          {days.map((day) => (
            <Day
              key={day}
              label={day.slice(0, 1)}
              onClick={() => {
                if (selectedDays.length === 1 && selectedDays.includes(day)) {
                  return;
                }
                const updatedDays = selectedDays.includes(day) ? selectedDays.filter((d) => d !== day) : [...selectedDays, day];
                handleChangeDays(timeUnit, timeInterval, updatedDays);
                setSelectedDays(updatedDays);
              }}
              selected={selectedDays.includes(day)}
            />
          ))}
        </div>
      ) : null}
      {shouldShowDayRadio ? (
        <div className="tw-flex tw-flex-col">
          <label>
            <input
              className="tw-accent-main"
              type="radio"
              id="absolute"
              name="absolute"
              value="absolute"
              checked={recurrenceTypeForMonthAndYear === "absolute"}
              onChange={() => setRecurrenceTypeForMonthAndYear("absolute")}
            />
            <span className="tw-ml-2">
              Le {dayjsInstance(startDate).format("D")} {timeUnit === "month" ? "" : dayjsInstance(startDate).format("MMMM")}
            </span>
          </label>
          <label>
            <input
              className="tw-accent-main"
              type="radio"
              id="relative"
              name="relative"
              value="relative"
              checked={recurrenceTypeForMonthAndYear === "relative"}
              onChange={() => setRecurrenceTypeForMonthAndYear("relative")}
            />
            <span className="tw-ml-2">
              Le {numberAsOrdinal(nthWeekdayInMonth.nth, false)} {dayjsInstance(startDate).format("dddd")}
              {timeUnit === "month" ? "" : ` de ${dayjsInstance(startDate).format("MMMM")}`}
            </span>
          </label>
          {nthWeekdayInMonth.isLast ? (
            <label>
              <input
                className="tw-accent-main"
                type="radio"
                id="relativeLast"
                name="relativeLast"
                value="relativeLast"
                checked={recurrenceTypeForMonthAndYear === "relativeLast"}
                onChange={() => setRecurrenceTypeForMonthAndYear("relativeLast")}
              />
              <span className="tw-ml-2">
                Le {numberAsOrdinal(nthWeekdayInMonth.nth, true)} {dayjsInstance(startDate).format("dddd")}
                {timeUnit === "month" ? "" : ` de ${dayjsInstance(startDate).format("MMMM")}`}
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="tw-text-stone-600 tw-text-sm">
        <RecurrenceAsText
          startDate={startDate}
          timeInterval={timeInterval}
          timeUnit={timeUnit}
          selectedDays={selectedDays}
          nthWeekdayInMonth={nthWeekdayInMonth}
          recurrenceTypeForMonthAndYear={recurrenceTypeForMonthAndYear}
        />
      </div>
      <div className="tw-flex tw-gap-2 tw-items-center tw-justify-start">
        <div>Jusqu'au</div>
        <div className="tw-w-36">
          <DatePicker
            id="date"
            defaultValue={endDate}
            minDate={dayjsInstance(startDate).format("YYYY-MM-DD")}
            onChange={({ target: { value } }) => {
              setEndDate(value);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function getNthWeekdayInMonth(date) {
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

function numberAsOrdinal(n: number, isLastWeek: boolean) {
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

function RecurrenceAsText({
  startDate,
  timeInterval,
  timeUnit,
  selectedDays,
  nthWeekdayInMonth,
  recurrenceTypeForMonthAndYear,
}: {
  startDate: Date;
  timeInterval: number;
  timeUnit: string;
  selectedDays: string[];
  nthWeekdayInMonth?: ReturnType<typeof getNthWeekdayInMonth>;
  recurrenceTypeForMonthAndYear: RecurrenceTypeForMonthAndYear;
}) {
  if (timeUnit === "day") {
    if (timeInterval === 1) {
      return `A lieu chaque jour`;
    } else if (timeInterval === 2) {
      return `A lieu un jour sur deux`;
    } else {
      return `A lieu tous les ${timeInterval} jours`;
    }
  }
  if (timeUnit === "week") {
    if (timeInterval === 1) {
      return `A lieu chaque ${joinDays(selectedDays).toLowerCase()}`;
    } else if (timeInterval === 2) {
      return `A lieu un ${joinDays(selectedDays).toLowerCase()} sur deux`;
    } else {
      return `A lieu toutes les ${timeInterval} semaines, le ${joinDays(selectedDays).toLowerCase()}`;
    }
  }
  if (timeUnit === "month") {
    if (timeInterval === 1) {
      if (recurrenceTypeForMonthAndYear === "absolute") {
        return `A lieu le ${dayjsInstance(startDate).date()} de chaque mois`;
      } else {
        return `A lieu le ${numberAsOrdinal(nthWeekdayInMonth.nth, recurrenceTypeForMonthAndYear === "relativeLast")} ${joinDays(selectedDays).toLowerCase()} de chaque mois`;
      }
    } else {
      if (recurrenceTypeForMonthAndYear === "absolute") {
        return `A lieu tous les ${timeInterval} mois, le ${dayjsInstance(startDate).date()}`;
      } else {
        return `A lieu tous les ${timeInterval} mois, le ${numberAsOrdinal(nthWeekdayInMonth.nth, recurrenceTypeForMonthAndYear === "relativeLast")} ${joinDays(selectedDays).toLowerCase()}`;
      }
    }
  }
  if (timeUnit === "year") {
    if (recurrenceTypeForMonthAndYear === "absolute") {
      return `A lieu chaque année, le ${dayjsInstance(startDate).format("D MMMM")}`;
    } else {
      return `A lieu chaque année, le ${numberAsOrdinal(nthWeekdayInMonth.nth, recurrenceTypeForMonthAndYear === "relativeLast")} ${joinDays(selectedDays).toLowerCase()} de ${dayjsInstance(startDate).format("MMMM")}`;
    }
  }
  return null;
}

function Day({ label, onClick, selected }: { label: string; onClick?: () => void; selected?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`tw-rounded-full tw-h-10 tw-w-10 tw-flex tw-items-center tw-justify-center tw-text-white ${selected ? "tw-bg-main" : "tw-bg-main25"}`}
    >
      {label}
    </button>
  );
}
