import React, { useMemo } from "react";
import { dayjsInstance, formatDateTimeWithNameOfDay, formatDateWithNameOfDay, formatDuration } from "../services/date";
import { TimeModalButton } from "./HelpButtonAndModal";
import UserName from "./UserName";
import { atom, useAtomValue } from "jotai";
import { personFieldsIncludingCustomFieldsSelector } from "../recoil/persons";
import { customFieldsMedicalFileSelector } from "../recoil/medicalFiles";
import { LineChart } from "../scenes/person/components/Constantes";

const showBoolean = (value) => {
  if (value === null) return "";
  if (value === undefined) return "";
  if (!value) return "";
  return "Oui";
};

export default function CustomFieldDisplay({ type, value, name = null, showHistory = false, person = null }) {
  if (value === undefined || value === null) return <span className="tw-text-gray-300">Non renseigné</span>;
  return (
    <div className="tw-flex tw-gap-2 tw-relative">
      {!!["text", "number"].includes(type) && <span>{value}</span>}
      {!!["textarea"].includes(type) && (
        <p className="tw-mb-0">
          {value?.split?.("\n")?.map((sentence, index) => (
            <React.Fragment key={sentence + index}>
              {sentence}
              <br />
            </React.Fragment>
          ))}
        </p>
      )}
      {!!["date-with-time"].includes(type) && !!value && <span>{formatDateTimeWithNameOfDay(value)}</span>}
      {!!["date"].includes(type) && !!value && <span>{formatDateWithNameOfDay(value)}</span>}
      {!!["duration"].includes(type) && !!value && (
        <span>
          {formatDuration(value)} ({dayjsInstance(value).format("DD/MM/YYYY")})
        </span>
      )}
      {!!["boolean"].includes(type) && <span>{showBoolean(value)}</span>}
      {!!["yes-no"].includes(type) && <span>{value}</span>}
      {!!["enum"].includes(type) && <span>{value}</span>}
      {!!["multi-choice"].includes(type) &&
        (Array.isArray(value) ? (
          <ul className="tw-list-disc tw-pl-4 tw-mb-0">
            {value.map((v) => (
              <li key={v}>
                <span className="tw-overflow-ellipsis [overflow-wrap:anywhere]">{v || "-"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tw-overflow-ellipsis tw-break-words">{String(value || "-")}</p>
        ))}
      {name && showHistory && <FieldHistory name={name} person={person} />}
    </div>
  );
}

const allPossibleFieldsSelector = atom((get) => {
  const personFieldsIncludingCustomFields = get(personFieldsIncludingCustomFieldsSelector);
  const customFieldsMedicalFile = get(customFieldsMedicalFileSelector);
  const allPossibleFields = [
    ...personFieldsIncludingCustomFields.map((f) => ({ ...f, isMedicalFile: false })),
    ...customFieldsMedicalFile.map((f) => ({ ...f, isMedicalFile: true })),
  ];
  return allPossibleFields;
});

// Hook to get a person field by name (replaces selectorFamily pattern)
function usePersonField(name) {
  const allPossibleFields = useAtomValue(allPossibleFieldsSelector);
  return useMemo(() => allPossibleFields.find((f) => f.name === name), [allPossibleFields, name]);
}

function FieldHistory({ name = null, person = null }) {
  const [calendarDayCreatedAt, timeCreatedAt] = dayjsInstance(person?.createdAt).format("DD/MM/YYYY HH:mm").split(" ");
  const personField = usePersonField(name);
  const fieldHistory = useMemo(() => {
    const _fieldHistory = [];
    // Get the appropriate history based on whether it's a medical file field
    const historySource = personField?.isMedicalFile ? person?.medicalFile?.history : person?.history;
    if (!historySource?.length) return _fieldHistory;
    if (personField?.type === "number" && historySource.filter((h) => h.data[name]).length > 1) {
      // return [
      //   { x: "2024-12-14", y: 10 },
      //   { x: "2024-12-07", y: 20 },
      //   { x: "2024-12-01", y: 30 },
      //   { x: "2024-11-28", y: 35 },
      //   { x: "2024-11-21", y: 40 },
      //   { x: "2024-11-14", y: 30 },
      // ];
      for (const historyItem of historySource) {
        const newValue = historyItem.data[name]?.newValue;
        if (newValue === undefined || newValue === null) continue;
        _fieldHistory.push({
          x: dayjsInstance(historyItem.date).toISOString(),
          y: newValue,
        });
      }
      return _fieldHistory;
    }
    for (const historyItem of historySource) {
      const newValue = historyItem.data[name]?.newValue;
      const oldValue = historyItem.data[name]?.oldValue;
      const [calendarDay, time] = dayjsInstance(historyItem.date).format("DD/MM/YYYY HH:mm").split(" ");
      if (newValue === undefined && oldValue === undefined) continue;
      _fieldHistory.push({
        calendarDay,
        time,
        newValue,
        oldValue,
        user: historyItem.user,
      });
    }
    return _fieldHistory;
  }, [personField?.isMedicalFile, personField?.type, person?.medicalFile?.history, person?.history, name]);

  if (!fieldHistory.length) return null;
  if (personField?.type === "number" && fieldHistory.length > 1) {
    return <LineChart data={fieldHistory} label={personField?.label} />;
  }
  return (
    <TimeModalButton
      title={`Historique du champ ${personField?.label}`}
      help={() => (
        <table className="tw-table-auto tw-overflow-auto tw-border-separate tw-border-spacing-2">
          <thead>
            <tr>
              <th className="tw-text-left">Date</th>
              <th className="tw-text-left">Heure</th>
              <th className="tw-text-left">Valeur</th>
              <th className="tw-text-left">Ancienne valeur</th>
              <th className="tw-text-left">Utilisateur</th>
            </tr>
          </thead>
          <tbody className="">
            {fieldHistory.map((historyItem, index) => (
              <tr key={index}>
                <td className="tw-text-left tw-whitespace-nowrap">{historyItem.calendarDay}</td>
                <td className="tw-text-left tw-whitespace-nowrap">{historyItem.time}</td>
                <td className="tw-text-left">
                  <CustomFieldDisplay type={personField?.type} value={historyItem.newValue} />
                </td>
                <td className="tw-text-left">
                  <CustomFieldDisplay type={personField?.type} value={historyItem.oldValue} />
                </td>
                <td className="tw-text-left">
                  <UserName id={historyItem.user} />
                </td>
              </tr>
            ))}
            {!!person?.createdAt && (
              <tr>
                <td className="tw-text-left tw-whitespace-nowrap tw-font-semibold">{calendarDayCreatedAt}</td>
                <td className="tw-text-left tw-whitespace-nowrap tw-font-semibold">{timeCreatedAt}</td>
                <td className="tw-text-left tw-font-semibold" colSpan={3}>
                  Création du dossier
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    />
  );
}
