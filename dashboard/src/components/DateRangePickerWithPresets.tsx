import { useState, useEffect, useCallback } from "react";
import OutsideClickHandler from "react-outside-click-handler";
import { dayjsInstance, dateForDatePicker } from "../services/date";
import DatePicker from "react-datepicker";
import type { Period, Preset } from "../types/date";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";

export const statsPresets: Array<Preset> = [
  {
    label: "Toutes les données",
    period: { startDate: null, endDate: null },
  },
  {
    label: "Aujourd'hui",
    period: { startDate: dayjsInstance().startOf("day"), endDate: dayjsInstance().endOf("day") },
  },
  {
    label: "Hier",
    period: { startDate: dayjsInstance().subtract(1, "day").startOf("day"), endDate: dayjsInstance().subtract(1, "day").endOf("day") },
  },
  {
    label: "Cette semaine",
    period: { startDate: dayjsInstance().startOf("week"), endDate: dayjsInstance().endOf("week") },
  },
  {
    label: "La semaine dernière",
    period: { startDate: dayjsInstance().startOf("week").subtract(1, "week"), endDate: dayjsInstance().endOf("week").subtract(1, "week") },
  },
  {
    label: "Ce mois-ci",
    period: { startDate: dayjsInstance().startOf("month"), endDate: dayjsInstance().endOf("month") },
  },
  {
    label: "Le mois dernier",
    period: { startDate: dayjsInstance().subtract(1, "month").startOf("month"), endDate: dayjsInstance().subtract(1, "month").endOf("month") },
  },
  {
    label: "Les trois derniers mois glissants",
    period: { startDate: dayjsInstance().subtract(3, "month").startOf("day"), endDate: dayjsInstance().endOf("day") },
  },
  {
    label: "Les six derniers mois glissants",
    period: { startDate: dayjsInstance().subtract(6, "month").startOf("day"), endDate: dayjsInstance().endOf("day") },
  },
  {
    label: "Ce semestre",
    period: {
      startDate: dayjsInstance().get("month") < 6 ? dayjsInstance().startOf("year") : dayjsInstance().startOf("year").add(6, "month"),
      endDate: dayjsInstance().get("month") < 6 ? dayjsInstance().startOf("year").add(5, "month").endOf("month") : dayjsInstance().endOf("year"),
    },
  },
  {
    label: "Le dernier semestre",
    period: {
      startDate:
        dayjsInstance().get("month") < 6 ? dayjsInstance().subtract(1, "year").startOf("year").add(6, "month") : dayjsInstance().startOf("year"),
      endDate:
        dayjsInstance().get("month") < 6
          ? dayjsInstance().subtract(1, "year").endOf("year")
          : dayjsInstance().startOf("year").add(5, "month").endOf("month"),
    },
  },
  {
    label: "Cette année",
    period: { startDate: dayjsInstance().startOf("year"), endDate: dayjsInstance().endOf("year") },
  },
  {
    label: "L'année dernière",
    period: { startDate: dayjsInstance().subtract(1, "year").startOf("year"), endDate: dayjsInstance().subtract(1, "year").endOf("year") },
  },
];

if (import.meta.env.VITE_TEST_PLAYWRIGHT) {
  statsPresets.push({
    label: "2020",
    period: { startDate: dayjsInstance("2020-01-01").startOf("day"), endDate: dayjsInstance("2020-12-31").endOf("day") },
  });
  statsPresets.push({
    label: "2021",
    period: { startDate: dayjsInstance("2021-01-01").startOf("day"), endDate: dayjsInstance("2021-12-31").endOf("day") },
  });
}

export const reportsPresets: Array<Preset> = [
  {
    label: "Aujourd'hui",
    period: { startDate: dayjsInstance().startOf("day"), endDate: dayjsInstance().endOf("day") },
  },
  {
    label: "Hier",
    period: { startDate: dayjsInstance().subtract(1, "day").startOf("day"), endDate: dayjsInstance().subtract(1, "day").endOf("day") },
  },
  {
    label: "Cette semaine",
    period: { startDate: dayjsInstance().startOf("week"), endDate: dayjsInstance().endOf("week") },
  },
  {
    label: "La semaine dernière",
    period: { startDate: dayjsInstance().startOf("week").subtract(1, "week"), endDate: dayjsInstance().endOf("week").subtract(1, "week") },
  },
  {
    label: "Ce mois-ci",
    period: { startDate: dayjsInstance().startOf("month"), endDate: dayjsInstance().endOf("month") },
  },
  {
    label: "Le mois dernier",
    period: { startDate: dayjsInstance().subtract(1, "month").startOf("month"), endDate: dayjsInstance().subtract(1, "month").endOf("month") },
  },
];

export const formatPeriod = ({ preset, period }: { preset: string | null; period: Period }): string => {
  if (preset) return preset;
  if (!!period.startDate && !!period.endDate) {
    const startFormatted = dayjsInstance(period.startDate).format("D MMM YYYY");
    const endFormatted = dayjsInstance(period.endDate).format("D MMM YYYY");
    if (startFormatted === endFormatted) return startFormatted;
    return `Du ${startFormatted} au ${endFormatted}`;
  }
  return `Entre... et le...`;
};

