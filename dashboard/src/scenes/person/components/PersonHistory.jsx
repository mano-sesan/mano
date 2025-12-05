import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { deletedUsersState, teamsState, userState, usersState } from "../../../recoil/auth";
import { personFieldsIncludingCustomFieldsSelector } from "../../../recoil/persons";
import { formatDateWithFullMonth, dayjsInstance } from "../../../services/date";
import { customFieldsMedicalFileSelector } from "../../../recoil/medicalFiles";
import { cleanHistory } from "../../../utils/person-history";
import PersonTeamHistory from "./PersonTeamHistory";

function UserName({ id, name }) {
  const users = useAtomValue(usersState);
  const deletedUsers = useAtomValue(deletedUsersState);

  const user = users.find((u) => u._id === id) || deletedUsers.find((u) => u._id === id);
  if (user) return user.name || "Utilisateur sans nom";
  else if (name) return name;
  else return "-";
}

export default function PersonHistory({ person }) {
  const teams = useAtomValue(teamsState);
  const personFieldsIncludingCustomFields = useAtomValue(personFieldsIncludingCustomFieldsSelector);
  const customFieldsMedicalFile = useAtomValue(customFieldsMedicalFileSelector);
  const allPossibleFields = [
    ...personFieldsIncludingCustomFields.map((f) => ({ ...f, isMedicalFile: false })),
    ...customFieldsMedicalFile.map((f) => ({ ...f, isMedicalFile: true })),
  ];
  const user = useAtomValue(userState);
  const users = useAtomValue(usersState);
  const deletedUsers = useAtomValue(deletedUsersState);
  const history = useMemo(() => {
    const personHistory = cleanHistory(person.history || []);
    if (!user.healthcareProfessional) return personHistory.reverse();
    const medicalFileHistory = person.medicalFile?.history || [];
    return cleanHistory([...personHistory, ...medicalFileHistory]).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [person.history, person.medicalFile?.history, user.healthcareProfessional]);
  const [calendarDayCreatedAt, timeCreatedAt] = dayjsInstance(person.createdAt).format("DD/MM/YYYY HH:mm").split(" ");

  const exportHistory = () => {
    const enrichedHistory = history.map((h) => {
      const historyUser = users.find((u) => u._id === h.user) || deletedUsers.find((u) => u._id === h.user);
      return {
        date: h.date,
        user: historyUser?.name || h.userName || "Unknown",
        userId: h.user,
        data: h.data,
      };
    });

    const exportData = {
      personId: person._id,
      personName: person.name,
      createdAt: person.createdAt,
      createdBy: (() => {
        const creator = users.find((u) => u._id === person.user) || deletedUsers.find((u) => u._id === person.user);
        return creator?.name || "Unknown";
      })(),
      history: enrichedHistory,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `history-${person.name || person._id}-${dayjsInstance().format("YYYY-MM-DD-HHmm")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PersonTeamHistory person={person} history={history} teams={teams} />
      <div className="tw-my-10 tw-flex tw-items-center tw-gap-2">
        <h3 className="tw-mb-0 tw-flex tw-items-center tw-gap-5 tw-text-xl tw-font-extrabold">Historique</h3>
      </div>
      <table className="table table-striped table-bordered">
        <thead>
          <tr className="tw-cursor-default">
            <th>Date</th>
            <th>Utilisateur</th>
            <th>Donnée</th>
          </tr>
        </thead>
        <tbody className="small">
          {history.map((h) => {
            const [calendarDay, time] = dayjsInstance(h.date).format("DD/MM/YYYY HH:mm").split(" ");
            return (
              <tr key={h.date} className="tw-cursor-default">
                <td>
                  <span>{calendarDay}</span>
                  <span className="tw-ml-4">{time}</span>
                </td>
                <td>
                  <UserName id={h.user} name={h.userName} />
                </td>
                <td className="tw-max-w-prose">
                  {Object.entries(h.data).map(([key, value]) => {
                    const personField = allPossibleFields.find((f) => f.name === key);
                    if (key === "merge") {
                      return (
                        <p className="tw-flex tw-flex-col" key={key}>
                          <span>
                            Fusion avec : <code>"{value.name}"</code>
                          </span>
                          <small className="tw-opacity-30">
                            Identifiant: <code>"{value._id}"</code>
                          </small>
                        </p>
                      );
                    }
                    if (key === "assignedTeams") {
                      return (
                        <p className="tw-flex tw-flex-col" key={key}>
                          <span>{personField?.label} : </span>
                          <code className="tw-text-main">
                            "{(value.oldValue || []).map((teamId) => teams.find((t) => t._id === teamId)?.name).join(", ")}"
                          </code>
                          <span>↓</span>
                          <code className="tw-text-main">
                            "{(value.newValue || []).map((teamId) => teams.find((t) => t._id === teamId)?.name).join(", ")}"
                          </code>
                        </p>
                      );
                    }
                    if (key === "outOfActiveListReasons") {
                      if (!value.newValue.length) return null;
                      return (
                        <p className="tw-flex tw-flex-col" key={key}>
                          <span>{personField?.label}: </span>
                          <code className="tw-text-main">{value.newValue.join(", ")}</code>
                        </p>
                      );
                    }
                    if (key === "outOfActiveList") {
                      return (
                        <p className="tw-flex tw-flex-col" key={key}>
                          <span className="tw-text-main">
                            {value.newValue === true ? "Sortie de file active" : "Réintégration dans la file active"}
                          </span>
                        </p>
                      );
                    }
                    if (key === "outOfActiveListDate") {
                      if (!value.newValue) return null;
                      return (
                        <p className="tw-flex tw-flex-col" key={key}>
                          <span className="tw-text-main">{formatDateWithFullMonth(value.newValue)}</span>
                        </p>
                      );
                    }
                    if (key === "outOfTeamsInformations") {
                      if (!Array.isArray(value)) return null;
                      return (
                        <p className="tw-flex tw-flex-col" key={key}>
                          Motifs de sortie d'équipe :{" "}
                          {value.map(({ team, reasons }) => {
                            return (
                              <code className="tw-text-main" key={team}>
                                {teams.find((t) => t._id === team)?.name} : {reasons.join(", ") || "Non renseigné"}
                              </code>
                            );
                          })}
                        </p>
                      );
                    }

                    return (
                      <p
                        key={key}
                        data-test-id={`${personField?.label || "Champs personnalisé supprimé"}: ${JSON.stringify(
                          value.oldValue || ""
                        )} ➔ ${JSON.stringify(value.newValue)}`}
                      >
                        <span className="tw-inline-flex tw-w-full tw-items-center tw-justify-between">
                          {personField?.label || "Champs personnalisé supprimé"} :
                          {personField?.isMedicalFile && <i className="tw-text-xs"> Dossier médical</i>}
                        </span>
                        <br />
                        <code className={personField?.isMedicalFile ? "tw-text-blue-900" : "tw-text-main"}>
                          {JSON.stringify(value.oldValue || "")}
                        </code>{" "}
                        ➔ <code className={personField?.isMedicalFile ? "tw-text-blue-900" : "tw-text-main"}>{JSON.stringify(value.newValue)}</code>
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
      <div className="tw-mt-4 tw-flex tw-justify-end">
        <button type="button" className="button-submit" onClick={exportHistory}>
          Exporter l'historique
        </button>
      </div>
    </div>
  );
}
