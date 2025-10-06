import { useMemo, useState } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { utils, writeFile } from "@e965/xlsx";
import CustomFieldsStats from "./CustomFieldsStats";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../../components/tailwind/Modal";
import { currentTeamState, teamsState, usersState, userState } from "../../recoil/auth";
import TagTeam from "../../components/TagTeam";
import Table from "../../components/table";
import { dayjsInstance } from "../../services/date";
import { customFieldsObsSelector, groupedCustomFieldsObsSelector } from "../../recoil/territoryObservations";
import Filters, { filterData } from "../../components/Filters";
import DateBloc, { TimeBlock } from "../../components/DateBloc";
import CustomFieldDisplay from "../../components/CustomFieldDisplay";
import { CustomResponsivePie } from "./Charts";
import type { TerritoryInstance } from "../../types/territory";
import type { Filter, FilterableField } from "../../types/field";
import type { TerritoryObservationInstance } from "../../types/territoryObs";
import type { CustomField } from "../../types/field";
import type { Period } from "../../types/date";
import type { TeamInstance } from "../../types/team";
import type { PersonPopulated } from "../../types/person";
import Card from "../../components/Card";
import { capitalize } from "../../utils";
import { defaultModalObservationState, modalObservationState } from "../../recoil/modal";
import { useLocation } from "react-router-dom";

interface ObservationsStatsProps {
  territories: Array<TerritoryInstance>;
  filterObs: Array<Filter>;
  setFilterObs: (filters: Array<Filter>) => void;
  observations: Array<TerritoryObservationInstance>;
  customFieldsObs: Array<CustomField>;
  period: Period;
  selectedTeams: Array<TeamInstance>;
}

const ObservationsStats = ({
  territories,
  filterObs,
  setFilterObs,
  observations,
  customFieldsObs,
  period,
  selectedTeams,
}: ObservationsStatsProps) => {
  const currentTeam = useRecoilValue(currentTeamState);
  const groupedCustomFieldsObs = useRecoilValue(groupedCustomFieldsObsSelector);

  const filterBase: Array<FilterableField> = useMemo(() => {
    return [
      {
        field: "territory",
        name: "territory",
        label: "Territoire",
        type: "multi-choice",
        options: territories.map((t) => t.name),
      },
      ...customFieldsObs
        .filter((a) => a.enabled || a.enabledTeams?.includes(currentTeam._id))
        .map((field) => ({
          field: field.name,
          name: field.name,
          label: field.label,
          type: field.type,
          options: field.options,
        })),
    ];
  }, [territories, customFieldsObs, currentTeam._id]);
  const [obsModalOpened, setObsModalOpened] = useState(false);
  const [sliceField, setSliceField] = useState(null);
  const [sliceValue, setSliceValue] = useState(null);
  const [slicedData, setSlicedData] = useState([]);
  const user = useRecoilValue(userState);

  const onSliceClick = (newSlice: string, fieldName: FilterableField["field"], observationsConcerned = observations) => {
    if (["stats-only"].includes(user.role)) return;
    const newSlicefield = customFieldsObs.find((f) => f.name === fieldName);
    setSliceField(newSlicefield);
    setSliceValue(newSlice);
    const slicedData =
      newSlicefield.type === "boolean"
        ? observationsConcerned.filter((p) => (newSlice === "Non" ? !p[newSlicefield.name] : !!p[newSlicefield.name]))
        : filterData(observationsConcerned, [{ ...newSlicefield, value: newSlice, type: newSlicefield.type }]);
    setSlicedData(slicedData);
    setObsModalOpened(true);
  };

  return (
    <>
      <h3 className="tw-my-5 tw-text-xl">Statistiques des observations de territoire</h3>
      <Filters base={filterBase} filters={filterObs} onChange={setFilterObs} />

      <details
        open={import.meta.env.VITE_TEST_PLAYWRIGHT === "true" || window.localStorage.getItem("observation-stats-general-open") === "true"}
        onToggle={(e) => {
          if ((e.target as HTMLDetailsElement).open) {
            window.localStorage.setItem("observation-stats-general-open", "true");
          } else {
            window.localStorage.removeItem("observation-stats-general-open");
          }
        }}
      >
        <summary className="tw-mx-0 tw-my-8">
          <h4 className="tw-inline tw-text-xl tw-text-black75">Général</h4>
        </summary>
        <div className="tw-flex tw-flex-col tw-gap-4">
          <Card
            title="Nombre d'observations de territoire"
            count={observations.length}
            dataTestId="number-observations"
            help={`Nombre d'observations de territoire des territoires sélectionnés, dans la période définie.\n\nLa moyenne de cette données est basée sur le nombre d'observations faites.`}
            onClick={
              user.role === "stats-only"
                ? undefined
                : () => {
                    setSlicedData(observations);
                    setObsModalOpened(true);
                  }
            }
            unit={undefined}
            countId={undefined}
          >
            <></>
          </Card>
        </div>
      </details>

      {groupedCustomFieldsObs.length > 0 &&
        groupedCustomFieldsObs.map((group) => (
          <>
            <details
              key={group.name}
              className="print:tw-break-before-page"
              open={
                import.meta.env.VITE_TEST_PLAYWRIGHT === "true" ||
                window.localStorage.getItem(`observation-stats-${group.name.replace(" ", "-").toLocaleLowerCase()}-open`) === "true"
              }
              onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open) {
                  window.localStorage.setItem(`observation-stats-${group.name.replace(" ", "-").toLocaleLowerCase()}-open`, "true");
                } else {
                  window.localStorage.removeItem(`observation-stats-${group.name.replace(" ", "-").toLocaleLowerCase()}-open`);
                }
              }}
            >
              <summary className="tw-mx-0 tw-my-8">
                <h4 className="tw-inline tw-text-xl tw-text-black75">{group.name}</h4>
              </summary>
              <CustomFieldsStats
                data={observations}
                customFields={group.fields}
                onSliceClick={user.role === "stats-only" ? undefined : onSliceClick}
                help={(label) =>
                  `${capitalize(label)} des observations des territoires sélectionnés, dans la période définie.\n\nLa moyenne de cette données est basée sur le nombre d'observations faites.`
                }
                totalTitleForMultiChoice={<span className="tw-font-bold">Nombre d'observations concernées</span>}
              />
            </details>
          </>
        ))}

      <SelectedObsModal
        open={obsModalOpened}
        onClose={() => {
          setObsModalOpened(false);
        }}
        observations={slicedData}
        onAfterLeave={() => {
          setSliceField(null);
          setSliceValue(null);
          setSlicedData([]);
        }}
        title={`${sliceField?.label ?? "Observations de territoire"}${sliceValue ? ` : ${sliceValue}` : ""} (${slicedData.length})`}
        territories={territories}
        selectedTeams={selectedTeams}
        period={period}
      />
    </>
  );
};

