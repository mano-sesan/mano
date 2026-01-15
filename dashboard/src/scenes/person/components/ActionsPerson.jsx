import { useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { organisationState, teamsState, userState } from "../../../atoms/auth";
import { CANCEL, defaultActionForModal, DONE, flattenedActionsCategoriesSelector, mappedIdsToLabels, TODO } from "../../../atoms/actions";
import { useLocation } from "react-router-dom";
import SelectCustom from "../../../components/SelectCustom";
import ExclamationMarkButton from "../../../components/tailwind/ExclamationMarkButton";
import TagTeam from "../../../components/TagTeam";
import ActionOrConsultationName from "../../../components/ActionOrConsultationName";
import { dayjsInstance, formatDateWithNameOfDay, formatTime } from "../../../services/date";
import { ModalHeader, ModalBody, ModalContainer, ModalFooter } from "../../../components/tailwind/Modal";
import { AgendaMutedIcon } from "../../../assets/icons/AgendaMutedIcon";
import { FullScreenIcon } from "../../../assets/icons/FullScreenIcon";
import UserName from "../../../components/UserName";
import { itemsGroupedByPersonSelector } from "../../../atoms/selectors";
import DescriptionIcon from "../../../components/DescriptionIcon";
import SelectTeamMultiple from "../../../components/SelectTeamMultiple";
import ActionStatusSelect from "../../../components/ActionStatusSelect";
import { defaultModalActionState, modalActionState } from "../../../atoms/modal";
import { actionsWithoutFutureRecurrences } from "../../../utils/recurrence";
import ActionsSortableList from "../../../components/ActionsSortableList";
import CommentIcon from "../../../components/CommentIcon";
import DocumentIcon from "../../../components/DocumentIcon";
import { UserGroupIcon } from "@heroicons/react/16/solid";

// Hook to filter person actions (replaces selectorFamily)
function useFilteredPersonActions({ personId, filterCategories, filterStatus, filterTeamIds }) {
  const itemsGroupedByPerson = useAtomValue(itemsGroupedByPersonSelector);

  return useMemo(() => {
    const person = itemsGroupedByPerson[personId];
    let actionsToSet = person?.actions || [];

    // Process sur les actions pour les récurrentes
    actionsToSet = actionsWithoutFutureRecurrences(actionsToSet);

    if (filterCategories.length) {
      actionsToSet = actionsToSet.filter((a) =>
        filterCategories.some((c) => (c === "-- Aucune --" ? a.categories?.length === 0 : a.categories?.includes(c)))
      );
    }
    if (filterStatus.length) {
      actionsToSet = actionsToSet.filter((a) => filterStatus.some((s) => a.status === s));
    }
    if (filterTeamIds.length) {
      actionsToSet = actionsToSet.filter((action) => {
        if (Array.isArray(action.teams)) {
          if (!filterTeamIds.some((t) => action.teams.includes(t))) return false;
        } else {
          if (!filterTeamIds.includes(action.team)) return false;
        }
        return true;
      });
    }
    return [...actionsToSet]
      .sort((p1, p2) => ((p1.completedAt || p1.dueAt) > (p2.completedAt || p2.dueAt) ? -1 : 1))
      .map((a) => (a.urgent && a.status === TODO ? { ...a, style: { backgroundColor: "#fecaca99" } } : a));
  }, [itemsGroupedByPerson, personId, filterCategories, filterStatus, filterTeamIds]);
}

export const Actions = ({ person }) => {
  const teams = useAtomValue(teamsState);
  const user = useAtomValue(userState);
  const organisation = useAtomValue(organisationState);
  const setModalAction = useSetAtom(modalActionState);
  const data = person?.actions || [];
  const [fullScreen, setFullScreen] = useState(false);
  const [filterCategories, setFilterCategories] = useState([]);
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterTeamIds, setFilterTeamIds] = useState([]);
  const filteredData = useFilteredPersonActions({ personId: person._id, filterCategories, filterStatus, filterTeamIds });

  return (
    <section title="Actions de la personne suivie" className="tw-relative tw-overflow-x-hidden">
      <div className="tw-sticky tw-top-0 tw-z-10 tw-flex tw-bg-white tw-p-3 tw-shadow-sm">
        <h4 className="tw-flex-1 tw-text-xl">Actions {filteredData.length ? `(${filteredData.length})` : ""}</h4>
        <div className="flex-col tw-flex tw-items-center tw-gap-2">
          <button
            aria-label="Ajouter une action"
            className="tw-text-md tw-h-8 tw-w-8 tw-rounded-full tw-bg-main tw-font-bold tw-text-white tw-transition hover:tw-scale-125"
            onClick={() => {
              setModalAction({
                ...defaultModalActionState(),
                open: true,
                from: location.pathname,
                isEditing: true,
                action: defaultActionForModal({
                  dueAt: dayjsInstance().toISOString(),
                  teams: teams.length === 1 ? [teams[0]._id] : [],
                  person: person._id,
                  user: user._id,
                  organisation: organisation._id,
                }),
              });
            }}
          >
            ＋
          </button>
          {Boolean(filteredData.length) && (
            <button
              title="Passer les actions en plein écran"
              className="tw-h-6 tw-w-6 tw-rounded-full tw-text-main tw-transition hover:tw-scale-125"
              onClick={() => setFullScreen(true)}
            >
              <FullScreenIcon />
            </button>
          )}
        </div>
      </div>
      <ActionsFilters
        data={data}
        setFilterCategories={setFilterCategories}
        filterCategories={filterCategories}
        setFilterStatus={setFilterStatus}
        filterStatus={filterStatus}
        setFilterTeamIds={setFilterTeamIds}
        filterTeamIds={filterTeamIds}
      />
      <ModalContainer open={!!fullScreen} className="" size="5xl" onClose={() => setFullScreen(false)}>
        <ModalHeader title={`Actions de  ${person?.name} (${filteredData.length})`}>
          <div className="tw-mt-2 tw-w-full tw-px-8">
            <ActionsFilters
              data={data}
              setFilterCategories={setFilterCategories}
              filterCategories={filterCategories}
              setFilterStatus={setFilterStatus}
              filterStatus={filterStatus}
              setFilterTeamIds={setFilterTeamIds}
              filterTeamIds={filterTeamIds}
            />
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="tw-px-4">
            <ActionsSortableList data={filteredData} columns={["urgentOrGroupOrConsultation", "dueAt", "createdBy", "name", "status", "team"]} />
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" name="cancel" className="button-cancel" onClick={() => setFullScreen(false)}>
            Fermer
          </button>
          <button
            type="button"
            className="button-submit"
            onClick={() => {
              setModalAction({
                ...defaultModalActionState(),
                open: true,
                from: location.pathname,
                isEditing: true,
                action: defaultActionForModal({
                  dueAt: dayjsInstance().toISOString(),
                  teams: teams.length === 1 ? [teams[0]._id] : [],
                  person: person._id,
                  user: user._id,
                  organisation: organisation._id,
                }),
              });
            }}
          >
            ＋ Ajouter une action
          </button>
        </ModalFooter>
      </ModalContainer>
      <ActionsTable filteredData={filteredData} />
    </section>
  );
};