// https://reactdatepicker.com/#example-date-range
const DateRangePickerWithPresets = ({ period, setPeriod, preset, setPreset, removePreset, presets, defaultPreset, isStatsV2 = false }) => {
  const [showDatePicker, setShowDatepicker] = useState(false);
  const [numberOfMonths, setNumberOfMonths] = useState(() => (window.innerWidth < 1100 ? 1 : 2));

  const handleWindowResize = useCallback(() => {
    setNumberOfMonths(window.innerWidth < 1100 ? 1 : 2);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  });

  useEffect(() => {
    // we need to reset the period everyday, because
    // if today is 2023-06-23, the period "Aujourd'hui" will be set to 2023-06-23
    // but on the day after, the period "Aujourd'hui" will be kept to 2023-06-23
    // so the user will see "Aujourd'hui" but the period will actually be yesterday
    // so we need to reset the period everyday
    const dateOnWhichThePeriodWasSetByTheUser = window.localStorage.getItem("user-set-the-period-on-date");
    if (dateOnWhichThePeriodWasSetByTheUser !== dayjsInstance().format("YYYY-MM-DD")) {
      if (defaultPreset) {
        setPreset(defaultPreset.label);
        setPeriod({
          startDate: dateForDatePicker(defaultPreset.period.startDate, "start"),
          endDate: dateForDatePicker(defaultPreset.period.endDate, "end"),
        });
      } else {
        setPeriod({ startDate: null, endDate: null });
        removePreset();
      }
      window.localStorage.setItem("user-set-the-period-on-date", dayjsInstance().format("YYYY-MM-DD"));
    }
  });

  const openDatePicker = (event: any) => {
    if (showDatePicker) return event.preventDefault();
    setShowDatepicker(true);
  };

  const [localStartDate, setLocalStartDate] = useState(null);
  const onChange = (dates: [Date, Date]) => {
    const [startDate, endDate] = dates;
    // to prevent big calculations in parent component when only startDate is selected
    // we just save the startDate in local state, waiting for the endDate
    if (!endDate) return setLocalStartDate(startDate);
    setLocalStartDate(null);
    setPeriod({
      startDate: dateForDatePicker(startDate, "start"),
      endDate: dateForDatePicker(endDate, "end"),
    });
    removePreset();
  };

  const closeDatePicker = () => {
    setShowDatepicker(false);
  };

  const setPresetRequest = (preset) => {
    setPreset(preset.label);
    setPeriod({
      startDate: dateForDatePicker(preset.period.startDate, "start"),
      endDate: dateForDatePicker(preset.period.endDate, "end"),
    });
    closeDatePicker();
  };

  return (
    <div className={`noprint tw-relative ${isStatsV2 ? "tw-min-w-0" : "tw-min-w-[15rem]"}`}>
      {isStatsV2 ? (
        <button
          type="button"
          className="button-classic !tw-ml-0 !tw-font-normal !tw-px-3 tw-flex tw-items-center tw-gap-2 tw-whitespace-nowrap"
          onClick={openDatePicker}
        >
          <CalendarDaysIcon className="tw-w-4 tw-h-4" />
          {formatPeriod({ preset, period })}
        </button>
      ) : (
        <button
          type="button"
          className="tw-min-w-[15rem] tw-rounded-lg tw-border tw-border-gray-300 tw-bg-transparent tw-px-4 tw-py-1 tw-shadow-none"
          onClick={openDatePicker}
        >
          {formatPeriod({ preset, period })}
        </button>
      )}
      {!!showDatePicker && (
        <OutsideClickHandler onOutsideClick={closeDatePicker}>
          <div
            className={`stats-datepicker tw-absolute tw-top-12 ${isStatsV2 ? "-tw-right-56" : "tw-left-0"} tw-z-20 tw-flex tw-flex-nowrap tw-items-center tw-justify-end tw-overflow-x-auto tw-rounded-lg tw-border tw-border-gray-300 tw-bg-white tw-pl-56 lg:tw-min-w-[45rem]`}
          >
            <div className="tw-absolute tw-bottom-0 tw-left-0 tw-top-0 tw-ml-2 tw-box-border tw-flex tw-max-h-full tw-w-56 tw-flex-1 tw-flex-col tw-items-start tw-justify-start tw-overflow-y-scroll">
              {presets.map((p) => (
                <button
                  type="button"
                  className={`tw-w-full tw-rounded-lg tw-border-0 tw-bg-white tw-p-1 hover:tw-bg-main25 ${isStatsV2 ? "tw-text-sm tw-text-left" : "tw-text-center"}`}
                  key={p.label}
                  onClick={() => setPresetRequest(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <DatePicker
              monthsShown={numberOfMonths}
              selectsRange
              inline
              locale="fr"
              name="date"
              selected={dateForDatePicker(localStartDate || period.startDate, "start")}
              onChange={onChange}
              startDate={dateForDatePicker(localStartDate || period.startDate, "start")}
              endDate={dateForDatePicker(localStartDate ? null : period.endDate, "end")}
            />
          </div>
        </OutsideClickHandler>
      )}
    </div>
  );
};

export default DateRangePickerWithPresets;
