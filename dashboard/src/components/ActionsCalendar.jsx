import { useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { addOneDay, dayjsInstance, formatCalendarDate, formatDateTimeWithNameOfDay, formatTime, subtractOneDay } from "../services/date";
import Table from "./table";
import ActionOrConsultationName from "./ActionOrConsultationName";
import PersonName from "./PersonName";
import StethoscopeIcon from "./StethoscopeIcon";
import { organisationState, userState } from "../atoms/auth";
import { disableConsultationRow } from "../atoms/consultations";
import ExclamationMarkButton from "./tailwind/ExclamationMarkButton";
import { CANCEL, DONE, sortActionsOrConsultations, TODO } from "../atoms/actions";
import TagTeam from "./TagTeam";
import { useLocalStorage } from "../services/useLocalStorage";
import DescriptionIcon from "./DescriptionIcon";
import ActionStatusSelect from "./ActionStatusSelect";
import { defaultModalActionState, modalActionState } from "../atoms/modal";
import DocumentIcon from "./DocumentIcon";
import CommentIcon from "./CommentIcon";
import { UserGroupIcon } from "@heroicons/react/16/solid";
import { MoonIcon } from "@heroicons/react/24/solid";

const ActionsCalendar = ({ actions, isNightSession, columns = ["Heure", "Nom", "Personne suivie", "Créée le", "Statut", "Équipe(s) en charge"] }) => {
  const setModalAction = useSetAtom(modalActionState);
  const history = useHistory();
  const location = useLocation();
  const user = useAtomValue(userState);
  const organisation = useAtomValue(organisationState);
  const [theDayBeforeActions, setTheDayBeforeActions] = useState([]);
  const [theDayAfterActions, setTheDayAfterActions] = useState([]);
  const [theCurrentDayActions, setTheCurrentDayActions] = useState([]);
  const [sortBy, setSortBy] = useLocalStorage("actions-consultations-sortBy", "dueAt");
  const [sortOrder, setSortOrder] = useLocalStorage("actions-consultations-sortOrder", "ASC");

  const [currentDate, setCurrentDate] = useState(() => {
    const savedDate = new URLSearchParams(location.search)?.get("calendarDate");
    if (savedDate) return new Date(savedDate);
    return new Date();
  });
  const [activeTabIndex, setActiveTabIndex] = useState(Number(new URLSearchParams(location.search)?.get("calendarTab") || 1));

  useEffect(() => {
    if (!currentDate) return;
    const filteredActions = actions.filter((a) => a.completedAt || a.dueAt);

    const offsetHours = isNightSession ? 12 : 0;
    const isoStartYesterday = dayjsInstance(currentDate).startOf("day").add(-1, "day").add(offsetHours, "hour").toISOString();
    const isoStartToday = dayjsInstance(currentDate).startOf("day").add(offsetHours, "hour").toISOString();
    const isoStartTomorrow = dayjsInstance(currentDate).startOf("day").add(1, "day").add(offsetHours, "hour").toISOString();
    const isoEndTomorrow = dayjsInstance(currentDate).startOf("day").add(2, "day").add(offsetHours, "hour").toISOString();

    setTheDayBeforeActions(
      filteredActions
        .filter((a) => {
          const date = [DONE, CANCEL].includes(a.status) ? a.completedAt : a.dueAt;
          return date >= isoStartYesterday && date < isoStartToday;
        })
        .sort(sortActionsOrConsultations(sortBy, sortOrder))
    );
    setTheDayAfterActions(
      filteredActions
        .filter((a) => {
          const date = [DONE, CANCEL].includes(a.status) ? a.completedAt : a.dueAt;
          return date >= isoStartTomorrow && date < isoEndTomorrow;
        })
        .sort(sortActionsOrConsultations(sortBy, sortOrder))
    );
    setTheCurrentDayActions(
      filteredActions
        .filter((a) => {
          const date = [DONE, CANCEL].includes(a.status) ? a.completedAt : a.dueAt;
          return date >= isoStartToday && date < isoStartTomorrow;
        })
        .sort(sortActionsOrConsultations(sortBy, sortOrder))
    );
  }, [actions, currentDate, sortBy, sortOrder, isNightSession]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set("calendarDate", dayjsInstance(currentDate).format("YYYY-MM-DD"));
    history.replace({ pathname: location.pathname, search: searchParams.toString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set("calendarTab", activeTabIndex);
    history.replace({ pathname: location.pathname, search: searchParams.toString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabIndex]);

  const renderActionsTable = (actions, date) => (
    <Table
      className="Table"
      noData={`Pas d'action à faire le ${formatDateTimeWithNameOfDay(date)}`}
      data={actions.map((a) => {
        if (a.urgent && a.status === TODO) return { ...a, style: { backgroundColor: "#fecaca99" } };
        if (a.isConsultation) return { ...a, style: { backgroundColor: "#DDF4FF99" } };
        return a;
      })}
      onRowClick={(actionOrConsultation) => {
        const searchParams = new URLSearchParams(history.location.search);
        if (actionOrConsultation.isConsultation) {
          searchParams.set("consultationId", actionOrConsultation._id);
          history.push(`?${searchParams.toString()}`);
        } else {
          setModalAction({ ...defaultModalActionState(), open: true, from: location.pathname, action: actionOrConsultation });
        }
      }}
      rowDisabled={(actionOrConsultation) => disableConsultationRow(actionOrConsultation, user)}
      rowKey="_id"
      dataTestId="name"
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
                    <UserGroupIcon className="tw-w-6 tw-h-6 tw-text-main" aria-label="Action familiale" title="Action familiale" />
                  )}
                  {!!actionOrConsult.isConsultation && <StethoscopeIcon className="tw-w-5 tw-h-5 tw-text-sky-700" />}
                </div>
              </div>
            );
          },
        },
        {
          title: "Heure",
          dataKey: "dueAt",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
          small: true,
          style: { width: "80px" },
          render: (action) => {
            if (!action.dueAt || !action.withTime) return null;
            return <div className="tw-text-center">{formatTime(action.dueAt)}</div>;
          },
        },
        {
          title: "Nom",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
          dataKey: "name",
          render: (action) => {
            return (
              <div className="[overflow-wrap:anywhere]">
                <ActionOrConsultationName item={action} />
              </div>
            );
          },
        },
        {
          title: "Personne suivie",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
          dataKey: "person",
          render: (action) => {
            return (
              <div className="[overflow-wrap:anywhere]">
                <PersonName item={action} />
              </div>
            );
          },
        },
        {
          title: "Statut",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
          dataKey: "status",
          style: { width: "90px" },
          render: (action) => <ActionStatusSelect action={action} />,
        },
        {
          title: "Équipe(s) en charge",
          dataKey: "team",
          render: (a) => (
            <div className="px-2 tw-flex tw-flex-shrink-0 tw-flex-col tw-gap-px">
              {Array.isArray(a?.teams) ? a.teams.map((e) => <TagTeam key={e} teamId={e} />) : <TagTeam teamId={a?.team} />}
            </div>
          ),
        },
      ].filter((column) => columns.includes(column.title) || column.dataKey === "urgentOrGroupOrConsultation")}
    />
  );

  const renderDate = (date, count) => {
    const dateString = formatCalendarDate(date, isNightSession);
    return (
      <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
        {isNightSession && <MoonIcon className="tw-w-3 tw-h-3 tw-text-main" />}
        <div className="tw-truncate">{dateString}</div>
        <div className={`tw-text-xs tw-font-normal tw-rounded tw-text-white tw-px-1 ${count > 0 ? "tw-bg-main" : "tw-bg-gray-500"}`}>{count}</div>
      </div>
    );
  };

  return (
    <>
      <nav className="noprint tw-flex tw-w-full tw-text-sm" aria-label="Tabs">
        <ul
          className={`!tw-p-0 tw-flex tw-w-full tw-overflow-x-auto tw-list-none tw-items-center tw-justify-center tw-gap-1 tw-border-b tw-border-main/10`}
        >
          <Tab isChevron onClick={() => setCurrentDate(subtractOneDay(currentDate))}>
            &lt;
          </Tab>
          <Tab isActive={activeTabIndex === 0} onClick={() => setActiveTabIndex(0)}>
            {renderDate(subtractOneDay(currentDate), theDayBeforeActions.length)}
          </Tab>
          <Tab isActive={activeTabIndex === 1} onClick={() => setActiveTabIndex(1)}>
            {renderDate(currentDate, theCurrentDayActions.length)}
          </Tab>
          <Tab isActive={activeTabIndex === 2} onClick={() => setActiveTabIndex(2)}>
            {renderDate(addOneDay(currentDate), theDayAfterActions.length)}
          </Tab>
          <Tab isChevron onClick={() => setCurrentDate(addOneDay(currentDate))}>
            &gt;
          </Tab>
        </ul>
      </nav>
      <div className="tw-mb-5">
        {!!isNightSession && (
          <p className="tw-m-0 tw-text-center tw-text-xs tw-text-gray-500">
            On affiche les actions faites/à faire entre midi de ce jour et 11h59 du jour suivant
          </p>
        )}
      </div>
      <div>
        {activeTabIndex === 0 && (
          <div className={theDayBeforeActions.length ? "tw-pb-8" : ""}>{renderActionsTable(theDayBeforeActions, subtractOneDay(currentDate))}</div>
        )}
        {activeTabIndex === 1 && (
          <div className={theCurrentDayActions.length ? "tw-pb-8" : ""}>{renderActionsTable(theCurrentDayActions, currentDate)}</div>
        )}
        {activeTabIndex === 2 && (
          <div className={theDayAfterActions.length ? "tw-pb-8" : ""}>{renderActionsTable(theDayAfterActions, addOneDay(currentDate))}</div>
        )}
      </div>
    </>
  );
};

function Tab({ isActive = false, onClick, isChevron = false, children }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={[
          isActive ? "tw-bg-main/10 tw-text-black" : "hover:tw-bg-gray-100 tw-text-main",
          "tw-truncate tw-border-x tw-border-t tw-rounded-t-md tw-border-main/10 tw-py-2 tw-text-sm tw-font-medium",
          isChevron ? "tw-px-3" : "tw-w-40",
        ].join(" ")}
        aria-current={isActive ? "page" : undefined}
      >
        {children}
      </button>
    </li>
  );
}
export default ActionsCalendar;