const ActionsFilters = ({ data, setFilterCategories, setFilterTeamIds, setFilterStatus, filterStatus, filterTeamIds, filterCategories }) => {
  const categories = useAtomValue(flattenedActionsCategoriesSelector);

  const catsSelect = ["-- Aucune --", ...(categories || [])];
  return (
    <>
      {data.length ? (
        <div className="tw-mb-4 tw-flex tw-justify-between">
          <div className="tw-shrink-0 tw-grow tw-basis-1/3 tw-pl-2 tw-pr-1">
            <label htmlFor="action-select-categories-filter" className="tw-text-xs">
              Filtrer par catégorie
            </label>
            <div className="tw-max-w-full">
              <SelectCustom
                options={catsSelect.map((_option) => ({ value: _option, label: _option }))}
                value={filterCategories?.map((_option) => ({ value: _option, label: _option })) || []}
                getOptionValue={(i) => i.value}
                getOptionLabel={(i) => i.label}
                onChange={(values) => setFilterCategories(values.map((v) => v.value))}
                inputId="action-select-categories-filter"
                name="categories"
                isClearable
                isMulti
              />
            </div>
          </div>
          <div className="tw-shrink-0 tw-grow tw-basis-1/3 tw-px-1">
            <label htmlFor="action-select-categories-filter" className="tw-text-xs">
              Filtrer par équipe
            </label>
            <SelectTeamMultiple onChange={(teamIds) => setFilterTeamIds(teamIds)} value={filterTeamIds} colored inputId="action-team-select" />
          </div>
          <div className="tw-shrink-0 tw-grow tw-basis-1/3 tw-pl-1 tw-pr-2">
            <label htmlFor="action-select-status-filter" className="tw-text-xs">
              Filtrer par statut
            </label>
            <SelectCustom
              inputId="action-select-status-filter"
              options={mappedIdsToLabels}
              getOptionValue={(s) => s._id}
              getOptionLabel={(s) => s.name}
              name="status"
              onChange={(s) => setFilterStatus(s.map((s) => s._id))}
              isClearable
              isMulti
              value={mappedIdsToLabels.filter((s) => filterStatus.includes(s._id))}
            />
          </div>
        </div>
      ) : (
        <div className="tw-mt-8 tw-w-full tw-text-center tw-text-gray-300">
          <AgendaMutedIcon />
          Aucune action pour le moment
        </div>
      )}
    </>
  );
};

