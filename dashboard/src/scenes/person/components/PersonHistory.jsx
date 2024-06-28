import { useMemo } from "react";
import { useRecoilValue } from "recoil";
import { teamsState, userState, usersState } from "../../../recoil/auth";
import { personFieldsIncludingCustomFieldsSelector } from "../../../recoil/persons";
import { formatDateWithFullMonth, dayjsInstance } from "../../../services/date";
import { customFieldsMedicalFileSelector } from "../../../recoil/medicalFiles";
import { cleanHistory } from "../../../utils/person-history";
import { borderColors, teamsColors } from "../../../components/TagTeam";

function getTeamHistory(changes, creationDate) {
  const teamHistory = {};
  const result = [];

  // Filtrer les entrées avec assignedTeams
  changes = changes.filter((change) => change.data && change.data.assignedTeams);

  // Trier les changements par date
  changes.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Déterminer l'état initial à partir de la première entrée
  if (changes.length > 0) {
    const initialTeams = changes[0].data.assignedTeams.oldValue;
    console.log("initialTeams", initialTeams, changes);
    initialTeams.forEach((team) => {
      teamHistory[team] = { startDate: creationDate, endDate: null };
    });
  }

  changes.forEach((change) => {
    const date = change.date;
    const oldTeams = change.data.assignedTeams.oldValue;
    const newTeams = change.data.assignedTeams.newValue;

    // Déterminer les équipes quittées
    oldTeams.forEach((team) => {
      if (!newTeams.includes(team)) {
        if (teamHistory[team] && !teamHistory[team].endDate) {
          teamHistory[team].endDate = date;
          result.push({ team, startDate: teamHistory[team].startDate, endDate: new Date(date).toISOString() });
          delete teamHistory[team];
        }
      }
    });

    // Déterminer les équipes rejointes
    newTeams.forEach((team) => {
      if (!oldTeams.includes(team)) {
        if (!teamHistory[team]) {
          teamHistory[team] = { startDate: date, endDate: null };
        }
      }
    });
  });

  // Date actuelle
  const today = new Date().toISOString();

  // Fermer les périodes ouvertes pour les équipes toujours actives
  for (const team in teamHistory) {
    if (teamHistory[team].startDate && !teamHistory[team].endDate) {
      result.push({ team, startDate: teamHistory[team].startDate, endDate: today });
    }
  }

  return result;
}

// Exemple d'utilisation
const changes = [
  { date: "2022-01-01", data: { assignedTeams: { oldValue: [], newValue: ["team1", "team2"] } } },
  { date: "2022-03-01", data: { assignedTeams: { oldValue: ["team1", "team2"], newValue: ["team1"] } } },
  { date: "2022-06-01", data: { assignedTeams: { oldValue: ["team1"], newValue: ["team1", "team3"] } } },
  { date: "2022-09-01", data: { assignedTeams: { oldValue: ["team1", "team3"], newValue: ["team3"] } } },
];

console.log(getTeamHistory(changes));

