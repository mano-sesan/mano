import { formatDateWithFullMonth, dayjsInstance } from "../../../services/date";
import { borderColors, teamsColors } from "../../../components/TagTeam";
import { TeamInstance } from "../../../types/team";
import { PersonHistoryEntry, PersonInstance, FieldChangeData } from "../../../types/person";

interface TeamHistorySlice {
  team: string;
  startDate: string | Date;
  endDate: string | Date;
}

function getPersonTeamHistory(changes: Array<PersonHistoryEntry>, creationDate: string | Date): Array<TeamHistorySlice> {
  const teamHistory = {};
  const result: Array<TeamHistorySlice> = [];

  changes = changes.filter((change) => change.data && (change.data as FieldChangeData).assignedTeams);
  changes.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (changes.length === 0) return [];

  if (changes.length > 0) {
    const initialTeams = (changes[0].data as FieldChangeData).assignedTeams.oldValue || [];
    for (const team of initialTeams) {
      teamHistory[team] = { startDate: creationDate, endDate: null };
    }
  }

  for (const change of changes) {
    const date = change.date;
    const oldTeams = ((change.data as FieldChangeData).assignedTeams.oldValue || []) as Array<TeamInstance["_id"]>;
    const newTeams = ((change.data as FieldChangeData).assignedTeams.newValue || []) as Array<TeamInstance["_id"]>;

    // Équipes quittées
    for (const team of oldTeams) {
      if (!newTeams.includes(team)) {
        if (teamHistory[team] && !teamHistory[team].endDate) {
          result.push({ team, startDate: teamHistory[team].startDate, endDate: new Date(date).toISOString() });
          delete teamHistory[team];
        }
      }
    }

    // Équipes rejointes
    for (const team of newTeams) {
      if (!oldTeams.includes(team)) {
        if (!teamHistory[team]) {
          teamHistory[team] = { startDate: date, endDate: null };
        }
      }
    }
  }

  // Fermer les périodes ouvertes pour les équipes toujours actives
  const today = new Date().toISOString();
  for (const team in teamHistory) {
    if (teamHistory[team].startDate && !teamHistory[team].endDate) {
      result.push({ team, startDate: teamHistory[team].startDate, endDate: today });
    }
  }

  return result;
}

const GanttChart = ({ data, teams }: { data: Array<TeamHistorySlice>; teams: Array<TeamInstance> }) => {
  const globalStartDate = new Date(Math.min(...data.map((item) => new Date(item.startDate).getTime())));
  const globalEndDate = new Date(Math.max(...data.map((item) => new Date(item.endDate).getTime())));
  const totalDuration = globalEndDate.getTime() - globalStartDate.getTime();

  const calculatePosition = (startDate, endDate) => {
    const totalWidth = 800;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startOffset = start.getTime() - globalStartDate.getTime();
    const duration = end.getTime() - start.getTime();
    const width = (duration / totalDuration) * totalWidth;
    const position = (startOffset / totalDuration) * totalWidth;
    return { width, position };
  };

  const skippedItems: Array<TeamHistorySlice> = [];
  const groupedData = data.reduce((acc, item) => {
    const { width, position } = calculatePosition(item.startDate, item.endDate);
    // Ne pas afficher les éléments trop courts (10px minimum)
    if (width < 10) {
      skippedItems.push(item);
      return acc;
    }
    if (!acc[item.team]) {
      acc[item.team] = [];
    }
    const teamIndex = teams.findIndex((t) => t._id === item.team);
    acc[item.team].push({
      ...item,
      width,
      position,
      backgroundColor: teamsColors[teamIndex % teamsColors.length],
      borderColor: borderColors[teamIndex % borderColors.length],
    });

    return acc;
  }, {});

  const sortedGroupedData = Object.values<Array<TeamHistorySlice>>(groupedData).sort((v: Array<TeamHistorySlice>) => {
    const oldestStartDateA = Math.min(...v.map((item) => new Date(item.startDate).getTime()));
    const oldestStartDateB = Math.min(...v.map((item) => new Date(item.startDate).getTime()));
    return oldestStartDateA - oldestStartDateB;
  });

  const dataForDisplay = [];
  let lineIndex = 0;

  for (const values of sortedGroupedData) {
    for (const item of values) {
      dataForDisplay.push({ ...item, top: lineIndex * 38 });
    }
    lineIndex++;
  }

  if (dataForDisplay.length === 0) return null;

  console.log(dataForDisplay);

  return (
    <div className="tw-border tw-border-gray-200 tw-rounded-lg tw-shadow tw-overflow-x-auto tw-overflow-y-hidden tw-p-2 tw-max-w-[824px] tw-mx-auto">
      <h3 className="tw-mb-4 tw-pb-1 tw-text-lg tw-font-semibold tw-border-b tw-border-zinc-200">
        Mouvements d'équipe du {formatDateWithFullMonth(globalStartDate)} au {formatDateWithFullMonth(globalEndDate)}
      </h3>
      <div className="tw-relative tw-w-[800px] tw-overflow-hidden" style={{ height: `${lineIndex * 38}px` }}>
        {dataForDisplay.map((item, index) => {
          const teamName = teams.find((t) => t._id === item.team)?.name || "Équipe supprimée ou fusionnée";
          return (
            <div
              key={index}
              className="tw-absolute tw-h-8 tw-flex tw-flex-col tw-rounded-sm tw-items-start tw-overflow-hidden"
              style={{
                width: `${item.width}px`,
                left: `${item.position}px`,
                top: `${item.top}px`,
                backgroundColor: item.backgroundColor || "#bbb",
                border: "1px solid " + (item.borderColor || "aaa"),
              }}
              title={teamName}
            >
              <div className="text-white tw-text-xs tw-font-semibold tw-truncate tw-pl-1">{teamName}</div>
              <div className="text-white tw-text-[10px] tw-truncate tw-pl-1 tw-leading-3">
                {dayjsInstance(item.startDate).format("DD/MM/YY")} au {dayjsInstance(item.endDate).format("DD/MM/YY")}
              </div>
            </div>
          );
        })}
      </div>
      {skippedItems.length > 0 ? (
        <div className="tw-mt-4 tw-pt-2 tw-border-t tw-border-zinc-200">
          <div className="tw-text-xs tw-font-medium tw-mb-1">Mouvements trop courts pour être affichés :</div>
          <ul className="tw-text-xs tw-list-disc tw-pl-4">
            {skippedItems.map((item, index) => {
              const teamName = teams.find((t) => t._id === item.team)?.name || "Équipe supprimée ou fusionnée";
              return (
                <li key={index}>
                  {teamName} du {dayjsInstance(item.startDate).format("DD/MM/YY HH:mm")} au {dayjsInstance(item.endDate).format("DD/MM/YY HH:mm")}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default function PersonTeamHistory({
  person,
  history,
  teams,
}: {
  person: PersonInstance;
  history: Array<PersonHistoryEntry>;
  teams: Array<TeamInstance>;
}) {
  const data = getPersonTeamHistory(history || [], person.createdAt);

  return <GanttChart data={data} teams={teams} />;
}
