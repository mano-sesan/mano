import { useMemo } from "react";
import { useHistory } from "react-router-dom";
import { useStore, defaultModalActionState } from "../store";
import Table from "./table";
import DateBloc, { TimeBlock } from "./DateBloc";
import ActionOrConsultationName from "./ActionOrConsultationName";
import PersonName from "./PersonName";
import { CANCEL, DONE, sortActionsOrConsultations, TODO } from "../recoil/actions";
import ExclamationMarkButton from "./tailwind/ExclamationMarkButton";
import useTitle from "../services/useTitle";
import ConsultationButton from "./ConsultationButton";
import { disableConsultationRow } from "../recoil/consultations";
import TagTeam from "./TagTeam";
import { useLocalStorage } from "../services/useLocalStorage";
import Page from "./pagination";
import useSearchParamState from "../services/useSearchParamState";
import DescriptionIcon from "./DescriptionIcon";
import { AgendaMutedIcon } from "../assets/icons/AgendaMutedIcon";
import ActionStatusSelect from "./ActionStatusSelect";
import UserName from "./UserName";
import DocumentIcon from "./DocumentIcon";
import CommentIcon from "./CommentIcon";

const ActionsSortableList = ({
  data,
  limit = 0,
  localStorageSortByName = "actions-consultations-sortBy",
  localStorageSortOrderName = "actions-consultations-sortOrder",
  defaultOrder = "ASC",
  onAfterActionClick = null,
  columns = ["urgentOrGroupOrConsultation", "dueAt", "name", "person", "status", "team"],
}) => {
  useTitle("Agenda");
  const setModalAction = useStore((state) => state.setModalAction);
  const history = useHistory();
  const user = useStore((state) => state.user);
  const currentTeam = useStore((state) => state.currentTeam);
  const organisation = useStore((state) => state.organisation);
  const [sortBy, setSortBy] = useLocalStorage(localStorageSortByName, "dueAt");
  const [sortOrder, setSortOrder] = useLocalStorage(localStorageSortOrderName, defaultOrder);
  const [page, setPage] = useSearchParamState("page", 0, { resetToDefaultIfTheFollowingValueChange: currentTeam?._id });

  const dataSorted = useMemo(() => {
    return [...data].sort(sortActionsOrConsultations(sortBy, sortOrder)).map((a) => {
      if (a.urgent && a.status === TODO) return { ...a, style: { backgroundColor: "#fecaca99" } };
      if (a.isConsultation) return { ...a, style: { backgroundColor: "#DDF4FF99" } };
      return a;
    });
  }, [data, sortBy, sortOrder]);

  const dataConsolidatedPaginated = useMemo(() => {
    if (limit > 0) return dataSorted.slice(page * limit, (page + 1) * limit);
    return dataSorted;
  }, [dataSorted, page, limit]);

  const total = data.length;

  if (total <= 0) {
    return (
      <div className="tw-mt-8 tw-w-full tw-text-center tw-text-gray-300">
        <AgendaMutedIcon />
        Aucun élément pour le moment
      </div>
    );
  }

  return (
    <>
      <Table
        data={dataConsolidatedPaginated}
        rowKey={"_id"}
        onRowClick={(actionOrConsultation) => {
          const searchParams = new URLSearchParams(history.location.search);
          if (actionOrConsultation.isConsultation) {
            searchParams.set("consultationId", actionOrConsultation._id);
            history.push(`?${searchParams.toString()}`);
          } else {
            setModalAction({ ...defaultModalActionState(), open: true, from: location.pathname, action: actionOrConsultation });
            if (onAfterActionClick) onAfterActionClick(actionOrConsultation);
          }
        }}
        rowDisabled={(actionOrConsultation) => disableConsultationRow(actionOrConsultation, user)}
        columns={[
          {
            title: "",
            dataKey: "urgentOrGroupOrConsultation",
            small: true,
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortBy,
            sortOrder,
            render: (actionOrConsult) => {
              return (
                <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-2">
                  <div className="tw-flex tw-flex-row tw-items-center tw-justify-center tw-gap-2 tw-mt-2">
                    {!!actionOrConsult.description && <DescriptionIcon />}
                    {actionOrConsult.documents?.length ? <DocumentIcon count={actionOrConsult.documents.length} /> : null}
                    {actionOrConsult.comments?.length ? <CommentIcon count={actionOrConsult.comments.length} /> : null}
                  </div>
                  <div className="tw-flex tw-flex-row tw-items-center tw-justify-center tw-gap-2">
                    {!!actionOrConsult.urgent && <ExclamationMarkButton />}
                    {!!organisation.groupsEnabled && !!actionOrConsult.group && (
                      <span className="tw-text-xl" aria-label="Action familiale" title="Action familiale">
                        👪
                      </span>
                    )}
                    {!!actionOrConsult.isConsultation && <ConsultationButton />}
                  </div>
                </div>
              );
            },
          },
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
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortBy,
            sortOrder,
            dataKey: "name",
            render: (action) => <ActionOrConsultationName item={action} />,
          },
          {
            title: "Personne suivie",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortBy,
            sortOrder,
            dataKey: "person",
            render: (action) => <PersonName item={action} />,
          },
          {
            title: "Créée par",
            dataKey: "createdBy",
            render: (action) => <UserName id={action.user} />,
          },
          {
            title: "Statut",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            small: true,
            sortBy,
            sortOrder,
            dataKey: "status",
            style: { width: "85px" },
            render: (action) => <ActionStatusSelect action={action} />,
          },
          {
            title: "Équipe(s) en charge",
            dataKey: "team",
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
        ].filter((c) => columns.includes(c.dataKey))}
      />
      {limit > 0 && <Page page={page} limit={limit} total={total} onChange={({ page }) => setPage(page, true)} />}
    </>
  );
};

export default ActionsSortableList;
