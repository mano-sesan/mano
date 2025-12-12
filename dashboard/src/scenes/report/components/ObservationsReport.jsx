import { useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { utils, writeFile } from "@e965/xlsx";
import { ModalHeader, ModalBody, ModalContainer, ModalFooter } from "../../../components/tailwind/Modal";
import { FullScreenIcon } from "../../../assets/icons/FullScreenIcon";
import Table from "../../../components/table";
import TagTeam from "../../../components/TagTeam";
import DateBloc, { TimeBlock } from "../../../components/DateBloc";
import { territoriesState } from "../../../atoms/territory";
import { dayjsInstance } from "../../../services/date";
import { currentTeamAuthentifiedState, teamsState, userAuthentifiedState, usersState } from "../../../atoms/auth";
import { customFieldsObsSelector, sortTerritoriesObservations } from "../../../atoms/territoryObservations";
import CustomFieldDisplay from "../../../components/CustomFieldDisplay";
import { useLocalStorage } from "../../../services/useLocalStorage";
import { defaultModalObservationState, modalObservationState } from "../../../atoms/modal";
import { useLocation } from "react-router-dom";

export const ObservationsReport = ({ observations, period, selectedTeams }) => {
  const [fullScreen, setFullScreen] = useState(false);

  return (
    <>
      <section title="Observations" className="noprint tw-relative tw-m-2 tw-flex tw-flex-col tw-items-center tw-justify-center tw-bg-main">
        <p className="tw-m-0 tw-w-full tw-text-center tw-text-2xl tw-font-semibold tw-text-white">{observations.length}</p>
        <p className="tw-m-0 tw-w-full tw-text-center tw-text-sm tw-font-normal tw-text-white">observation{observations.length > 1 ? "s" : ""}</p>
        <button
          title="Passer les observations en plein écran"
          className="tw-absolute -tw-right-1.5 -tw-top-1.5 tw-h-6 tw-w-6 tw-rounded-full tw-text-white tw-transition hover:tw-scale-125 disabled:tw-cursor-not-allowed disabled:tw-opacity-30"
          onClick={() => setFullScreen(true)}
        >
          <FullScreenIcon />
        </button>
      </section>
      <section
        aria-hidden="true"
        className="printonly tw-mt-12 tw-flex tw-h-full tw-flex-col tw-overflow-hidden tw-rounded-lg tw-border tw-border-zinc-200 tw-shadow"
      >
        <div className="tw-flex tw-flex-col tw-items-stretch tw-bg-white tw-px-3 tw-py-3">
          <h3 className="tw-m-0 tw-text-base tw-font-medium">Observations de territoire ({observations.length})</h3>
        </div>
        <div className="tw-grow tw-overflow-y-auto tw-border-t tw-border-main tw-border-opacity-20">
          <ObservationsTable observations={observations} period={period} selectedTeams={selectedTeams} />
        </div>
      </section>
      <ModalContainer open={!!fullScreen} className="" size="full" onClose={() => setFullScreen(false)}>
        <ModalHeader title={`Observations (${observations.length})`} onClose={() => setFullScreen(false)} />
        <ModalBody>
          <ObservationsTable observations={observations} period={period} selectedTeams={selectedTeams} />
        </ModalBody>
        <ModalFooter>
          <button type="button" name="cancel" className="button-cancel" onClick={() => setFullScreen(false)}>
            Fermer
          </button>
        </ModalFooter>
      </ModalContainer>
    </>
  );
};

const ObservationsTable = ({ period, observations, selectedTeams }) => {
  const setModalObservation = useSetAtom(modalObservationState);
  const [sortBy, setSortBy] = useLocalStorage("report-territory-obs-sortBy", "name");
  const [sortOrder, setSortOrder] = useLocalStorage("report-territory-obs-sortOrder", "ASC");
  const territories = useAtomValue(territoriesState);
  const teams = useAtomValue(teamsState);
  const team = useAtomValue(currentTeamAuthentifiedState);
  const user = useAtomValue(userAuthentifiedState);
  const customFieldsObs = useAtomValue(customFieldsObsSelector);
  const users = useAtomValue(usersState);
  const location = useLocation();

  const exportXlsx = () => {
    const wb = utils.book_new();
    const formattedData = utils.json_to_sheet(
      observations.map((observation) => {
        return {
          id: observation._id,
          "Territoire - Nom": territories.find((t) => t._id === observation.territory)?.name,
          "Observé le": dayjsInstance(observation.observedAt).format("YYYY-MM-DD HH:mm"),
          Équipe: observation.team ? teams.find((t) => t._id === observation.team)?.name : "",
          ...customFieldsObs.reduce((fields, field) => {
            if (["date", "date-with-time", "duration"].includes(field.type))
              fields[field.label || field.name] = observation[field.name]
                ? dayjsInstance(observation[field.name]).format(field.type === "date" ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm")
                : "";
            else if (["boolean"].includes(field.type)) fields[field.label || field.name] = observation[field.name] ? "Oui" : "Non";
            else if (["yes-no"].includes(field.type)) fields[field.label || field.name] = observation[field.name];
            else if (Array.isArray(observation[field.name])) fields[field.label || field.name] = observation[field.name].join(", ");
            else fields[field.label || field.name] = observation[field.name];
            return fields;
          }, {}),
          "Créée par": users.find((u) => u._id === observation.user)?.name,
          "Créée le": dayjsInstance(observation.createdAt).format("YYYY-MM-DD HH:mm"),
          "Mise à jour le": dayjsInstance(observation.updatedAt).format("YYYY-MM-DD HH:mm"),
        };
      })
    );
    utils.book_append_sheet(wb, formattedData, "Observations de territoires");

    utils.book_append_sheet(wb, utils.json_to_sheet(observations), "Observations (données brutes)");
    utils.book_append_sheet(wb, utils.json_to_sheet(territories), "Territoires (données brutes)");
    utils.book_append_sheet(wb, utils.json_to_sheet(selectedTeams), "Filtres (équipes)");
    const otherFilters = [
      {
        "Période - début": period.startDate,
        "Période - fin": period.endDate,
      },
    ];
    utils.book_append_sheet(wb, utils.json_to_sheet(otherFilters), "Filtres (autres)");
    writeFile(
      wb,
      `Compte rendu (${dayjsInstance(period.startDate).format("YYYY-MM-DD")} - ${dayjsInstance(period.endDate).format(
        "YYYY-MM-DD"
      )}) - Observations de territoires (${observations.length}).xlsx`
    );
  };

  const orderedObservations = useMemo(
    () =>
      [
        ...(observations || []).map((obs) => ({
          ...obs,
          territoryName: territories.find((t) => t._id === obs.territory)?.name,
        })),
      ].sort(sortTerritoriesObservations(sortBy, sortOrder)),
    [sortBy, sortOrder, observations, territories]
  );

  return (
    <>
      <div className="tw-px-4 tw-py-2 print:tw-mb-4 print:tw-px-0">
        <div className="noprint tw-mb-5 tw-flex tw-justify-end">
          <button onClick={exportXlsx} className="button-submit tw-ml-auto tw-mr-4">
            Télécharger un export
          </button>
          <button
            type="button"
            className="button-submit"
            onClick={() => {
              setModalObservation({
                ...defaultModalObservationState(),
                open: true,
                observation: {
                  user: user._id,
                  team: selectedTeams.length === 1 ? selectedTeams[0]._id : null,
                  observedAt: dayjsInstance(period.startDate).toDate(),
                  createdAt: dayjsInstance().toDate(),
                  territory: null,
                },
                from: location.pathname,
              });
            }}
          >
            Ajouter une observation
          </button>
        </div>
        {!!orderedObservations.length && (
          <Table
            className="Table"
            data={orderedObservations}
            onRowClick={(obs) => {
              setModalObservation({
                ...defaultModalObservationState(),
                open: true,
                observation: obs,
                from: location.pathname,
              });
            }}
            rowKey={"_id"}
            columns={[
              {
                title: "Date",
                dataKey: "observedAt",
                onSortOrder: setSortOrder,
                onSortBy: setSortBy,
                sortOrder,
                sortBy,
                render: (obs) => {
                  return (
                    <>
                      <DateBloc date={obs.observedAt} />
                      <TimeBlock time={obs.observedAt} />
                    </>
                  );
                },
              },
              {
                title: "Territoire",
                dataKey: "territoryName",
                onSortOrder: setSortOrder,
                onSortBy: setSortBy,
                sortOrder,
                sortBy,
                render: (obs) => obs.territoryName,
              },
              {
                title: "Observation",
                dataKey: "entityKey",
                render: (obs) => (
                  <div className="tw-text-xs">
                    {customFieldsObs
                      .filter((f) => f)
                      .filter((f) => f.enabled || f.enabledTeams?.includes(team._id))
                      .filter((f) => obs[f.name])
                      .map((field) => {
                        const { name, label } = field;
                        return (
                          <div key={name}>
                            {label}:{" "}
                            {["textarea"].includes(field.type) ? (
                              <div className="tw-pl-8">
                                <CustomFieldDisplay type={field.type} value={obs[field.name]} />
                              </div>
                            ) : (
                              <CustomFieldDisplay type={field.type} value={obs[field.name]} />
                            )}
                          </div>
                        );
                      })}
                  </div>
                ),
                left: true,
              },
              {
                title: "Équipe en charge",
                dataKey: "team",
                render: (obs) => <TagTeam teamId={obs?.team} />,
              },
            ]}
          />
        )}
      </div>
    </>
  );
};
