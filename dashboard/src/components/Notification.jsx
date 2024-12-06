import dayjs from "dayjs";
import React, { useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { selectorFamily, useRecoilValue, useSetRecoilState } from "recoil";
import { useLocalStorage } from "../services/useLocalStorage";
import { CANCEL, DONE, encryptAction, sortActionsOrConsultations, TODO } from "../recoil/actions";
import { currentTeamState, userState } from "../recoil/auth";
import { commentsState, encryptComment, sortComments } from "../recoil/comments";
import { personsState } from "../recoil/persons";
import DateBloc, { TimeBlock } from "./DateBloc";
import Table from "./table";
import UserName from "./UserName";
import API, { tryFetchExpectOk } from "../services/api";
import { ModalContainer, ModalBody, ModalFooter } from "./tailwind/Modal";
import PersonName from "./PersonName";
import BellIconWithNotifications from "../assets/icons/BellIconWithNotifications";
import ActionOrConsultationName from "./ActionOrConsultationName";
import TagTeam from "./TagTeam";
import { defaultModalActionState, modalActionState } from "../recoil/modal";
import { arrayOfitemsGroupedByActionSelector, itemsGroupedByActionSelector } from "../recoil/selectors";
import { actionsWithoutFutureRecurrences } from "../utils/recurrence";
import { useDataLoader } from "../services/dataLoader";

const actionsUrgentSelector = selectorFamily({
  key: "actionsUrgentSelector",
  get:
    ({ actionsSortBy, actionsSortOrder }) =>
    ({ get }) => {
      const actions = get(arrayOfitemsGroupedByActionSelector);
      const currentTeam = get(currentTeamState);
      return actionsWithoutFutureRecurrences(
        actions.filter((action) => {
          return (
            (Array.isArray(action.teams) ? action.teams.includes(currentTeam?._id) : action.team === currentTeam?._id) &&
            action.status === TODO &&
            action.urgent
          );
        })
      ).sort(sortActionsOrConsultations(actionsSortBy, actionsSortOrder));
    },
});

const commentsUrgentSelector = selectorFamily({
  key: "commentsUrgentSelector",
  get:
    () =>
    ({ get }) => {
      const actions = get(itemsGroupedByActionSelector);
      const persons = get(personsState);
      const comments = get(commentsState);
      const currentTeam = get(currentTeamState);
      return comments
        .filter((c) => c.urgent && (Array.isArray(c.teams) ? c.teams.includes(currentTeam?._id) : c.team === currentTeam?._id))
        .map((comment) => {
          const commentPopulated = { ...comment };
          if (comment.person) {
            const id = comment?.person;
            commentPopulated.personPopulated = persons.find((p) => p._id === id);
            commentPopulated.type = "person";
          }
          if (comment.action) {
            const id = comment?.action;
            const action = actions[id];
            commentPopulated.actionPopulated = action;
            commentPopulated.personPopulated = persons.find((p) => p._id === action?.person);
            commentPopulated.type = "action";
          }
          return commentPopulated;
        })
        .filter((c) => c.actionPopulated || c.personPopulated)
        .sort((a, b) => dayjs(a.createdAt).diff(dayjs(b.createdAt)));
    },
});

export default function Notification() {
  const [actionsSortBy, setActionsSortBy] = useLocalStorage("actions-consultations-sortBy", "dueAt");
  const [actionsSortOrder, setActionsSortOrder] = useLocalStorage("actions-consultations-sortOrder", "ASC");
  const [showModal, setShowModal] = useState(false);
  const actions = useRecoilValue(actionsUrgentSelector({ actionsSortBy, actionsSortOrder }));
  const comments = useRecoilValue(commentsUrgentSelector());

  if (!actions.length && !comments.length) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Actions et commentaires urgents et vigilance"
        className="tw-flex tw-self-center"
        onClick={() => setShowModal(true)}
      >
        <BellIconWithNotifications size={24} notificationsNumber={actions.length + comments.length} />
      </button>
      <ModalContainer open={showModal} onClose={() => setShowModal(false)} size="full">
        <ModalBody className="relative tw-mb-6">
          <NotificationActionList
            setShowModal={setShowModal}
            actions={actions}
            setSortOrder={setActionsSortOrder}
            setSortBy={setActionsSortBy}
            sortBy={actionsSortBy}
            sortOrder={actionsSortOrder}
          />
          <NotificationCommentList setShowModal={setShowModal} comments={comments} />
        </ModalBody>
        <ModalFooter>
          <button type="button" name="cancel" className="button-cancel" onClick={() => setShowModal(false)}>
            Fermer
          </button>
        </ModalFooter>
      </ModalContainer>
    </>
  );
}

