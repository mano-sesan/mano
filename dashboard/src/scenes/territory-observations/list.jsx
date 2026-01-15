import { useMemo } from "react";

import ButtonCustom from "../../components/ButtonCustom";
import { customFieldsObsSelector, sortTerritoriesObservations, territoryObservationsState } from "../../atoms/territoryObservations";
import { useAtomValue, useSetAtom } from "jotai";
import Table from "../../components/table";
import { useLocalStorage } from "../../services/useLocalStorage";
import { dayjsInstance } from "../../services/date";
import UserName from "../../components/UserName";
import { currentTeamAuthentifiedState, userAuthentifiedState, usersState } from "../../atoms/auth";
import CustomFieldDisplay from "../../components/CustomFieldDisplay";
import TagTeam from "../../components/TagTeam";
import { rencontresState } from "../../atoms/rencontres";
import DateBloc, { TimeBlock } from "../../components/DateBloc";
import { defaultModalObservationState, modalObservationState } from "../../atoms/modal";

const List = ({ territory = {} }) => {
  const setModalObservation = useSetAtom(modalObservationState);
  const [sortBy, setSortBy] = useLocalStorage("territory-obs-sortBy", "observedAt");
  const [sortOrder, setSortOrder] = useLocalStorage("territory-obs-sortOrder", "ASC");
  const territoryObservations = useAtomValue(territoryObservationsState);
  const users = useAtomValue(usersState);
  const team = useAtomValue(currentTeamAuthentifiedState);
  const user = useAtomValue(userAuthentifiedState);
  const customFieldsObs = useAtomValue(customFieldsObsSelector);
  const rencontres = useAtomValue(rencontresState);

  const filteredObservations = useMemo(
    () => territoryObservations.filter((obs) => obs.territory === territory._id),
    [territoryObservations, territory._id]
  );

  const rencontresByObservationMap = useMemo(() => {
    const mapping = new Map();
    for (const rencontre of rencontres) {
      if (rencontre.observation) {
        const current = mapping.get(rencontre.observation) || [];
        current.push(rencontre);
        mapping.set(rencontre.observation, current);
      }
    }
    return mapping;
  }, [rencontres]);

  const observations = useMemo(() => {
    return filteredObservations
      .map((e) => ({
        ...e,
        userName: users.find((u) => u._id === e.user)?.name,
        rencontres: rencontresByObservationMap.get(e._id) || [],
      }))
      .sort(sortTerritoriesObservations(sortBy, sortOrder));
  }, [filteredObservations, users, rencontresByObservationMap, sortBy, sortOrder]);

  if (!observations) return null;

  return (
    <>
      <div className="tw-flex tw-items-center tw-mt-12 tw-mb-6">
        <div className="tw-flex-1 tw-mt-2">
          <h1 className="tw-text-xl tw-font-bold">Observations</h1>
        </div>
        <div>
          <ButtonCustom
            onClick={() => {
              setModalObservation({
                ...defaultModalObservationState(),
                open: true,
                observation: {
                  user: user._id,
                  team: null,
                  observedAt: dayjsInstance().toDate(),
                  createdAt: dayjsInstance().toDate(),
                  territory: territory?._id,
                },
                from: location.pathname,
              });
            }}
            type="button"
            color="primary"
            title="Nouvelle observation"
            padding="12px 24px"
          />
        </div>
      </div>
      <Table
        data={observations}
        rowKey={"_id"}
        noData={`Pas encore d'observations pour ce territoire`}
        onRowClick={(obs) => {
          setModalObservation({
            ...defaultModalObservationState(),
            open: true,
            observation: obs,
            from: location.pathname,
          });
        }}
        columns={[
          {
            title: "Date",
            dataKey: "observedAt",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortOrder,
            sortBy,
            style: { width: "90px" },
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
            title: "Observations",
            dataKey: "infos",
            render: (obs) => {
              const visibleFields = customFieldsObs
                .filter((f) => f)
                .filter((f) => f.enabled || f.enabledTeams?.includes(team._id))
                .filter((f) => obs[f.name]);

              return (
                <div className="tw-space-y-2 tw-text-sm tw-py-1">
                  {visibleFields.map((field) => {
                    const { name, label, type } = field;
                    const value = obs[name];

                    // Multi-choice: render as inline tags
                    if (type === "multi-choice" && Array.isArray(value)) {
                      return (
                        <div key={name}>
                          <span className="tw-font-semibold tw-text-gray-600">{label}&nbsp;:</span>
                          <div className="tw-flex tw-flex-wrap tw-gap-1 tw-mt-1">
                            {value.map((v) => (
                              <span key={v} className="tw-inline-block tw-bg-main/10 tw-text-main tw-px-2 tw-py-0.5 tw-rounded-full tw-text-xs">
                                {v}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    // Textarea: render with proper indentation
                    if (type === "textarea") {
                      return (
                        <div key={name}>
                          <span className="tw-font-semibold tw-text-gray-600">{label}&nbsp;:</span>
                          <div className="tw-mt-1 tw-pl-3 tw-border-l-2 tw-border-gray-200 tw-text-gray-700">
                            <CustomFieldDisplay type={type} value={value} />
                          </div>
                        </div>
                      );
                    }

                    // Number: render with subtle emphasis
                    if (type === "number") {
                      return (
                        <div key={name} className="tw-flex tw-items-baseline tw-gap-2">
                          <span className="tw-font-semibold tw-text-gray-600">{label}&nbsp;:</span>
                          <span className="tw-font-medium tw-text-main">{value}</span>
                        </div>
                      );
                    }

                    // Default: inline label and value
                    return (
                      <div key={name} className="tw-flex tw-items-baseline tw-gap-2 tw-flex-wrap">
                        <span className="tw-font-semibold tw-text-gray-600">{label}&nbsp;:</span>
                        <span className="tw-text-gray-800">
                          <CustomFieldDisplay type={type} value={value} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            },
          },
          {
            title: "Créée par",
            dataKey: "userName",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortOrder,
            sortBy,
            render: (obs) => <UserName id={obs.user} />,
          },
          {
            title: "Équipe en charge",
            dataKey: "team",
            render: (obs) => <TagTeam teamId={obs?.team} />,
          },
          {
            title: "Rencontres",
            dataKey: "rencontres",
            render: (obs) => {
              if (!obs.rencontres?.length) return null;
              return <div className="tw-flex tw-items-center tw-justify-center">{obs.rencontres.length}</div>;
            },
          },
        ]}
      />
    </>
  );
};

export default List;
