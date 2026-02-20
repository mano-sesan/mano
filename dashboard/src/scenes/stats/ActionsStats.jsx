import { useMemo, useState } from "react";
import { CustomResponsiveBar } from "./Charts";
import { mappedIdsToLabels } from "../../atoms/actions";
import SelectCustom from "../../components/SelectCustom";
import { getMultichoiceBarData } from "./utils";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../../components/tailwind/Modal";
import ActionsSortableList from "../../components/ActionsSortableList";
import Filters from "../../components/Filters";
import { useAtomValue } from "jotai";
import { userState } from "../../atoms/auth";
import { itemsGroupedByPersonSelector } from "../../atoms/selectors";
import { SelectedPersonsModal } from "./PersonsStats";

const ActionsStats = ({
  // data
  actionsWithDetailedGroupAndCategories,
  // filter by status
  setActionsStatuses,
  actionsStatuses,
  // filter by group
  setActionsCategoriesGroups,
  actionsCategoriesGroups,
  groupsCategories,
  // filter by category
  setActionsCategories,
  actionsCategories,
  filterableActionsCategories,
  // filter by persons
  filterBase,
  filterPersons,
  setFilterPersons,
  personsUpdatedWithActions,
  isStatsV2,
}) => {
  const [actionsModalOpened, setActionsModalOpened] = useState(false);
  const [personsModalOpened, setPersonsModalOpened] = useState(false);
  const [groupSlice, setGroupSlice] = useState(null);
  const [categorySlice, setCategorySlice] = useState(null);
  const user = useAtomValue(userState);
  const persons = useAtomValue(itemsGroupedByPersonSelector);

  const filteredActionsBySlice = useMemo(() => {
    if (groupSlice) {
      const withGroupSlice = {};
      for (const action of actionsWithDetailedGroupAndCategories) {
        if (groupSlice === "Non renseigné" && !action.categoryGroup) {
          withGroupSlice[action._id] = action;
        }
        if (action.categoryGroup === groupSlice) {
          withGroupSlice[action._id] = action;
        }
      }
      return Object.values(withGroupSlice);
    }
    if (categorySlice) {
      const withCatSlice = {};
      for (const action of actionsWithDetailedGroupAndCategories) {
        if (categorySlice === "Non renseigné" && !action.categories?.length) {
          withCatSlice[action._id] = action;
        }
        if (action.categories.includes(categorySlice)) {
          withCatSlice[action._id] = action;
        }
      }
      return Object.values(withCatSlice);
    }
    return [];
  }, [actionsWithDetailedGroupAndCategories, groupSlice, categorySlice]);

  const filterTitle = useMemo(() => {
    if (!filterPersons.length) return `Filtrer par personnes suivies :`;
    if (personsUpdatedWithActions === 1)
      return `Filtrer par personnes suivies (${personsUpdatedWithActions} personne associée aux équipes en charges séléctionnées concernée par le filtre actuel) :`;
    return `Filtrer par personnes suivies (${personsUpdatedWithActions} personnes associées aux équipes en charges séléctionnées concernées par le filtre actuel) :`;
  }, [filterPersons, personsUpdatedWithActions]);

  // Nombre de personnes par catégorie d'action
  const personsByActionCategory = useMemo(() => {
    const personsByActionCategory = {};
    for (const action of actionsWithDetailedGroupAndCategories) {
      const cat = action.category || "Non renseigné";
      if (!personsByActionCategory[cat]) personsByActionCategory[cat] = new Set();
      // Je ne sais pas pourquoi certaines actions ont plusieurs "person".
      if (Array.isArray(action.person)) {
        action.person.forEach((p) => personsByActionCategory[cat].add(p));
      } else {
        personsByActionCategory[cat].add(action.person);
      }
    }
    return personsByActionCategory;
  }, [actionsWithDetailedGroupAndCategories]);

  // Nombre de personnes par groupe de catégories d'action
  const personsByActionCategoryGroup = useMemo(() => {
    const personsByActionCategoryGroup = {};
    for (const action of actionsWithDetailedGroupAndCategories) {
      const group = action.categoryGroup || "Non renseigné";
      if (!personsByActionCategoryGroup[group]) personsByActionCategoryGroup[group] = new Set();
      // Je ne sais pas pourquoi certaines actions ont plusieurs "person".
      if (Array.isArray(action.person)) {
        action.person.forEach((p) => personsByActionCategoryGroup[group].add(p));
      } else {
        personsByActionCategoryGroup[group].add(action.person);
      }
    }
    return personsByActionCategoryGroup;
  }, [actionsWithDetailedGroupAndCategories]);

  const personsByActionCategoryForChart = useMemo(() => {
    return Object.entries(personsByActionCategory)
      .map(([category, persons]) => {
        if (!persons.size) return null;
        return {
          name: category,
          [category]: String(persons.size),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (Number(b[b.name]) > Number(a[a.name]) ? 1 : -1));
  }, [personsByActionCategory]);

  const personsByActionCategoryGroupForChart = useMemo(() => {
    return Object.entries(personsByActionCategoryGroup)
      .map(([group, persons]) => {
        if (!persons.size) return null;
        return {
          name: group,
          [group]: String(persons.size),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (Number(b[b.name]) > Number(a[a.name]) ? 1 : -1));
  }, [personsByActionCategoryGroup]);

  const filteredPersonsByCategorySlice = useMemo(() => {
    if (categorySlice) {
      let withCatSlice = [];
      for (const [category, personsIds] of Object.entries(personsByActionCategory)) {
        if (categorySlice === "Non renseigné" && !category) {
          withCatSlice = [...personsIds].map((p) => persons[p]);
        }
        if (category === categorySlice) {
          withCatSlice = [...personsIds].map((p) => persons[p]);
        }
      }
      return withCatSlice;
    }
    return [];
  }, [categorySlice, personsByActionCategory, persons]);

  const filteredPersonsByGroupSlice = useMemo(() => {
    if (groupSlice) {
      let withGroupSlice = [];
      for (const [group, personsIds] of Object.entries(personsByActionCategoryGroup)) {
        if (groupSlice === "Non renseigné" && !group) {
          withGroupSlice = [...personsIds].map((p) => persons[p]);
        }
        if (group === groupSlice) {
          withGroupSlice = [...personsIds].map((p) => persons[p]);
        }
      }
      return withGroupSlice;
    }
    return [];
  }, [groupSlice, personsByActionCategoryGroup, persons]);

  return (
    <>
      {!isStatsV2 && <h3 className="tw-my-5 tw-text-xl">Statistiques des actions</h3>}
      {!isStatsV2 && (
        <div className="tw-flex tw-basis-full tw-items-center">
          <Filters title={filterTitle} base={filterBase} filters={filterPersons} onChange={setFilterPersons} />
        </div>
      )}
      {!isStatsV2 && (
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
      )}
      <div className="tw-flex tw-flex-col tw-gap-4">
        <CustomResponsiveBar
          title="Répartition des catégories d'actions par groupe"
          help={`Si une action a plusieurs catégories appartenant à plusieurs groupes, elle est comptabilisée dans chaque groupe.\n\nSi une action a plusieurs catégories appartenant au même groupe, elle est comptabilisée autant de fois dans ce groupe.\n\nAinsi, le total affiché peut être supérieur au nombre total d'actions.`}
          onItemClick={
            user.role === "stats-only"
              ? undefined
              : (newGroupSlice) => {
                  setActionsModalOpened(true);
                  setGroupSlice(newGroupSlice);
                  setCategorySlice(null);
                }
          }
          axisTitleY="Actions"
          axisTitleX="Groupe"
          data={getMultichoiceBarData(actionsWithDetailedGroupAndCategories, "categoryGroup", {
            options: groupsCategories.map((group) => group.groupTitle),
            debug: true,
          })}
        />
        <CustomResponsiveBar
          title="Répartition des actions par catégorie"
          help={`Si une action a plusieurs catégories, elle est comptabilisée dans chaque catégorie.\n\nAinsi, le total affiché peut être supérieur au nombre total d'actions.`}
          onItemClick={
            user.role === "stats-only"
              ? undefined
              : (newCategorySlice) => {
                  setActionsModalOpened(true);
                  setCategorySlice(newCategorySlice);
                  setGroupSlice(null);
                }
          }
          axisTitleY="Actions"
          axisTitleX="Catégorie"
          data={getMultichoiceBarData(actionsWithDetailedGroupAndCategories, "category")}
        />
        <CustomResponsiveBar
          title="Nombre de personnes concernées par groupe de catégories d'actions"
          help={`Si une personne est concernée par plusieurs groupes de catégories, elle est comptabilisée dans chaque groupe.\n\nSi une personne a plusieurs actions d'un même groupe, elle ne sera comptabilisée qu'une fois par groupe.\n\nAinsi, le total affiché peut être supérieur au nombre total de personnes.`}
          onItemClick={
            user.role === "stats-only"
              ? undefined
              : (newGroupSlice) => {
                  setPersonsModalOpened(true);
                  setGroupSlice(newGroupSlice);
                  setCategorySlice(null);
                }
          }
          axisTitleY="Personnes"
          axisTitleX="Groupe"
          data={personsByActionCategoryGroupForChart}
        />
        <CustomResponsiveBar
          title="Nombre de personnes concernées par catégorie d'action"
          help={`Si une personne est concernée par plusieurs catégories, elle est comptabilisée dans chaque catégorie.\n\nSi une personne a plusieurs actions d'une même catégorie, elle ne sera comptabilisée qu'une fois par action.\n\nAinsi, le total affiché peut être supérieur au nombre total de personnes.`}
          onItemClick={
            user.role === "stats-only"
              ? undefined
              : (newCategorySlice) => {
                  setPersonsModalOpened(true);
                  setCategorySlice(newCategorySlice);
                  setGroupSlice(null);
                }
          }
          axisTitleY="Personnes"
          axisTitleX="Catégorie"
          data={personsByActionCategoryForChart}
        />
      </div>
      <SelectedActionsModal
        open={actionsModalOpened}
        onClose={() => {
          setActionsModalOpened(false);
        }}
        onAfterLeave={() => {
          setGroupSlice(null);
          setCategorySlice(null);
        }}
        data={filteredActionsBySlice}
        title={`Actions ${groupSlice !== null ? `du groupe ${groupSlice}` : ""}${categorySlice !== null ? `de la catégorie ${categorySlice}` : ""} (${
          filteredActionsBySlice.length
        })`}
      />
      <SelectedPersonsModal
        open={personsModalOpened}
        onClose={() => {
          setPersonsModalOpened(false);
        }}
        persons={groupSlice ? filteredPersonsByGroupSlice : filteredPersonsByCategorySlice}
        title={
          groupSlice
            ? `Personnes concernées par le groupe ${groupSlice} (${filteredPersonsByGroupSlice.length})`
            : `Personnes concernées par la catégorie ${categorySlice} (${filteredPersonsByCategorySlice.length})`
        }
      />
    </>
  );
};

const SelectedActionsModal = ({ open, onClose, data, title, onAfterLeave }) => {
  return (
    <ModalContainer open={open} size="full" onClose={onClose} onAfterLeave={onAfterLeave}>
      <ModalHeader title={title} />
      <ModalBody>
        <div className="tw-p-4">
          <ActionsSortableList data={data} limit={20} />
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
  );
};

export default ActionsStats;