export const NotificationActionList = ({ setShowModal, actions, setSortOrder, setSortBy, sortBy, sortOrder, title, showTeam = false }) => {
  const history = useHistory();
  const setModalAction = useSetRecoilState(modalActionState);
  const location = useLocation();

  const user = useRecoilValue(userState);
  const { refresh } = useDataLoader();
  if (!actions.length) return null;
  return (
    <div role="dialog" title="Actions urgentes et vigilance" name="Actions urgentes et vigilance">
      <h3 className="tw-mb-0 tw-flex tw-w-full tw-max-w-full tw-shrink-0 tw-items-center tw-justify-between tw-rounded-t-lg tw-border-b tw-border-gray-200 tw-bg-white tw-px-4 tw-py-4 tw-text-lg tw-font-medium tw-leading-6 tw-text-gray-900 sm:tw-px-6">
        {title || "Actions urgentes et vigilance de l'équipe"}
      </h3>
      <div className="tw-mx-2">
        <Table
          data={actions}
          rowKey={"_id"}
          dataTestId="name"
          onRowClick={(action) => {
            setShowModal(false);
            setModalAction({ ...defaultModalActionState(), open: true, from: location.pathname, action: action });
          }}
          columns={[
            {
              title: "Date",
              dataKey: "dueAt",
              onSortOrder: setSortOrder,
              onSortBy: setSortBy,
              sortBy,
              sortOrder,
              style: { width: "90px" },
              small: true,
              render: (action) => {
                return (
                  <>
                    <DateBloc date={[DONE, CANCEL].includes(action.status) ? action.completedAt : action.dueAt} />
                    {!action.dueAt || !action.withTime ? null : <TimeBlock time={action.dueAt} />}
                  </>
                );
              },
            },
            {
              title: "Nom",
              dataKey: "name",
              onSortOrder: setSortOrder,
              onSortBy: setSortBy,
              sortBy,
              sortOrder,
              render: (action) => (
                <>
                  <ActionOrConsultationName item={action} />
                  {action.recurrence && action.nextOccurrence && (
                    <div className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-italic tw-text-main">
                      Occurrence suivante le {action.nextOccurrence.format("DD/MM/YYYY")}
                    </div>
                  )}
                </>
              ),
            },
            {
              title: "Personne suivie",
              dataKey: "person",
              onSortOrder: setSortOrder,
              onSortBy: setSortBy,
              sortBy,
              sortOrder,
              render: (action) => (
                <PersonName
                  item={action}
                  onClick={() => {
                    setShowModal(false);
                    history.push(`/person/${action.person}?tab=Résumé`);
                  }}
                />
              ),
            },
            ...(showTeam
              ? [
                  {
                    title: "Équipe(s) en charge",
                    dataKey: "team",
                    style: { width: "180px" },
                    render: (a) => {
                      if (!Array.isArray(a?.teams)) return <TagTeam teamId={a?.team} />;
                      return (
                        <div className="tw-flex tw-flex-col">
                          {a.teams.map((e) => (
                            <TagTeam key={e} teamId={e} />
                          ))}
                        </div>
                      );
                    },
                  },
                ]
              : []),
            {
              title: "",
              dataKey: "urgent",
              small: true,
              className: "!tw-min-w-0 !tw-w-4",
              render: (action) => {
                return (
                  <button
                    className="button-destructive !tw-ml-0"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const [error] = await tryFetchExpectOk(async () =>
                        API.put({
                          path: `/action/${action._id}`,
                          body: await encryptAction({ ...action, urgent: false, user: action.user || user._id }),
                        })
                      );
                      if (!error) {
                        await refresh();
                      }
                    }}
                  >
                    Déprioriser
                  </button>
                );
              },
            },
          ]}
        />
      </div>
    </div>
  );
};

