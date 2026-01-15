import React, { useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import Table from "./table";
import ExclamationMarkButton from "./tailwind/ExclamationMarkButton";
import { organisationState, userState } from "../atoms/auth";
import { useAtomValue, useSetAtom } from "jotai";
import UserName from "./UserName";
import TagTeam from "./TagTeam";
import PersonName from "./PersonName";
import { useLocalStorage } from "../services/useLocalStorage";
import DateBloc, { TimeBlock } from "./DateBloc";
import { sortComments } from "../atoms/comments";
import { defaultModalActionState, defaultModalConsultationState, modalActionState, modalConsultationState } from "../atoms/modal";
import { itemsGroupedByActionSelector } from "../atoms/selectors";
import ConsultationButton from "./ConsultationButton";
import { NoComments } from "./CommentsGeneric";
import SelectTeamMultiple from "./SelectTeamMultiple";

export default function CommentsSortableList({
  data,
  className = "",
  fullScreen = false,
  hiddenColumns = [],
  onCommentClick = undefined,
  withFilters = false,
}) {
  const setModalAction = useSetAtom(modalActionState);
  const setModalConsultation = useSetAtom(modalConsultationState);
  const actionsObjects = useAtomValue(itemsGroupedByActionSelector);
  const organisation = useAtomValue(organisationState);
  const user = useAtomValue(userState);
  const [filterTeamIds, setFilterTeamIds] = useState([]);
  const [filterOnlyMine, setFilterOnlyMine] = useState(false);
  const location = useLocation();
  const history = useHistory();
  const [sortOrder, setSortOrder] = useLocalStorage("comments-sortable-list-sortOrder", "ASC");
  const [sortBy, setSortBy] = useLocalStorage("comments-sortable-list-sortBy", "date");

  const dataFiltered = useMemo(() => {
    if (!filterTeamIds.length && !filterOnlyMine) return data;
    return data
      .filter((c) => {
        if (filterTeamIds.length) return filterTeamIds.includes(c.team);
        return true;
      })
      .filter((c) => {
        if (filterOnlyMine) return c.user === user._id;
        return true;
      });
  }, [data, filterTeamIds, filterOnlyMine, user]);

  const dataSorted = useMemo(() => {
    return [...dataFiltered].sort(sortComments(sortBy, sortOrder)).map((c) => {
      if (c.urgent) return { ...c, style: { backgroundColor: "#fecaca99" } };
      return c;
    });
  }, [dataFiltered, sortBy, sortOrder]);

  if (!dataSorted.length) {
    return (
      <>
        {withFilters ? (
          <CommentsFilters
            filterTeamIds={filterTeamIds}
            setFilterTeamIds={setFilterTeamIds}
            filterOnlyMine={filterOnlyMine}
            setFilterOnlyMine={setFilterOnlyMine}
          />
        ) : null}
        <div className="tw-flex tw-flex-col tw-items-center tw-gap-6">
          <NoComments />
        </div>
      </>
    );
  }

  const columns = [];
  if (fullScreen) {
    columns.push({
      title: "",
      dataKey: "urgentOrGroup",
      small: true,
      onSortOrder: setSortOrder,
      onSortBy: setSortBy,
      sortBy,
      sortOrder,
      render: (comment) => {
        return (
          <div className="tw-mt-1 tw-flex tw-items-center tw-justify-center tw-gap-1">
            {!!comment.urgent && <ExclamationMarkButton />}
            {!!organisation.groupsEnabled && !!comment.group && (
              <span className="tw-text-3xl" aria-label="Commentaire familial" title="Commentaire familial">
                👪
              </span>
            )}
            {comment.isMedicalCommentShared ? <ConsultationButton /> : null}
          </div>
        );
      },
    });

    columns.push({
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
    });

    columns.push({
      title: "Type",
      dataKey: "type",
      onSortOrder: setSortOrder,
      onSortBy: setSortBy,
      sortBy,
      sortOrder,
      render: (comment) => {
        return (
          <>
            {comment.type === "person" && "Personne suivie"}
            {comment.type === "action" && "Action"}
            {comment.type === "treatment" && "Traitement"}
            {comment.type === "passage" && "Passage"}
            {comment.type === "rencontre" && "Rencontre"}
            {comment.type === "consultation" && "Consultation"}
            {comment.type === "medical-file" && "Dossier médical"}
          </>
        );
      },
    });

    columns.push({
      title: "Commentaire",
      dataKey: "comment",
      onSortOrder: setSortOrder,
      onSortBy: setSortBy,
      sortBy,
      sortOrder,
      render: (comment) => {
        return (
          <>
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
          </>
        );
      },
    });

    if (!hiddenColumns.includes("person")) {
      columns.push({
        title: "Personne",
        dataKey: "person",
        render: (comment) =>
          comment.type === "passage" && !comment.person ? (
            <span style={{ opacity: 0.3, fontStyle: "italic" }}>Anonyme</span>
          ) : (
            <PersonName item={comment} />
          ),
      });
    }

    columns.push({
      title: "Créé par",
      dataKey: "user",
      render: (comment) => <UserName id={comment.user} />,
    });

    columns.push({
      title: "Équipe en charge",
      dataKey: "team",
      render: (comment) => <TagTeam teamId={comment?.team} />,
    });
  } else {
    columns.push({
      title: "Date",
      dataKey: "date",
      className: "tw-w-24",
      onSortOrder: setSortOrder,
      onSortBy: setSortBy,
      sortBy,
      sortOrder,
      render: (comment) => {
        return (
          <>
            <DateBloc date={comment.date || comment.createdAt} />
            <TimeBlock time={comment.date || comment.createdAt} />
            <div className="tw-mt-1 tw-flex tw-items-center tw-justify-center tw-gap-1">
              {!!comment.urgent && <ExclamationMarkButton />}
              {!!organisation.groupsEnabled && !!comment.group && (
                <span className="tw-text-3xl" aria-label="Commentaire familial" title="Commentaire familial">
                  👪
                </span>
              )}
            </div>
            {comment.isMedicalCommentShared ? (
              <div className="tw-mt-1 tw-flex tw-items-center tw-justify-center tw-gap-1">
                <ConsultationButton />
              </div>
            ) : null}
          </>
        );
      },
    });

    columns.push({
      title: "Commentaire",
      dataKey: "comment",
      render: (comment) => {
        return (
          <>
            <p>
              {comment.type === "action" && (
                <>
                  Action <b>{comment.actionPopulated?.name} </b>
                  pour{" "}
                </>
              )}
              {comment.type === "treatment" && <>Traitement pour </>}
              {comment.type === "passage" && <>Passage pour </>}
              {comment.type === "rencontre" && <>Rencontre pour </>}
              {comment.type === "person" && <>Personne suivie </>}
              {comment.type === "consultation" && <>Consultation pour </>}
              {comment.type === "medical-file" && <>Personne suivie </>}
              <b>
                <PersonName item={comment} />
              </b>
            </p>
            <p className="tw-mb-4">
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
            <p className="tw-font-medium tw-italic">
              Par: <UserName id={comment.user} />
            </p>
          </>
        );
      },
    });

    columns.push({
      title: "Équipe en charge",
      dataKey: "team",
      render: (comment) => <TagTeam teamId={comment?.team} />,
    });
  }

  return (
    <>
      {withFilters ? (
        <CommentsFilters
          filterTeamIds={filterTeamIds}
          setFilterTeamIds={setFilterTeamIds}
          filterOnlyMine={filterOnlyMine}
          setFilterOnlyMine={setFilterOnlyMine}
        />
      ) : null}
      <Table
        className={className}
        data={dataSorted}
        onRowClick={(comment) => {
          if (onCommentClick) return onCommentClick(comment);
          const searchParams = new URLSearchParams(history.location.search);
          if (comment.isMedicalCommentShared) return;
          switch (comment.type) {
            case "action":
              setModalAction({ ...defaultModalActionState(), open: true, from: location.pathname, action: actionsObjects[comment.action] });
              break;
            case "person":
              history.push(`/person/${comment.person}`);
              break;
            case "consultation":
              setModalConsultation({ ...defaultModalConsultationState(), open: true, from: location.pathname, consultation: comment.consultation });
              break;
            case "treatment":
              searchParams.set("treatmentId", comment.treatment._id);
              history.push(`?${searchParams.toString()}`);
              break;
            case "passage":
              history.push(`/person/${comment.person}?passageId=${comment.passage}`);
              break;
            case "rencontre":
              history.push(`/person/${comment.person}?rencontreId=${comment.rencontre}`);
              break;
            case "medical-file":
              history.push(`/person/${comment.person}?tab=Dossier+Médical`);
              break;
            default:
              break;
          }
        }}
        rowDisabled={(comment) => comment.isMedicalCommentShared || (comment.type === "passage" && !comment.person)}
        rowKey="_id"
        dataTestId="comment"
        columns={columns}
      />
    </>
  );
}

function CommentsFilters({ filterTeamIds, setFilterTeamIds, filterOnlyMine, setFilterOnlyMine }) {
  return (
    <div className="tw-grid tw-grid-cols-2 tw-gap-4 tw-mb-2 tw-items-end">
      <div>
        <label htmlFor="action-select-categories-filter" className="tw-text-xs">
          Filtrer par équipe
        </label>
        <SelectTeamMultiple onChange={(teamIds) => setFilterTeamIds(teamIds)} value={filterTeamIds} colored inputId="action-team-select" />
      </div>
      <div>
        <div className="tw-flex tw-items-center tw-mb-2">
          <input
            type="checkbox"
            id="my-comments-filter"
            className="tw-mr-2"
            checked={filterOnlyMine}
            onChange={(e) => setFilterOnlyMine(e.target.checked)}
          />
          <label htmlFor="my-comments-filter" className="tw-mb-0 tw-text-sm">
            Afficher uniquement mes commentaires
          </label>
        </div>
      </div>
    </div>
  );
}
