import React, { useMemo } from "react";
import { dayjsInstance, formatDateTimeWithNameOfDay, formatDateWithNameOfDay, formatDuration } from "../services/date";
import HelpButtonAndModal from "./HelpButtonAndModal";
import UserName from "./UserName";
import { selector, selectorFamily, useRecoilValue } from "recoil";
import { personFieldsIncludingCustomFieldsSelector } from "../recoil/persons";
import { customFieldsMedicalFileSelector } from "../recoil/medicalFiles";
import { LineChart } from "../scenes/person/components/Constantes";

const showBoolean = (value) => {
  if (value === null) return "";
  if (value === undefined) return "";
  if (!value) return "";
  return "Oui";
};

export default function CustomFieldDisplay({ type, value, name = null, person = null }) {
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
          <ul className="tw-list-disc tw-pl-4">
            {value.map((v) => (
              <li key={v}>
                <span className="tw-overflow-ellipsis tw-break-words">{v || "-"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tw-overflow-ellipsis tw-break-words">{String(value || "-")}</p>
        ))}
      {name && <FieldHistory name={name} person={person} />}
    </div>
  );
}

const allPossibleFieldsSelector = selector({
  key: "allPossibleFieldsSelector",
  get: ({ get }) => {
    const personFieldsIncludingCustomFields = get(personFieldsIncludingCustomFieldsSelector);
    const customFieldsMedicalFile = get(customFieldsMedicalFileSelector);
    const allPossibleFields = [
      ...personFieldsIncludingCustomFields.map((f) => ({ ...f, isMedicalFile: false })),
      ...customFieldsMedicalFile.map((f) => ({ ...f, isMedicalFile: true })),
    ];
    return allPossibleFields;
  },
});

const personFieldSelector = selectorFamily({
  key: "personFieldSelector",
  get:
    ({ name }) =>
    ({ get }) => {
      const allPossibleFields = get(allPossibleFieldsSelector);
      const personField = allPossibleFields.find((f) => f.name === name);
      return personField;
    },
});

function FieldHistory({ name = null, person = null }) {
  const [calendarDayCreatedAt, timeCreatedAt] = dayjsInstance(person?.createdAt).format("DD/MM/YYYY HH:mm").split(" ");
  const personField = useRecoilValue(personFieldSelector({ name }));
  const fieldHistory = useMemo(() => {
    const _fieldHistory = [];
    if (!person?.history?.length) return _fieldHistory;
    if (personField?.type === "number" && person.history.filter((h) => h.data[name]).length > 1) {
      // return [
      //   { x: "2024-12-14", y: 10 },
      //   { x: "2024-12-07", y: 20 },
      //   { x: "2024-12-01", y: 30 },
      //   { x: "2024-11-28", y: 35 },
      //   { x: "2024-11-21", y: 40 },
      //   { x: "2024-11-14", y: 30 },
      // ];
      for (const historyItem of person.history) {
        if (historyItem.data[name]) {
          _fieldHistory.push({ x: dayjsInstance(historyItem.date).format("YYYY-MM-DD"), y: historyItem.data[name].newValue });
        }
      }
      return _fieldHistory.sort((a, b) => (a.x > b.x ? 1 : -1));
    } else {
      for (const historyItem of person.history) {
        if (historyItem.data[name]) {
          _fieldHistory.push(historyItem);
        }
      }
      return _fieldHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
  }, [person?.history, name, personField?.type]);

  if (!name || !fieldHistory?.length) return null;

  return (
    <div className="tw-absolute -tw-top-6 tw-right-4 tw-z-10">
      <HelpButtonAndModal title={`Historique du champ ${personField?.label}`} size="3xl">
        {personField?.type === "number" && fieldHistory?.length > 1 ? (
          <LineChart data={fieldHistory} name={personField?.label} scheme="set1" unit="" />
        ) : (
          <table className="table table-striped table-bordered">
            <thead>
              <tr className="tw-cursor-default">
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Valeur</th>
              </tr>
            </thead>
            <tbody className="small">
              {fieldHistory.map((historyItem) => {
                const [calendarDay, time] = dayjsInstance(historyItem.date).format("DD/MM/YYYY HH:mm").split(" ");
                return (
                  <tr key={historyItem.date} className="tw-cursor-default">
                    <td>
                      <span>{calendarDay}</span>
                      <span className="tw-ml-4">{time}</span>
                    </td>
                    <td>
                      <UserName id={historyItem.user} name={historyItem.userName} />
                    </td>
                    <td className="tw-max-w-prose">
                      {Object.entries(historyItem.data).map(([key, value]) => {
                        if (key !== name) return null;
                        return (
                          <p key={key} data-test-id={`${personField?.label || "Champs personnalisé supprimé"}: ➔ ${JSON.stringify(value.newValue)}`}>
                            <code className={personField?.isMedicalFile ? "tw-text-blue-900" : "tw-text-main"}>{JSON.stringify(value.newValue)}</code>
                          </p>
                        );
                      })}
                    </td>
                  </tr>
                );
              })}
              {person?.createdAt && (
                <tr key={person.createdAt} className="tw-cursor-default">
                  <td>
                    <span>{calendarDayCreatedAt}</span>
                    <span className="tw-ml-4">{timeCreatedAt}</span>
                  </td>
                  <td>
                    <UserName id={person.user} />
                  </td>
                  <td className="tw-max-w-prose">
                    <p>Création de la personne</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </HelpButtonAndModal>
    </div>
  );
}