export const NotificationCommentList = ({ setShowModal, comments, title, showTeam = false }) => {
  const actionsObjects = useRecoilValue(itemsGroupedByActionSelector);
  const history = useHistory();
  const setModalAction = useSetRecoilState(modalActionState);
  const location = useLocation();
  const user = useRecoilValue(userState);
  const currentTeam = useRecoilValue(currentTeamState);
  const { refresh } = useDataLoader();
  const [sortOrder, setSortOrder] = useLocalStorage("comments-notification-sortOrder", "ASC");
  const [sortBy, setSortBy] = useLocalStorage("comments-notification-sortBy", "date");

  console.log(sortBy, sortOrder);

  const dataSorted = useMemo(() => {
    return [...comments].sort(sortComments(sortBy, sortOrder));
  }, [comments, sortBy, sortOrder]);

  if (!dataSorted.length) return null;

  return (
    <div role="dialog" title="Commentaires urgents et vigilance" name="Commentaires urgents et vigilance">
      <h3 className="tw-mb-0 tw-flex tw-w-full tw-max-w-full tw-shrink-0 tw-items-center tw-justify-between tw-border-y tw-border-gray-200 tw-bg-white tw-px-4 tw-py-4 tw-text-lg tw-font-medium tw-leading-6 tw-text-gray-900 sm:tw-px-6">
        {title || "Commentaires urgents et vigilance de l'équipe"}
      </h3>
      <div className="tw-mx-2">
        <Table
          data={dataSorted}
          rowKey={"_id"}
          dataTestId="comment"
          onRowClick={(comment) => {
            setShowModal(false);
            if (comment.type === "action") {
              setModalAction({ ...defaultModalActionState(), open: true, from: location.pathname, action: actionsObjects[comment.action] });
            } else {
              history.push(`/person/${comment.person}`);
            }
          }}
          columns={[
            {
              title: "Date",
              dataKey: "date",
              style: { width: "90px" },
              onSortOrder: setSortOrder,
              onSortBy: setSortBy,
              sortBy,
              sortOrder,
              render: (comment) => {
                return (
                  <>
                    <DateBloc date={comment.date || comment.createdAt} />
                    <TimeBlock time={comment.date || comment.createdAt} />
                  </>
                );
              },
            },
            {
              title: "Commentaire",
              dataKey: "comment",
              onSortOrder: setSortOrder,
              onSortBy: setSortBy,
              sortBy,
              sortOrder,
              render: (comment) => {
                return (
                  <>
                    {comment.type === "action" && (
                      <p>
                        Action <b>{comment.actionPopulated?.name} </b>
                        pour{" "}
                        <b>
                          <PersonName
                            item={comment}
                            onClick={() => {
                              setShowModal(false);
                              history.push(`/person/${comment.personPopulated._id}?tab=Résumé`);
                            }}
                          />
                        </b>
                      </p>
                    )}
                    {comment.type === "person" && (
                      <p>
                        Personne suivie:{" "}
                        <b>
                          <PersonName
                            onClick={() => {
                              setShowModal(false);
                              history.push(`/person/${comment.person}?tab=Résumé`);
                            }}
                            item={comment}
                          />
                        </b>
                      </p>
                    )}
                    <p>
                      {comment.comment
                        ? comment.comment.split("\n").map((c, i, a) => {
                            if (i === a.length - 1) return c;
                            return (
                              <React.Fragment key={i}>
                                {c}
                                <br />
                              </React.Fragment>
                            );
                          })
                        : ""}
                    </p>
                  </>
                );
              },
            },
            {
              title: "Utilisateur",
              dataKey: "user",
              onSortOrder: setSortOrder,
              onSortBy: setSortBy,
              sortBy,
              sortOrder,
              render: (comment) => <UserName id={comment.user} />,
            },
            ...(showTeam
              ? [
                  {
                    title: "Équipe en charge",
                    dataKey: "team",
                    style: { width: "180px" },
                    onSortOrder: setSortOrder,
                    onSortBy: setSortBy,
                    sortBy,
                    sortOrder,
                    render: (comment) => (
                      <div className="tw-flex tw-flex-col">
                        <TagTeam teamId={comment?.team} />
                      </div>
                    ),
                  },
                ]
              : []),
            {
              title: "",
              dataKey: "urgent",
              small: true,
              className: "!tw-min-w-0 !tw-w-4",
              render: (comment) => {
                return (
                  <button
                    className="button-destructive !tw-ml-0"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const [error] = await tryFetchExpectOk(async () =>
                        API.put({
                          path: `/comment/${comment._id}`,
                          body: await encryptComment({
                            ...comment,
                            user: comment.user || user._id,
                            team: comment.team || currentTeam._id,
                            urgent: false,
                          }),
                        })
                      );
                      if (!error) {
                        await refresh();
                      }
                    }}
                  >
                    Déprioriser
                  </button>
                );
              },
            },
          ]}
        />
      </div>
    </div>
  );
};
