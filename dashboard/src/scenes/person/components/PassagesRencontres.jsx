import { useMemo, useState } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { useLocation, useHistory } from "react-router-dom";
import Passage from "../../../components/Passage";
import Rencontre from "../../../components/Rencontre";
import TagTeam from "../../../components/TagTeam";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../../../components/tailwind/Modal";
import { currentTeamState, userState, organisationState, usersState } from "../../../recoil/auth";
import { dayjsInstance, formatDateTimeWithNameOfDay } from "../../../services/date";
import { FullScreenIcon } from "../../../assets/icons/FullScreenIcon";
import { capitalize } from "../../../utils";
import UserName from "../../../components/UserName";
import { useLocalStorage } from "../../../services/useLocalStorage";
import Table from "../../../components/table";
import DateBloc, { TimeBlock } from "../../../components/DateBloc";
import { sortRencontres } from "../../../recoil/rencontres";
import { defaultModalObservationState, modalObservationState } from "../../../recoil/modal";
import { territoryObservationsState } from "../../../recoil/territoryObservations";

export default function PassagesRencontres({ person }) {
  const organisation = useRecoilValue(organisationState);
  const user = useRecoilValue(userState);
  const currentTeam = useRecoilValue(currentTeamState);
  const [fullScreen, setFullScreen] = useState(false);
  const [selected, setSelected] = useState(organisation.passagesEnabled ? "passages" : "rencontres");
  const history = useHistory();
  const { search } = useLocation();
  const currentPassageId = useMemo(() => {
    const searchParams = new URLSearchParams(search);
    return searchParams.get("passageId");
  }, [search]);
  const currentRencontreId = useMemo(() => {
    const searchParams = new URLSearchParams(search);
    return searchParams.get("rencontreId");
  }, [search]);

  const personPassages = useMemo(
    () => [...(person?.passages || [])].sort((r1, r2) => (dayjsInstance(r1.date).isBefore(dayjsInstance(r2.date), "day") ? 1 : -1)),
    [person]
  );
  const personRencontres = useMemo(
    () => [...(person?.rencontres || [])].sort((r1, r2) => (dayjsInstance(r1.date).isBefore(dayjsInstance(r2.date), "day") ? 1 : -1)),
    [person]
  );
  const handleAddPassage = () => {
    history.push(`/person/${person._id}?passageId=new`);
  };
  const handleAddRencontre = () => {
    history.push(`/person/${person._id}?rencontreId=new`);
  };

  const currentPassage = useMemo(() => {
    if (!currentPassageId) return null;
    if (currentPassageId === "new") return { person: person._id, user: user._id, team: currentTeam._id };
    return personPassages.find((p) => p._id === currentPassageId);
  }, [currentPassageId, personPassages, person, user, currentTeam]);

  const currentRencontre = useMemo(() => {
    if (!currentRencontreId) return null;
    if (currentRencontreId === "new") return { person: person._id, user: user._id, team: currentTeam._id };
    return personRencontres.find((p) => p._id === currentRencontreId);
  }, [currentRencontreId, personRencontres, person, user, currentTeam]);

  if (!organisation.passagesEnabled && !organisation.rencontresEnabled) {
    return null;
  }

  return (
    <div className="tw-relative">
      <div className="tw-sticky tw-top-0 tw-z-10 tw-flex tw-bg-white tw-p-2 tw-text-main">
        <div className="tw-flex tw-flex-1">
          {organisation.passagesEnabled && (
            <button
              className={
                selected === "passages"
                  ? "tw-rounded-t tw-border-l tw-border-r tw-border-t tw-border-slate-300 tw-p-1.5"
                  : "tw-border-b tw-border-slate-300 tw-p-1.5"
              }
              onClick={() => setSelected("passages")}
            >
              Passages ({personPassages.length})
            </button>
          )}
          {organisation.rencontresEnabled && (
            <button
              className={
                selected === "rencontres"
                  ? "tw-rounded-t tw-border-l tw-border-r tw-border-t tw-border-slate-300 tw-p-1.5"
                  : "tw-border-b tw-border-slate-300 tw-p-1.5"
              }
              onClick={() => setSelected("rencontres")}
            >
              Rencontres ({personRencontres.length})
            </button>
          )}
        </div>
        <div className="flex-col tw-flex tw-items-center tw-gap-2">
          <button
            className="tw-text-md tw-h-8 tw-w-8 tw-rounded-full tw-bg-main tw-font-bold tw-text-white tw-transition hover:tw-scale-125"
            aria-label={selected === "passages" ? "Ajouter un passage" : "Ajouter une rencontre"}
            onClick={() => {
              if (selected === "rencontres") handleAddRencontre();
              else handleAddPassage();
            }}
          >
            ＋
          </button>
          {(selected === "passages" ? Boolean(personPassages.length) : Boolean(personRencontres.length)) && (
            <button
              title={`Passer les ${selected} en plein écran`}
              className="tw-h-6 tw-w-6 tw-rounded-full tw-text-main tw-transition hover:tw-scale-125"
              onClick={() => setFullScreen(true)}
            >
              <FullScreenIcon />
            </button>
          )}
        </div>
      </div>
      <ModalContainer open={!!fullScreen} size="5xl" onClose={() => setFullScreen(false)}>
        <ModalHeader title={`${capitalize(selected)} de  ${person?.name} (${personPassages.length})`}></ModalHeader>
        <ModalBody>
          {selected === "passages" ? <PassagesTable personPassages={personPassages} /> : <RencontresTable personRencontres={personRencontres} />}
        </ModalBody>
        <ModalFooter>
          <button type="button" name="cancel" className="button-cancel" onClick={() => setFullScreen(false)}>
            Fermer
          </button>
          <button
            type="button"
            className="button-submit"
            onClick={() => {
              if (selected === "rencontres") handleAddRencontre();
              else handleAddPassage();
            }}
          >
            ＋ Ajouter {selected === "rencontres" ? "une rencontre" : "un passage"}
          </button>
        </ModalFooter>
      </ModalContainer>
      <Rencontre
        rencontre={currentRencontre}
        personId={person._id}
        onFinished={() => {
          history.replace(`/person/${person._id}`);
        }}
      />
      <Passage
        passage={currentPassage}
        personId={person._id}
        onFinished={() => {
          history.replace(`/person/${person._id}`);
        }}
      />
      {selected === "passages" && !personPassages.length && (
        <div className="tw-mt-8 tw-w-full tw-text-center tw-text-gray-300">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="tw-mx-auto tw-mb-2 tw-h-16 tw-w-16 tw-text-gray-200"
            width={24}
            height={24}
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
            <circle cx={12} cy={12} r={9}></circle>
            <polyline points="12 7 12 12 15 15"></polyline>
          </svg>
          Aucun passage
        </div>
      )}
      {selected === "rencontres" && !personRencontres.length && (
        <div className="tw-mt-8 tw-w-full tw-text-center tw-text-gray-300">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="tw-mx-auto tw-mb-2 tw-h-16 tw-w-16 tw-text-gray-200"
            width={24}
            height={24}
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
            <circle cx={12} cy={12} r={9}></circle>
            <polyline points="12 7 12 12 15 15"></polyline>
          </svg>
          Aucune rencontre
        </div>
      )}
      {selected === "passages" ? (
        <PassagesTableSmall personPassages={personPassages} />
      ) : (
        <RencontresTableSmall personRencontres={personRencontres} />
      )}
    </div>
  );
}