const ActionsTable = ({ filteredData }) => {
  const location = useLocation();
  const setModalAction = useSetAtom(modalActionState);
  const organisation = useAtomValue(organisationState);

  return (
    <table className="table table-striped">
      <tbody className="small">
        {filteredData.map((action) => {
          const date = formatDateWithNameOfDay([DONE, CANCEL].includes(action.status) ? action.completedAt : action.dueAt);
          const time = action.withTime && action.dueAt ? ` ${formatTime(action.dueAt)}` : "";
          return (
            <tr key={action._id}>
              <td>
                <div
                  className="tw-cursor-pointer tw-py-2"
                  onClick={() => {
                    setModalAction({ ...defaultModalActionState(), open: true, from: location.pathname, action });
                  }}
                >
                  <div className="tw-flex">
                    <div className="tw-flex tw-flex-1 tw-items-center tw-gap-x-2">
                      {action.urgent ? <ExclamationMarkButton /> : null}
                      {!!organisation.groupsEnabled && !!action.group && (
                        <UserGroupIcon className="tw-w-6 tw-h-6 tw-text-main" aria-label="Action familiale" title="Action familiale" />
                      )}
                      {action.description ? <DescriptionIcon /> : null}
                      {action.documents?.length ? <DocumentIcon count={action.documents.length} /> : null}
                      {action.comments?.length ? <CommentIcon count={action.comments.length} /> : null}
                      <div>{`${date}${time}`}</div>
                    </div>
                    <div>
                      <ActionStatusSelect action={action} />
                    </div>
                  </div>
                  <div className="tw-mt-2 tw-flex">
                    <div className="tw-flex tw-flex-1 tw-flex-row tw-items-start">
                      <div className="tw-flex tw-grow tw-flex-col tw-items-start">
                        <ActionOrConsultationName item={action} />
                        {action.recurrence && action.nextOccurrence && (
                          <div className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-italic tw-text-main">
                            Occurrence suivante le {action.nextOccurrence.format("DD/MM/YYYY")}
                          </div>
                        )}
                      </div>
                      <div className="tw-flex tw-h-full tw-shrink-0 tw-flex-col tw-justify-center tw-gap-px">
                        {Array.isArray(action?.teams) ? action.teams.map((e) => <TagTeam key={e} teamId={e} />) : <TagTeam teamId={action?.team} />}
                      </div>
                    </div>
                  </div>
                  <div className="-tw-mb-2 tw-mt-2 tw-flex tw-basis-full tw-gap-1 tw-text-xs tw-opacity-50 [overflow-wrap:anywhere]">
                    <span>Créée par</span>
                    <UserName id={action.user} />
                  </div>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
