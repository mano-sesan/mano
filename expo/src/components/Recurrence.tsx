import React, { useEffect, useState } from "react";
import { dayjsInstance } from "../services/dateDayjs";
import { getNthWeekdayInMonth, numberAsOrdinal, recurrenceAsText } from "../utils/recurrence";
import { View, Text, TouchableOpacity } from "react-native";
import DateAndTimeInput from "./DateAndTimeInput";
import { Picker } from "@react-native-picker/picker";
import CheckboxLabelled from "./CheckboxLabelled";
import { Recurrence } from "@/types/recurrence";
import { Dayjs } from "dayjs";

const numbers = Array.from({ length: 99 }, (_, i) => i + 1);
type TimeUnit = "day" | "week" | "month" | "year";

const timeUnitsOptionsSingular: { value: TimeUnit; label: string }[] = [
  { value: "day", label: "jour" },
  { value: "week", label: "semaine" },
  { value: "month", label: "mois" },
  { value: "year", label: "année" },
];

const timeUnitsOptionsPlural: { value: TimeUnit; label: string }[] = [
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

function SelectCustom<T extends { value: number | string; label: string | number }>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (option: T) => void;
  options: T[];
}) {
  return (
    <View className="border border-gray-300 rounded-md">
      <Picker
        selectedValue={value.value}
        onValueChange={(itemValue) => {
          const option = options.find((o) => o.value === itemValue)!;
          onChange(option);
        }}
      >
        {options.map((option) => (
          <Picker.Item key={option.value} label={String(option.label)} value={String(option.value)} />
        ))}
      </Picker>
    </View>
  );
}
function Day({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-full mx-0.5 h-10 w-10 flex items-center justify-center ${selected ? "bg-main" : "bg-main25"}`}
    >
      <Text className="text-white">{label}</Text>
    </TouchableOpacity>
  );
}

type RecurrenceProps = {
  startDate: Date;
  onChange: (values: Recurrence) => void;
  initialValues: Recurrence;
};

export default function RecurrenceComponent({ startDate, onChange, initialValues }: RecurrenceProps) {
  const [endDate, setEndDate] = useState(initialValues.endDate || dayjsInstance(startDate).add(6, "month").toDate());
  const initialDayLabel = ucFirst(dayjsInstance(startDate).format("dddd"));
  const [timeInterval, setTimeInterval] = useState(initialValues.timeInterval || 1);
  const [timeUnit, setTimeUnit] = useState(initialValues.timeUnit || "week");
  const [selectedDays, setSelectedDays] = useState(initialValues.selectedDays || (initialValues.timeUnit === "day" ? days : [initialDayLabel]));
  const [recurrenceTypeForMonthAndYear, setRecurrenceTypeForMonthAndYear] = useState(initialValues.recurrenceTypeForMonthAndYear || "relative");

  const shouldShowDays = timeUnit === "week" || (timeUnit === "day" && timeInterval === 1);
  const shouldShowDayRadio = timeUnit === "month" || timeUnit === "year"; //
  const nthWeekdayInMonth = getNthWeekdayInMonth(startDate);

  const handleChangeTimeUnitAndInterval = (unit: "day" | "week" | "month" | "year", interval: number) => {
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

  const handleChangeDays = (unit: "day" | "week" | "month" | "year", interval: number, updatedDays: string[]) => {
    if (unit === "week" && interval === 1 && updatedDays.length === 7) {
      setTimeUnit("day");
    }
    if (unit === "day" && interval === 1 && updatedDays.length < 7) {
      setTimeUnit("week");
    }
  };

  const handleChangeStartDate = (date: Date | string | Dayjs, updatedDays: string[]) => {
    if (updatedDays.length === 1) {
      const initialDayLabel = ucFirst(dayjsInstance(date).format("dddd"));
      setSelectedDays([initialDayLabel]);
    }
  };

  useEffect(() => {
    handleChangeStartDate(startDate, selectedDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  useEffect(() => {
    if (onChange) {
      onChange({ startDate, endDate, timeInterval, timeUnit, selectedDays, recurrenceTypeForMonthAndYear });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, timeInterval, timeUnit, selectedDays, recurrenceTypeForMonthAndYear]);

  return (
    <View className="flex flex-col gap-4">
      <Text className="text-left">Répéter chaque</Text>
      <View className="flex flex-row gap-x-2 justify-start">
        {timeUnit !== "year" ? (
          <View className="w-32">
            <SelectCustom
              value={numbersOptions.find((o) => o.value === timeInterval)!}
              onChange={(o) => {
                handleChangeTimeUnitAndInterval(timeUnit, o.value);
                setTimeInterval(o.value);
              }}
              options={numbersOptions}
            />
          </View>
        ) : null}
        <View className="grow">
          <SelectCustom
            value={(timeInterval === 1 ? timeUnitsOptionsSingular : timeUnitsOptionsPlural).find((o) => o.value === timeUnit)!}
            onChange={(o) => {
              handleChangeTimeUnitAndInterval(o.value, timeInterval);
              setTimeUnit(o.value);
            }}
            options={timeInterval === 1 ? timeUnitsOptionsSingular : timeUnitsOptionsPlural}
          />
        </View>
      </View>
      {shouldShowDays ? (
        <View className="flex flex-row">
          {days.map((day) => (
            <Day
              key={day}
              label={day.slice(0, 1)}
              onPress={() => {
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
        </View>
      ) : null}
      {shouldShowDayRadio ? (
        <View className="flex flex-col">
          <CheckboxLabelled
            _id="recurrence-type-absolute"
            label={`Le ${dayjsInstance(startDate).format("D")} ${timeUnit === "month" ? "" : dayjsInstance(startDate).format("MMMM")}`}
            alone
            onPress={() => setRecurrenceTypeForMonthAndYear("absolute")}
            value={recurrenceTypeForMonthAndYear === "absolute"}
          />

          <CheckboxLabelled
            _id="recurrence-type-relative"
            label={`Le ${numberAsOrdinal(nthWeekdayInMonth.nth, false)} ${dayjsInstance(startDate).format("dddd")}${
              timeUnit === "month" ? "" : ` de ${dayjsInstance(startDate).format("MMMM")}`
            }`}
            alone
            onPress={() => setRecurrenceTypeForMonthAndYear("relative")}
            value={recurrenceTypeForMonthAndYear === "relative"}
          />

          {nthWeekdayInMonth.isLast ? (
            <CheckboxLabelled
              _id="recurrence-type-relative-last"
              label={`Le ${numberAsOrdinal(nthWeekdayInMonth.nth, true)} ${dayjsInstance(startDate).format("dddd")}${
                timeUnit === "month" ? "" : ` de ${dayjsInstance(startDate).format("MMMM")}`
              }`}
              alone
              onPress={() => setRecurrenceTypeForMonthAndYear("relativeLast")}
              value={recurrenceTypeForMonthAndYear === "relativeLast"}
            />
          ) : null}
        </View>
      ) : null}
      <Text className="text-stone-600 text-sm">
        {recurrenceAsText({
          startDate,
          endDate,
          timeInterval,
          timeUnit,
          selectedDays,
          nthWeekdayInMonth,
          recurrenceTypeForMonthAndYear,
        })}
      </Text>
      <View className="flex flex-col justify-start gap-y-2">
        <Text>Jusqu'au</Text>
        <View className="grow">
          <DateAndTimeInput
            date={endDate}
            // @ts-expect-error Type 'PossibleDate' is not assignable to parameter of type 'SetStateAction<Date>'.
            setDate={(value) => setEndDate(value)}
            showDay={true}
            editable={true}
            required={true}
          />
        </View>
      </View>
    </View>
  );
}
