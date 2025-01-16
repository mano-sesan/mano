import {
  sqlSelectActionByActionCategory,
  sqlSelectActionByActionCategoryCount,
  sqlSelectPersonnesByActionCategory,
  sqlSelectPersonnesByActionCategoryCount,
} from "./queries";
import { useEffect, useMemo } from "react";
import { useState } from "react";
import { StatsContext } from "./queries";
import { useRecoilValue } from "recoil";
import SelectCustom from "../../components/SelectCustom";
import { actionsCategoriesSelector, DONE, flattenedActionsCategoriesSelector, mappedIdsToLabels } from "../../recoil/actions";
import { useLocalStorage } from "../../services/useLocalStorage";
import { CustomResponsiveBar } from "../stats/Charts";
import { SelectedPersonsModal } from "../stats/PersonsStats";
import { SelectedActionsModal } from "../stats/ActionsStats";

type PersonLoose = {
  [key: string]: string | undefined | null | string[] | number | boolean;
};

export function StatsActions({ context }: { context: StatsContext }) {
  const [openAction, setOpenAction] = useState(false);
  const [openPersonne, setOpenPersonne] = useState(false);
  const [sliceTitle, setSliceTitle] = useState<string | null>(null);
  const [sliceValue, setSliceValue] = useState<string | null>(null);
  const [slicedData, setSlicedData] = useState<PersonLoose[]>([]);
  const groupsCategories = useRecoilValue(actionsCategoriesSelector);
  const allCategories = useRecoilValue(flattenedActionsCategoriesSelector);
  const [actionsStatuses, setActionsStatuses] = useLocalStorage("stats-actionsStatuses", [DONE]);
  const [actionsCategoriesGroups, setActionsCategoriesGroups] = useLocalStorage("stats-catGroups", []);
  const [actionsCategories, setActionsCategories] = useLocalStorage("stats-categories", []);
  const filterableActionsCategories = useMemo(() => {
    if (!actionsCategoriesGroups.length) return ["-- Aucune --", ...allCategories];
    return groupsCategories
      .filter((group) => actionsCategoriesGroups.includes(group.groupTitle))
      .reduce((filteredCats, group) => [...filteredCats, ...group.categories], []);
  }, [actionsCategoriesGroups, allCategories, groupsCategories]);

  const openModalPersonne = (title: string, value: string, data: PersonLoose[]) => {
    setSliceTitle(title);
    setSliceValue(value);
    setSlicedData(data);
    setOpenPersonne(true);
  };

  const openModalAction = (title: string, value: string, data: PersonLoose[]) => {
    setSliceTitle(title);
    setSliceValue(value);
    setSlicedData(data);
    setOpenAction(true);
  };

  return (
    <>
      <div className="tw-grid lg:tw-grid-cols-3 tw-grid-cols-1 tw-gap-2 tw-mb-8">
        <div>
          <label htmlFor="filter-by-status" className="tw-m-0">
            Filtrer par statut
          </label>
          <div>
            <SelectCustom
              inputId="action-select-status-filter"
              options={mappedIdsToLabels}
              getOptionValue={(s) => s._id}
              getOptionLabel={(s) => s.name}
              name="action-status"
              onChange={(s) => setActionsStatuses(s.map((s) => s._id))}
              isClearable
              isMulti
              value={mappedIdsToLabels.filter((s) => actionsStatuses.includes(s._id))}
            />
          </div>
        </div>
        <div>
          <label htmlFor="filter-by-status" className="tw-m-0">
            Filtrer par groupe de catégories
          </label>
          <div>
            <SelectCustom
              value={actionsCategoriesGroups?.map((_option) => ({ value: _option, label: _option })) || []}
              options={groupsCategories.map((group) => group.groupTitle).map((_option) => ({ value: _option, label: _option }))}
              getOptionValue={(s) => s.value}
              getOptionLabel={(s) => s.label}
              onChange={(groups) => setActionsCategoriesGroups(groups.map((s) => s.value))}
              name="action-category-group"
              inputId="action-select-group-category-filter"
              isClearable
              isMulti
            />
          </div>
        </div>
        <div>
          <label htmlFor="filter-by-status" className="tw-m-0">
            Filtrer par catégorie
          </label>
          <div>
            <SelectCustom
              options={filterableActionsCategories.map((_option) => ({ value: _option, label: _option }))}
              value={actionsCategories?.map((_option) => ({ value: _option, label: _option })) || []}
              getOptionValue={(s) => s.value}
              getOptionLabel={(s) => s.label}
              onChange={(categories) => setActionsCategories(categories.map((s) => s.value))}
              inputId="action-select-category-filter"
              name="action-category"
              isClearable
              isMulti
            />
          </div>
        </div>
      </div>
      <div className="tw-flex tw-flex-col tw-gap-4">
        <ActionsByCategoryGroup
          context={context}
          actionsCategories={actionsCategories}
          actionsCategoriesGroups={actionsCategoriesGroups}
          actionsStatuses={actionsStatuses}
          onSliceClick={(value, data) => {
            openModalAction("Groupe de catégories", value, data);
          }}
        />
        <ActionsByCategory
          context={context}
          actionsCategories={actionsCategories}
          actionsCategoriesGroups={actionsCategoriesGroups}
          actionsStatuses={actionsStatuses}
          onSliceClick={(value, data) => {
            openModalAction("Catégorie", value, data);
          }}
        />
        <PersonnesByCategory
          context={context}
          actionsCategories={actionsCategories}
          actionsCategoriesGroups={actionsCategoriesGroups}
          actionsStatuses={actionsStatuses}
          onSliceClick={(value, data) => {
            openModalPersonne("Catégorie", value, data);
          }}
        />
      </div>
      <SelectedPersonsModal
        open={openPersonne}
        onClose={() => {
          setOpenPersonne(false);
        }}
        persons={slicedData}
        sliceField={null}
        onAfterLeave={() => {
          setSliceValue(null);
          setSlicedData([]);
          setSliceTitle(null);
        }}
        title={`${sliceTitle} : ${sliceValue} (${slicedData.length})`}
      />
      <SelectedActionsModal
        open={openAction}
        onClose={() => {
          setOpenAction(false);
        }}
        data={slicedData}
        title={`${sliceTitle} : ${sliceValue} (${slicedData.length})`}
        onAfterLeave={() => {
          setSliceValue(null);
          setSlicedData([]);
          setSliceTitle(null);
        }}
      />
    </>
  );
}

