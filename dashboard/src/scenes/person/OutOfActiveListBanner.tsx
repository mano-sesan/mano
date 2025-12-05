import { formatDateWithFullMonth } from "../../services/date";
import { currentTeamState } from "../../recoil/auth";
import { useAtomValue } from "jotai";
import { HistoryEntryForOutOfTeamsInformations, OutOfTeamsInformation, PersonInstance, FieldChangeData } from "../../types/person";

export default function OutOfActiveListBanner({ person }: { person: PersonInstance }) {
  const team = useAtomValue(currentTeamState);

  if (person.outOfActiveList) {
    return (
      <div className="noprint tw-rounded tw-border tw-border-orange-50 tw-mb-2 tw-bg-amber-100 tw-px-5 tw-py-3 tw-text-orange-900">
        {person?.name} est en dehors de la file active de l'organisation
        {person.outOfActiveListReasons?.length ? (
          <>
            , pour {person.outOfActiveListReasons.length > 1 ? "les motifs suivants" : "le motif suivant"} :{" "}
            <b>{person.outOfActiveListReasons.join(", ")}</b>
          </>
        ) : (
          ""
        )}{" "}
        {person.outOfActiveListDate && ` depuis le ${formatDateWithFullMonth(person.outOfActiveListDate)}`}
      </div>
    );
  }

  const isInSelectedTeam = person.assignedTeams?.some((assignedTeam) => assignedTeam === team._id);
  // On vérifie si la personne est hors de la file active de l'équipe sélectionnée
  if (!isInSelectedTeam && person.history) {
    for (let i = person.history.length - 1; i >= 0; i--) {
      const history = person.history[i];
      if (
        (history.data as FieldChangeData).assignedTeams?.oldValue?.includes(team._id) &&
        !(history.data as FieldChangeData).assignedTeams?.newValue?.includes(team._id)
      ) {
        const outOfTeamsInformations = (
          ((history.data as unknown as HistoryEntryForOutOfTeamsInformations).outOfTeamsInformations || []) as OutOfTeamsInformation[]
        ).find((reason) => reason.team === team._id);
        return (
          <div className="noprint tw-rounded tw-border tw-border-orange-50 tw-mb-2 tw-bg-amber-100 tw-px-5 tw-py-3 tw-text-orange-900">
            {person?.name} est sortie de la file active de l'équipe <b>{team.name}</b> depuis le {formatDateWithFullMonth(history.date)}
            {outOfTeamsInformations?.reasons?.length ? (
              <>
                , pour {outOfTeamsInformations.reasons?.length > 1 ? "les motifs suivants" : "le motif suivant"} :{" "}
                <b>{outOfTeamsInformations.reasons?.join(", ")}</b>
              </>
            ) : (
              ""
            )}
          </div>
        );
      }
    }
  }
}