const GanttChart = ({ data, teams }) => {
  // Calcule la date de début et de fin globales
  const globalStartDate = new Date(Math.min(...data.map((item) => new Date(item.startDate))));
  const globalEndDate = new Date(Math.max(...data.map((item) => new Date(item.endDate))));
  const totalDuration = (globalEndDate - globalStartDate) / (1000 * 60 * 60 * 24); // en jours

  // Calcule la largeur et la position en fonction de la durée globale
  const calculatePosition = (startDate, endDate, totalWidth) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startOffset = (start - globalStartDate) / (1000 * 60 * 60 * 24); // en jours
    const duration = (end - start) / (1000 * 60 * 60 * 24); // en jours
    const width = (duration / totalDuration) * totalWidth;
    const position = (startOffset / totalDuration) * totalWidth;
    return { width, position };
  };

  // Grouper les éléments par équipe
  const groupedData = data.reduce((acc, item) => {
    if (!acc[item.team]) {
      acc[item.team] = [];
    }
    acc[item.team].push(item);
    return acc;
  }, {});

  // Créer une liste de données pour affichage en conservant les équipes sur la même ligne
  const dataForDisplay = [];
  let lineIndex = 0;

  for (const teamId in groupedData) {
    let found = false;
    groupedData[teamId].forEach((item) => {
      const teamIndex = teams?.findIndex((t) => t._id === item.team);
      const { width, position } = calculatePosition(item.startDate, item.endDate, 800); // 800 pour une largeur totale arbitraire
      if (width < 1) return; // Ne pas afficher les éléments trop courts (1px minimum
      found = true;
      dataForDisplay.push({
        ...item,
        width,
        position,
        top: lineIndex * 38, // Position verticale basée sur la ligne de l'équipe
        backgroundColor: teamsColors[teamIndex % teamsColors?.length],
        borderColor: borderColors[teamIndex % borderColors?.length],
      });
    });
    if (found) lineIndex++;
  }

  return (
    <div className="tw-border tw-border-gray-200 tw-rounded-lg tw-shadow tw-overflow-x-auto tw-overflow-y-hidden tw-p-2 tw-max-w-[824px] tw-mx-auto">
      <h3 className="tw-my-2 tw-text-lg tw-font-semibold">
        Mouvements d'équipe du {dayjsInstance(globalStartDate).format("DD/MM/YY")} au {dayjsInstance(globalEndDate).format("DD/MM/YY")}
      </h3>
      <div className="tw-relative tw-w-[800px] tw-overflow-hidden" style={{ height: `${lineIndex * 38}px` }}>
        {dataForDisplay.map((item, index) => {
          return (
            <div
              key={index}
              className="tw-absolute tw-h-8 tw-flex tw-flex-col tw-items-start"
              style={{
                width: `${item.width}px`,
                left: `${item.position}px`,
                top: `${item.top}px`,
                backgroundColor: item.backgroundColor,
                borderColor: item.borderColor,
              }}
            >
              <div className="text-white tw-text-xs tw-font-semibold tw-truncate tw-pl-1">{teams.find((t) => t._id === item.team)?.name}</div>
              <div className="text-white tw-text-xs tw-truncate tw-pl-1">
                {dayjsInstance(item.startDate).format("DD/MM/YY")} au {dayjsInstance(item.endDate).format("DD/MM/YY")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function UserName({ id, name }) {
  const users = useRecoilValue(usersState);
  const user = users.find((u) => u._id === id);
  if (user) return user.name || "Utilisateur sans nom";
  else if (name) return name + " (utilisateur supprimé)";
  else return "Utilisateur supprimé";
}

export default function PersonHistory({ person }) {
  const teams = useRecoilValue(teamsState);
  const personFieldsIncludingCustomFields = useRecoilValue(personFieldsIncludingCustomFieldsSelector);
  const customFieldsMedicalFile = useRecoilValue(customFieldsMedicalFileSelector);
  const allPossibleFields = [
    ...personFieldsIncludingCustomFields.map((f) => ({ ...f, isMedicalFile: false })),
    ...customFieldsMedicalFile.map((f) => ({ ...f, isMedicalFile: true })),
  ];
  const user = useRecoilValue(userState);
  const history = useMemo(() => {
    const personHistory = cleanHistory(person.history || []);
    if (!user.healthcareProfessional) return personHistory.reverse();
    const medicalFileHistory = person.medicalFile?.history || [];
    return cleanHistory([...personHistory, ...medicalFileHistory]).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [person.history, person.medicalFile?.history, user.healthcareProfessional]);

  /*
  const data = [
    { team: "Team A", startDate: "2023-06-01", endDate: "2023-06-10" },
    { team: "Team B", startDate: "2023-06-05", endDate: "2023-06-15" },
    { team: "Team C", startDate: "2023-06-12", endDate: "2023-10-20" },
    // Ajoutez plus de données ici
  ];
  */

  let data = [];

  try {
    data = getTeamHistory(history, person.createdAt);
    console.log(data);
  } catch (error) {
    console.error(error);
  }

  return (
    <div>
      <GanttChart data={data} teams={teams} />
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
            return (
              <tr key={h.date} className="tw-cursor-default">
                <td>{dayjsInstance(h.date).format("DD/MM/YYYY HH:mm")}</td>
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
              <td>{dayjsInstance(person.createdAt).format("DD/MM/YYYY HH:mm")}</td>
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
    </div>
  );
}