function ActionsByCategory({
  context,
  actionsCategories,
  actionsCategoriesGroups,
  actionsStatuses,
  onSliceClick,
}: {
  context: StatsContext;
  actionsCategories: string[];
  actionsCategoriesGroups: string[];
  actionsStatuses: string[];
  onSliceClick: (value: string, data: PersonLoose[]) => void;
}) {
  const groupsCategories = useRecoilValue(actionsCategoriesSelector);
  const [actions, setActions] = useState<{ actionCategory: string; total: string }[]>([]);
  useEffect(() => {
    sqlSelectActionByActionCategoryCount(context, actionsCategories, actionsStatuses).then((res) => {
      if (!actionsCategoriesGroups?.length) {
        setActions(res.sort((a, b) => Number(b.total) - Number(a.total)));
      } else {
        const actionsByCategory = [];
        const filteredGroupsCategories = groupsCategories.filter((group) => actionsCategoriesGroups.includes(group.groupTitle));
        for (const item of res) {
          const category = filteredGroupsCategories.find((group) => group.categories.includes(item.actionCategory));
          if (category) {
            actionsByCategory.push({ actionCategory: category.groupTitle, total: item.total });
          }
        }

        setActions(actionsByCategory.sort((a, b) => Number(b.total) - Number(a.total)));
      }
    });
  }, [context, actionsCategories, groupsCategories, actionsCategoriesGroups, actionsStatuses]);
  return (
    <CustomResponsiveBar
      title="Actions par catégorie"
      data={actions.map((d) => ({ name: d.actionCategory, [d.actionCategory]: d.total }))}
      axisTitleY="Nombre d'actions"
      onItemClick={(id) => {
        sqlSelectActionByActionCategory(context, actionsCategories, actionsStatuses, id).then((res) => {
          onSliceClick(id, res);
        });
      }}
    />
  );
}