function PassagesTableSmall({ personPassages }) {
  const history = useHistory();
  return (
    <table className="table table-striped">
      <tbody className="small">
        {(personPassages || []).map((passage) => {
          return (
            <tr
              key={passage._id}
              onClick={() => {
                history.push(`/person/${passage.person}?passageId=${passage._id}`);
              }}
            >
              <td>
                <div className="tw-flex tw-text-black50 tw-capitalize tw-mb-1 tw-text-xs tw-items-center">
                  <div>{formatDateTimeWithNameOfDay(passage.date || passage.createdAt)}</div>
                </div>
                {passage.comment ? (
                  <div style={{ overflowWrap: "anywhere" }}>
                    {(passage.comment || "").split("\n").map((e, i) => (
                      <p className="tw-m-0 tw-p-0" key={e + i}>
                        {e}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="tw-flex tw-mt-1 tw-text-xs tw-items-center">
                  <div className="tw-grow tw-text-black50">
                    Créé par <UserName id={passage.user} />
                  </div>
                  <div className="tw-max-w-fit">
                    <TagTeam teamId={passage.team} />
                  </div>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PassagesTable({ personPassages }) {
  const history = useHistory();
  const users = useRecoilValue(usersState);
  const [sortBy, setSortBy] = useLocalStorage("person-passages-sortBy", "date");
  const [sortOrder, setSortOrder] = useLocalStorage("person-passages-sortOrder", "ASC");

  const passagesPopulated = useMemo(() => {
    return personPassages.map((passage) => {
      return {
        ...passage,
        userPopulated: passage.user ? users.find((u) => u._id === passage.user) : undefined,
      };
    });
  }, [personPassages, users]);

  const passagesSorted = useMemo(() => {
    return [...passagesPopulated].sort(sortRencontres(sortBy, sortOrder));
  }, [passagesPopulated, sortBy, sortOrder]);

  return (
    <>
      <div className="tw-px-4 tw-py-2 print:tw-mb-4 print:tw-px-0">
        {!!personPassages.length && (
          <Table
            className="Table"
            onRowClick={(passage) => {
              history.push(`/person/${passage.person}?passageId=${passage._id}`);
            }}
            data={passagesSorted}
            rowKey={"_id"}
            columns={[
              {
                title: "Date",
                dataKey: "date",
                onSortOrder: setSortOrder,
                onSortBy: setSortBy,
                sortBy,
                sortOrder,
                render: (passage) => {
                  return (
                    <>
                      <DateBloc date={passage.date} />
                      <TimeBlock time={passage.date} />
                    </>
                  );
                },
              },
              {
                title: "Enregistré par",
                dataKey: "user",
                onSortOrder: setSortOrder,
                onSortBy: setSortBy,
                sortBy,
                sortOrder,
                render: (passage) => (passage.user ? <UserName id={passage.user} /> : null),
              },
              {
                title: "Commentaire",
                dataKey: "comment",
                onSortOrder: setSortOrder,
                onSortBy: setSortBy,
                sortBy,
                sortOrder,
              },
              {
                title: "Équipe en charge",
                dataKey: "team",
                render: (passage) => <TagTeam teamId={passage?.team} />,
              },
            ]}
          />
        )}
      </div>
    </>
  );
}

function RencontresTable({ personRencontres }) {
  const history = useHistory();
  const users = useRecoilValue(usersState);
  const setModalObservation = useSetRecoilState(modalObservationState);
  const allObservations = useRecoilValue(territoryObservationsState);
  const [sortBy, setSortBy] = useLocalStorage("person-rencontres-sortBy", "date");
  const [sortOrder, setSortOrder] = useLocalStorage("person-rencontres-sortOrder", "ASC");

  const rencontresPopulated = useMemo(() => {
    return personRencontres.map((rencontre) => {
      return {
        ...rencontre,
        userPopulated: rencontre.user ? users.find((u) => u._id === rencontre.user) : undefined,
      };
    });
  }, [personRencontres, users]);

  const rencontresSorted = useMemo(() => {
    return [...rencontresPopulated].sort(sortRencontres(sortBy, sortOrder));
  }, [rencontresPopulated, sortBy, sortOrder]);

  return (
    <>
      <div className="tw-px-4 tw-py-2 print:tw-mb-4 print:tw-px-0">
        {!!personRencontres.length && (
          <Table
            className="Table"
            onRowClick={(rencontre) => {
              history.push(`/person/${rencontre.person}?rencontreId=${rencontre._id}`);
            }}
            data={rencontresSorted}
            rowKey={"_id"}
            columns={[
              {
                title: "Date",
                dataKey: "date",
                onSortOrder: setSortOrder,
                onSortBy: setSortBy,
                sortBy,
                sortOrder,
                render: (rencontre) => {
                  return (
                    <>
                      <DateBloc date={rencontre.date} />
                      <TimeBlock time={rencontre.date} />
                    </>
                  );
                },
              },
              {
                title: "Enregistré par",
                dataKey: "user",
                onSortOrder: setSortOrder,
                onSortBy: setSortBy,
                sortBy,
                sortOrder,
                render: (rencontre) => (rencontre.user ? <UserName id={rencontre.user} /> : null),
              },

              { title: "Commentaire", dataKey: "comment", onSortOrder: setSortOrder, onSortBy: setSortBy, sortBy, sortOrder },
              {
                title: "Territoire",
                dataKey: "territory",
                onSortOrder: setSortOrder,
                onSortBy: setSortBy,
                sortBy,
                sortOrder,
                render: (r) => {
                  if (!r.territoryObject) return null;
                  return (
                    <div className="tw-flex tw-items-center tw-justify-center">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalObservation({
                            ...defaultModalObservationState(),
                            open: true,
                            observation: allObservations.find((o) => o._id === r.observation),
                            from: location.pathname,
                          });
                        }}
                        className="tw-truncate tw-bg-black tw-py-0.5 tw-px-1 tw-rounded tw-max-w-24 tw-w-fit tw-text-white tw-text-xs"
                      >
                        {r.territoryObject?.name || ""}
                      </div>
                    </div>
                  );
                },
              },
              {
                title: "Équipe en charge",
                dataKey: "team",
                render: (rencontre) => <TagTeam teamId={rencontre?.team} />,
              },
            ]}
          />
        )}
      </div>
    </>
  );
}

function RencontresTableSmall({ personRencontres }) {
  const history = useHistory();
  const setModalObservation = useSetRecoilState(modalObservationState);
  const allObservations = useRecoilValue(territoryObservationsState);
  return (
    <table className="table table-striped">
      <tbody className="small">
        {(personRencontres || []).map((rencontre) => {
          return (
            <tr
              key={rencontre._id}
              onClick={() => {
                history.push(`/person/${rencontre.person}?rencontreId=${rencontre._id}`);
              }}
            >
              <td>
                <div className="tw-flex tw-text-black50 tw-capitalize tw-mb-1 tw-text-xs tw-items-center">
                  <div className="tw-grow">{formatDateTimeWithNameOfDay(rencontre.date || rencontre.createdAt)}</div>
                  {rencontre.territoryObject && rencontre.observation ? (
                    <div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalObservation({
                            ...defaultModalObservationState(),
                            open: true,
                            observation: allObservations.find((o) => o._id === rencontre.observation),
                            from: location.pathname,
                          });
                        }}
                        className="tw-truncate	 tw-max-w-24	tw-bg-black tw-py-0.5 tw-px-1 tw-rounded tw-text-white tw-text-xs"
                      >
                        {rencontre.territoryObject.name}
                      </div>
                    </div>
                  ) : null}
                </div>
                {rencontre.comment ? (
                  <div style={{ overflowWrap: "anywhere" }}>
                    {(rencontre.comment || "").split("\n").map((e, i) => (
                      <p className="tw-m-0 tw-p-0" key={e + i}>
                        {e}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="tw-flex tw-mt-1 tw-text-xs tw-items-center">
                  <div className="tw-grow tw-text-black50">
                    Créé par <UserName id={rencontre.user} />
                  </div>
                  <div className="tw-max-w-fit">
                    <TagTeam teamId={rencontre.team} />
                  </div>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