const SelectedObsModal = ({ open, onClose, observations, territories, title, onAfterLeave, selectedTeams, period }) => {
  const setModalObservation = useSetRecoilState(modalObservationState);
  const teams = useRecoilValue(teamsState);
  const team = useRecoilValue(currentTeamState);
  const customFieldsObs = useRecoilValue(customFieldsObsSelector);
  const users = useRecoilValue(usersState);
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
      `Statistiques (${dayjsInstance(period.startDate).format("YYYY-MM-DD")} - ${dayjsInstance(period.endDate).format("YYYY-MM-DD")}) - ${title}.xlsx`
    );
  };

  return (
    <>
      <ModalContainer open={open} size="full" onClose={onClose} onAfterLeave={onAfterLeave}>
        <ModalHeader
          title={
            <div className="tw-flex tw-w-full tw-items-center tw-justify-between">
              {title}{" "}
              <button onClick={exportXlsx} className="button-submit tw-ml-auto tw-mr-20">
                Télécharger un export
              </button>
            </div>
          }
        />
        <ModalBody>
          <div className="tw-p-4">
            <Table
              className="Table"
              data={observations}
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
                  render: (obs) => {
                    return (
                      <>
                        <DateBloc date={obs.observedAt} />
                        <TimeBlock time={obs.observedAt} />
                      </>
                    );
                  },
                },
                { title: "Territoire", dataKey: "territory", render: (obs) => territories.find((t) => t._id === obs.territory)?.name },
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
                },
                {
                  title: "Équipe en charge",
                  dataKey: "team",
                  render: (obs) => <TagTeam teamId={obs?.team} />,
                },
              ]}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            name="cancel"
            className="button-cancel"
            onClick={() => {
              onClose(null);
            }}
          >
            Fermer
          </button>
        </ModalFooter>
      </ModalContainer>
    </>
  );
};

export default ObservationsStats;