function PersonnesByCategory({
  context,
  actionsCategories,
  actionsCategoriesGroups,
  actionsStatuses,
  onSliceClick,
}: {
  context: StatsContext;
  actionsCategories: string[];
  actionsCategoriesGroups: string[];
  actionsStatuses: string[];
  onSliceClick: (value: string, data: PersonLoose[]) => void;
}) {
  const groupsCategories = useRecoilValue(actionsCategoriesSelector);
  const [personnes, setPersonnes] = useState<{ actionCategory: string; total: string }[]>([]);
  useEffect(() => {
    sqlSelectPersonnesByActionCategoryCount(context, actionsCategories, actionsStatuses).then((res) => {
      if (!actionsCategoriesGroups?.length) {
        setPersonnes(res.sort((a, b) => Number(b.total) - Number(a.total)));
      } else {
        const personnesByCategory = [];
        const filteredGroupsCategories = groupsCategories.filter((group) => actionsCategoriesGroups.includes(group.groupTitle));
        for (const item of res) {
          const category = filteredGroupsCategories.find((group) => group.categories.includes(item.actionCategory));
          if (category) {
            personnesByCategory.push({ actionCategory: category.groupTitle, total: item.total });
          }
        }
        setPersonnes(personnesByCategory.sort((a, b) => Number(b.total) - Number(a.total)));
      }
    });
  }, [context, actionsCategories, groupsCategories, actionsCategoriesGroups, actionsStatuses]);
  return (
    <CustomResponsiveBar
      title="Personnes par catégorie"
      data={personnes.map((d) => ({ name: d.actionCategory, [d.actionCategory]: d.total }))}
      axisTitleY="Nombre de personnes"
      onItemClick={(id) => {
        sqlSelectPersonnesByActionCategory(context, actionsCategories, actionsStatuses, id).then((res) => {
          onSliceClick(
            id,
            res.map((r) => ({ ...r, assignedTeams: (r.assignedTeams || "").split(",") }))
          );
        });
      }}
    />
  );
}

function ActionsByCategoryGroup({
  context,
  actionsCategories,
  actionsCategoriesGroups,
  actionsStatuses,
  onSliceClick,
}: {
  context: StatsContext;
  actionsCategories: string[];
  actionsCategoriesGroups: string[];
  actionsStatuses: string[];
  onSliceClick: (value: string, data: PersonLoose[]) => void;
}) {
  const groupsCategories = useRecoilValue(actionsCategoriesSelector);
  const [actions, setActions] = useState<{ actionCategoryGroup: string; total: string }[]>([]);

  const filteredGroupsCategories = actionsCategoriesGroups?.length
    ? groupsCategories.filter((group) => actionsCategoriesGroups.includes(group.groupTitle))
    : groupsCategories;

  useEffect(() => {
    sqlSelectActionByActionCategoryCount(context, actionsCategories, actionsStatuses).then((res) => {
      const actionsByCategoryGroup = [];
      for (const group of filteredGroupsCategories) {
        const total = res.filter((d) => group.categories.includes(d.actionCategory)).reduce((acc, d) => acc + Number(d.total), 0);
        actionsByCategoryGroup.push({ actionCategoryGroup: group.groupTitle, total: total.toString() });
      }
      // Add "Non renseigné" category group
      const nonRenseigneTotal = res.filter((d) => d.actionCategory === "Non renseigné").reduce((acc, d) => acc + Number(d.total), 0);
      if (nonRenseigneTotal > 0) {
        actionsByCategoryGroup.push({ actionCategoryGroup: "Non renseigné", total: nonRenseigneTotal.toString() });
      }
      setActions(actionsByCategoryGroup.filter((d) => Number(d.total) > 0).sort((a, b) => Number(b.total) - Number(a.total)));
    });
  }, [context, groupsCategories, actionsCategoriesGroups, actionsCategories, actionsStatuses, filteredGroupsCategories]);
  return (
    <CustomResponsiveBar
      title="Actions par groupe de catégories"
      data={actions.map((d) => ({ name: d.actionCategoryGroup, [d.actionCategoryGroup]: d.total }))}
      axisTitleY="Nombre d'actions"
      onItemClick={(id) => {
        const categories = filteredGroupsCategories.find((group) => group.groupTitle === id)?.categories;
        sqlSelectActionByActionCategory(context, actionsCategories, actionsStatuses, categories).then((res) => {
          onSliceClick(id, res);
        });
      }}
    />
  );
}
