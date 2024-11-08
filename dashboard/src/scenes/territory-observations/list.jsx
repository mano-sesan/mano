import { useMemo } from "react";

import ButtonCustom from "../../components/ButtonCustom";
import { customFieldsObsSelector, sortTerritoriesObservations, territoryObservationsState } from "../../recoil/territoryObservations";
import { useRecoilValue, useSetRecoilState } from "recoil";
import Table from "../../components/table";
import { useLocalStorage } from "../../services/useLocalStorage";
import { dayjsInstance } from "../../services/date";
import UserName from "../../components/UserName";
import { currentTeamAuthentifiedState, userAuthentifiedState, usersState } from "../../recoil/auth";
import CustomFieldDisplay from "../../components/CustomFieldDisplay";
import TagTeam from "../../components/TagTeam";
import { rencontresState } from "../../recoil/rencontres";
import DateBloc, { TimeBlock } from "../../components/DateBloc";
import { defaultModalObservationState, modalObservationState } from "../../recoil/modal";

const List = ({ territory = {} }) => {
  const setModalObservation = useSetRecoilState(modalObservationState);
  const [sortBy, setSortBy] = useLocalStorage("territory-obs-sortBy", "name");
  const [sortOrder, setSortOrder] = useLocalStorage("territory-obs-sortOrder", "ASC");
  const territoryObservations = useRecoilValue(territoryObservationsState);
  const users = useRecoilValue(usersState);
  const team = useRecoilValue(currentTeamAuthentifiedState);
  const user = useRecoilValue(userAuthentifiedState);
  const customFieldsObs = useRecoilValue(customFieldsObsSelector);
  const rencontres = useRecoilValue(rencontresState);

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
