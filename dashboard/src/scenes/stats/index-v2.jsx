import { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { useLocalStorage } from "../../services/useLocalStorage";
import {
  fieldsPersonsCustomizableOptionsSelector,
  filterPersonsBaseSelector,
  personFieldsSelector,
  flattenedCustomFieldsPersonsSelector,
  personTypesByFieldsNamesSelector,
} from "../../atoms/persons";
import { customFieldsObsSelector, territoryObservationsState } from "../../atoms/territoryObservations";
import { currentTeamState, organisationState, teamsState, userState } from "../../atoms/auth";
import { actionsCategoriesSelector, DONE, flattenedActionsCategoriesSelector, mappedIdsToLabels } from "../../atoms/actions";
import { reportsState, servicesSelector } from "../../atoms/reports";
import { territoriesState } from "../../atoms/territory";
import { customFieldsMedicalFileSelector } from "../../atoms/medicalFiles";
import { arrayOfitemsGroupedByPersonSelector, populatedPassagesSelector } from "../../atoms/selectors";
import useTitle from "../../services/useTitle";
import DateRangePickerWithPresets, { formatPeriod, statsPresets } from "../../components/DateRangePickerWithPresets";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";
import { useExportTransforms, exportXlsx, fetchUsers } from "../data-import-export/ExportFormattedData";
import GeneralStats from "./GeneralStats";
import ServicesStats from "./ServicesStats";
import ActionsStats from "./ActionsStats";
import PersonStats from "./PersonsStats";
import PassagesStats from "./PassagesStats";
import RencontresStats from "./RencontresStats";
import ObservationsStats from "./ObservationsStats";
import ReportsStats from "./ReportsStats";
import ConsultationsStats from "./ConsultationsStats";
import MedicalFilesStats from "./MedicalFilesStats";
import ButtonCustom from "../../components/ButtonCustom";
import dayjs from "dayjs";
import { filterItem } from "../../components/Filters";
import { flattenedCustomFieldsConsultationsSelector } from "../../atoms/consultations";
import { getPersonSnapshotAtDate } from "../../utils/person-snapshot";
import { dayjsInstance } from "../../services/date";
import { useRestoreScrollPosition } from "../../utils/useRestoreScrollPosition";
import SelectCustom from "../../components/SelectCustom";
import HelpButtonAndModal from "../../components/HelpButtonAndModal";
import FilterChipsV2 from "./FilterChipsV2";
import FilterModalV2 from "./FilterModalV2";
import FilterModalSimple from "./FilterModalSimple";
import { itemsForStatsV2Selector } from "./items-for-stats-v2";
import { StatsV2Provider } from "./StatsContext";
import { ArrowsRightLeftIcon } from "@heroicons/react/16/solid";

const tabsV2 = [
  "Général",
  "Personnes",
  "Dossiers médicaux",
  "Actions",
  "Consultations",
  "Passages",
  "Rencontres",
  "Observations",
  "Services",
  "Comptes-rendus",
];

const personTypeOptions = [
  { label: "Toutes les personnes", value: "all" },
  { label: "Personnes mises à jour", value: "modified" },
  { label: "Personnes suivies", value: "followed" },
  { label: "Nouvelles personnes", value: "created" },
];

const personsForStatsSelector = (period, allRawPersons, personTypesByFieldsNames) => {
  const snapshotDate = dayjsInstance(period.endDate).format("YYYY-MM-DD");

  const allPersons = allRawPersons.map((person) => {
    const snapshotAtDate = getPersonSnapshotAtDate({
      person,
      snapshotDate: snapshotDate,
      typesByFields: personTypesByFieldsNames,
    });
    return {
      ...snapshotAtDate,
      followSinceMonths: dayjsInstance(snapshotDate).diff(person.followedSince, "months"),
    };
  });

  return allPersons;
};

const StatsV2 = ({ onSwitchVersion }) => {
  const organisation = useAtomValue(organisationState);
  const currentTeam = useAtomValue(currentTeamState);
  const teams = useAtomValue(teamsState);
  const user = useAtomValue(userState);

  const allreports = useAtomValue(reportsState);
  const allObservations = useAtomValue(territoryObservationsState);
  const allPassagesPopulated = useAtomValue(populatedPassagesSelector);
  const customFieldsObs = useAtomValue(customFieldsObsSelector);
  const fieldsPersonsCustomizableOptions = useAtomValue(fieldsPersonsCustomizableOptionsSelector);
  const flattenedCustomFieldsPersons = useAtomValue(flattenedCustomFieldsPersonsSelector);
  const customFieldsMedicalFile = useAtomValue(customFieldsMedicalFileSelector);
  const consultationFields = useAtomValue(flattenedCustomFieldsConsultationsSelector);
  const personFields = useAtomValue(personFieldsSelector);
  const territories = useAtomValue(territoriesState);
  const allCategories = useAtomValue(flattenedActionsCategoriesSelector);
  const groupsCategories = useAtomValue(actionsCategoriesSelector);

  const groupedServices = useAtomValue(servicesSelector);
  const allServices = useMemo(() => groupedServices.reduce((services, group) => [...services, ...group.services], []), [groupedServices]);

  const [activeTab, setActiveTab] = useLocalStorage("stats-v2-tabCaption", "Général");
  const [personType, setPersonType] = useLocalStorage("stats-v2-personType", "all");
  const [filterPersons, setFilterPersons] = useLocalStorage("stats-v2-filterPersons", []);
  const [filterObs, setFilterObs] = useLocalStorage("stats-v2-filterObs", []);
  const [viewAllOrganisationData, setViewAllOrganisationData] = useLocalStorage("stats-viewAllOrganisationData", teams.length === 1);
  const [period, setPeriod] = useLocalStorage("period", { startDate: null, endDate: null });
  const [preset, setPreset, removePreset] = useLocalStorage("stats-date-preset", null);
  const [manuallySelectedTeams, setSelectedTeams] = useLocalStorage("stats-teams", [currentTeam]);
  const [actionsStatuses, setActionsStatuses] = useLocalStorage("stats-actionsStatuses", DONE);
  const [actionsCategoriesGroups, setActionsCategoriesGroups] = useLocalStorage("stats-catGroups", []);
  const [actionsCategories, setActionsCategories] = useLocalStorage("stats-categories", []);
  const [consultationsStatuses, setConsultationsStatuses] = useLocalStorage("stats-consultationsStatuses", []);
  const [consultationsTypes, setConsultationsTypes] = useLocalStorage("stats-consultationsTypes", []);
  const [rencontresTerritories, setRencontresTerritories] = useLocalStorage("stats-rencontresTerritories", []);
  const [servicesGroupFilter, setServicesGroupFilter] = useLocalStorage("stats-servicesGroupFilter", []);
  const [servicesFilter, setServicesFilter] = useLocalStorage("stats-servicesFilter", []);

  const [evolutivesStatsActivated, setEvolutivesStatsActivated] = useLocalStorage("stats-evolutivesStatsActivated", false);
  const [evolutiveStatsIndicators, setEvolutiveStatsIndicators] = useLocalStorage("stats-evolutivesStatsIndicatorsArray", []);

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [editingFilterIndex, setEditingFilterIndex] = useState(null);

  // Simple filter modal state (Actions, Services, Consultations, Rencontres)
  const [simpleFilterModalOpen, setSimpleFilterModalOpen] = useState(false);
  const [simpleFilterTab, setSimpleFilterTab] = useState(null);
  const [simpleFilterEditingIndex, setSimpleFilterEditingIndex] = useState(null);

  // Observations filter modal state
  const [obsFilterModalOpen, setObsFilterModalOpen] = useState(false);
  const [obsEditingFilterIndex, setObsEditingFilterIndex] = useState(null);

  useTitle(`${activeTab} - Statistiques`);

  const selectedTeams = useMemo(() => {
    if (viewAllOrganisationData) return teams;
    return manuallySelectedTeams;
  }, [manuallySelectedTeams, viewAllOrganisationData, teams]);

  const selectedTeamsObjectWithOwnPeriod = useMemo(() => {
    const teamsIdsObject = {};
    for (const team of selectedTeams) {
      const offsetHours = team.nightSession ? 12 : 0;
      const isoStartDate = period.startDate ? dayjs(period.startDate).startOf("day").add(offsetHours, "hour").toISOString() : null;
      const isoEndDate = period.endDate ? dayjs(period.endDate).startOf("day").add(1, "day").add(offsetHours, "hour").toISOString() : null;
      teamsIdsObject[team._id] = {
        isoStartDate,
        isoEndDate,
      };
    }
    return teamsIdsObject;
  }, [selectedTeams, period]);

  const defaultIsoDates = useMemo(
    () => ({
      isoStartDate: period.startDate ? dayjs(period.startDate).startOf("day").toISOString() : null,
      isoEndDate: period.endDate ? dayjs(period.endDate).startOf("day").add(1, "day").toISOString() : null,
    }),
    [period]
  );

  const allRawPersons = useAtomValue(arrayOfitemsGroupedByPersonSelector);
  const personTypesByFieldsNames = useAtomValue(personTypesByFieldsNamesSelector);

  const allPersons = useMemo(() => {
    return personsForStatsSelector(period, allRawPersons, personTypesByFieldsNames);
  }, [period, allRawPersons, personTypesByFieldsNames]);

  const {
    personsForStats,
    personsUpdatedWithActions,
    countFollowedWithActions,
    personTypeCounts,
    actionsFilteredByPersons,
    personsWithConsultations,
    consultationsFilteredByPersons,
    personsWithPassages,
    personsInPassagesBeforePeriod,
    passagesFilteredByPersons,
    personsInRencontresBeforePeriod,
    rencontresFilteredByPersons,
  } = useMemo(() => {
    return itemsForStatsV2Selector({
      period,
      allPersons,
      filterPersons,
      selectedTeamsObjectWithOwnPeriod,
      viewAllOrganisationData,
      teams,
      territories,
      personType,
    });
  }, [period, filterPersons, selectedTeamsObjectWithOwnPeriod, viewAllOrganisationData, allPersons, teams, territories, personType]);

  const filterableActionsCategories = useMemo(() => {
    if (!actionsCategoriesGroups.length) return ["-- Aucune --", ...allCategories];
    return groupsCategories
      .filter((group) => actionsCategoriesGroups.includes(group.groupTitle))
      .reduce((filteredCats, group) => [...filteredCats, ...group.categories], []);
  }, [actionsCategoriesGroups, allCategories, groupsCategories]);

  const consultationsFilteredByStatus = useMemo(() => {
    return consultationsFilteredByPersons
      .filter((consultation) => !consultationsStatuses.length || consultationsStatuses.includes(consultation.status))
      .filter((consultation) => !consultationsTypes.length || consultationsTypes.includes(consultation.type));
  }, [consultationsFilteredByPersons, consultationsStatuses, consultationsTypes]);

  const actionsWithDetailedGroupAndCategories = useMemo(() => {
    const actionsDetailed = [];
    const categoriesGroupObject = {};
    for (const groupCategory of groupsCategories) {
      for (const category of groupCategory.categories) {
        categoriesGroupObject[category] = groupCategory.groupTitle;
      }
    }
    for (const action of actionsFilteredByPersons) {
      if (!!actionsStatuses.length && !actionsStatuses.includes(action.status)) {
        continue;
      }
      if (action.categories?.length) {
        for (const category of action.categories) {
          actionsDetailed.push({
            ...action,
            category,
            categoryGroup: categoriesGroupObject[category] ?? "Catégories supprimées",
          });
        }
      } else {
        actionsDetailed.push(action);
      }
    }
    const _actionsWithDetailedGroupAndCategories = actionsDetailed
      .filter((a) => !actionsCategoriesGroups.length || actionsCategoriesGroups.includes(a.categoryGroup))
      .filter((a) => {
        if (!actionsCategories.length) return true;
        if (actionsCategories.length === 1 && actionsCategories[0] === "-- Aucune --") return !a.categories?.length;
        return actionsCategories.includes(a.category);
      });
    return _actionsWithDetailedGroupAndCategories;
  }, [actionsFilteredByPersons, groupsCategories, actionsCategoriesGroups, actionsCategories, actionsStatuses]);

  const passages = useMemo(() => {
    const activeFilters = filterPersons.filter((f) => f.value);
    if (activeFilters.length) {
      return passagesFilteredByPersons;
    }
    const passagesFiltered = [];
    for (const passage of allPassagesPopulated) {
      if (!viewAllOrganisationData) {
        if (!selectedTeamsObjectWithOwnPeriod[passage.team]) continue;
      }
      const { isoStartDate, isoEndDate } = selectedTeamsObjectWithOwnPeriod[passage.team] ?? defaultIsoDates;
      const date = passage.date ?? passage.createdAt;
      if (date < isoStartDate) continue;
      if (date >= isoEndDate) continue;
      passagesFiltered.push(passage);
    }
    return passagesFiltered;
  }, [allPassagesPopulated, defaultIsoDates, passagesFilteredByPersons, filterPersons, selectedTeamsObjectWithOwnPeriod, viewAllOrganisationData]);

  const observations = useMemo(() => {
    const observationsFiltered = [];
    const territoriesById = {};
    for (const territory of territories) {
      territoriesById[territory._id] = territory;
    }
    const activeFilters = filterObs.filter((f) => f.value);
    const territoryFilter = activeFilters.find((f) => f.field === "territory");
    const territoryTypesFilter = activeFilters.find((f) => f.field === "territoryTypes");
    const otherFilters = activeFilters.filter((f) => f.field !== "territory" && f.field !== "territoryTypes");
    for (const observation of allObservations) {
      if (!viewAllOrganisationData) {
        if (!selectedTeamsObjectWithOwnPeriod[observation.team]) continue;
      }
      if (territoryFilter) {
        if (!territoryFilter.value.includes(territoriesById[observation.territory]?.name)) continue;
      }
      if (territoryTypesFilter) {
        const observationTerritory = territoriesById[observation.territory];
        if (!observationTerritory?.types) continue;
        const hasMatchingType = observationTerritory.types.some((type) => territoryTypesFilter.value.includes(type));
        if (!hasMatchingType) continue;
      }
      if (!filterItem(otherFilters)(observation)) continue;
      const { isoStartDate, isoEndDate } = selectedTeamsObjectWithOwnPeriod[observation.team] ?? defaultIsoDates;
      const date = observation.observedAt ?? observation.createdAt;
      if (date < isoStartDate) continue;
      if (date >= isoEndDate) continue;
      observationsFiltered.push(observation);
    }
    return observationsFiltered;
  }, [allObservations, filterObs, territories, defaultIsoDates, selectedTeamsObjectWithOwnPeriod, viewAllOrganisationData]);

  const reports = useMemo(() => {
    const reportsFiltered = [];
    for (const report of allreports) {
      if (!viewAllOrganisationData) {
        if (!selectedTeamsObjectWithOwnPeriod[report.team]) continue;
      }
      const { isoStartDate, isoEndDate } = selectedTeamsObjectWithOwnPeriod[report.team] ?? defaultIsoDates;
      const date = report.date;
      if (date < isoStartDate) continue;
      if (date >= isoEndDate) continue;
      reportsFiltered.push(report);
    }
    return reportsFiltered;
  }, [allreports, defaultIsoDates, selectedTeamsObjectWithOwnPeriod, viewAllOrganisationData]);

  const filterPersonsBase = useAtomValue(filterPersonsBaseSelector);
  const filterPersonsWithAllFields = useMemo(() => {
    const filterBase = [
      ...filterPersonsBase.map((f) => {
        if (f.field === "outOfActiveList") {
          return {
            ...f,
            // V2: only "Oui" and "Non", no more "Oui et non"
            options: ["Oui", "Non"],
            type: "multi-choice",
          };
        }
        return f;
      }),
      ...fieldsPersonsCustomizableOptions.map((a) => ({ field: a.name, ...a })),
      ...flattenedCustomFieldsPersons.filter((a) => a.enabled || a.enabledTeams?.includes(currentTeam._id)).map((a) => ({ field: a.name, ...a })),
    ];
    if (user.healthcareProfessional) {
      filterBase.push(
        ...customFieldsMedicalFile
          .filter((a) => a.enabled || a.enabledTeams?.includes(currentTeam._id))
          .map((a) => ({ field: a.name, ...a, category: "medicalFile" }))
      );
      filterBase.push(
        ...consultationFields
          .filter((a) => a.enabled || a.enabledTeams?.includes(currentTeam._id))
          .map((a) => ({ field: a.name, ...a, category: "flattenedConsultations" }))
      );
    }
    filterBase.push({
      field: "outOfTeamsDuringPeriod",
      name: "outOfTeamsDuringPeriod",
      label: "Sortie d'équipe",
      type: "multi-choice",
      options: teams.map((t) => t.name),
    });
    filterBase.push({
      field: "territories",
      name: "territories",
      label: "Rencontré·e dans un territoire",
      type: "multi-choice",
      options: territories.map((t) => t.name),
    });
    return filterBase;
  }, [
    filterPersonsBase,
    fieldsPersonsCustomizableOptions,
    flattenedCustomFieldsPersons,
    customFieldsMedicalFile,
    consultationFields,
    currentTeam,
    user,
    teams,
    territories,
  ]);

  // === Tab-specific filter bases ===
  const actionsFilterBase = useMemo(
    () => [
      { field: "status", label: "Statut", options: mappedIdsToLabels.map((s) => s.name) },
      { field: "categoryGroup", label: "Groupe de catégories", options: groupsCategories.map((g) => g.groupTitle) },
      { field: "category", label: "Catégorie", options: filterableActionsCategories },
    ],
    [groupsCategories, filterableActionsCategories]
  );

  const servicesFilterBase = useMemo(
    () => [
      { field: "serviceGroup", label: "Groupe de services", options: groupedServices.map((g) => g.groupTitle) },
      { field: "service", label: "Service", options: allServices },
    ],
    [groupedServices, allServices]
  );

  const consultationsFilterBase = useMemo(
    () => [
      { field: "status", label: "Statut", options: mappedIdsToLabels.map((s) => s.name) },
      { field: "type", label: "Type", options: organisation.consultations.map((c) => c.name) },
    ],
    [organisation.consultations]
  );

  const rencontresFilterBase = useMemo(() => {
    if (!organisation.territoriesEnabled) return [];
    return [{ field: "territory", label: "Territoire", options: territories.map((t) => t.name) }];
  }, [organisation.territoriesEnabled, territories]);

  const obsFilterBase = useMemo(() => {
    const allTerritoryTypes = new Set();
    territories.forEach((t) => {
      if (t.types && Array.isArray(t.types)) t.types.forEach((type) => allTerritoryTypes.add(type));
    });
    return [
      { field: "territory", name: "territory", label: "Territoire", type: "multi-choice", options: territories.map((t) => t.name) },
      {
        field: "territoryTypes",
        name: "territoryTypes",
        label: "Type de territoire",
        type: "multi-choice",
        options: Array.from(allTerritoryTypes).sort(),
      },
      ...customFieldsObs
        .filter((a) => a.enabled || a.enabledTeams?.includes(currentTeam._id))
        .map((f) => ({ field: f.name, name: f.name, label: f.label, type: f.type, options: f.options })),
    ];
  }, [territories, customFieldsObs, currentTeam._id]);

  // === Tab-specific chip filters (derived from state) ===
  const actionsChipFilters = useMemo(() => {
    const filters = [];
    const statusesArray = Array.isArray(actionsStatuses) ? actionsStatuses : actionsStatuses ? [actionsStatuses] : [];
    if (statusesArray.length) {
      filters.push({
        field: "status",
        value: statusesArray.map((id) => mappedIdsToLabels.find((s) => s._id === id)?.name).filter(Boolean),
      });
    }
    if (actionsCategoriesGroups.length) {
      filters.push({ field: "categoryGroup", value: actionsCategoriesGroups });
    }
    if (actionsCategories.length) {
      filters.push({ field: "category", value: actionsCategories });
    }
    return filters;
  }, [actionsStatuses, actionsCategoriesGroups, actionsCategories]);

  const servicesChipFilters = useMemo(() => {
    const filters = [];
    if (servicesGroupFilter.length) {
      filters.push({ field: "serviceGroup", value: servicesGroupFilter });
    }
    if (servicesFilter.length) {
      filters.push({ field: "service", value: servicesFilter });
    }
    return filters;
  }, [servicesGroupFilter, servicesFilter]);

  const consultationsChipFilters = useMemo(() => {
    const filters = [];
    const statusesArray = Array.isArray(consultationsStatuses) ? consultationsStatuses : [];
    if (statusesArray.length) {
      filters.push({
        field: "status",
        value: statusesArray.map((id) => mappedIdsToLabels.find((s) => s._id === id)?.name).filter(Boolean),
      });
    }
    if (consultationsTypes.length) {
      filters.push({ field: "type", value: consultationsTypes });
    }
    return filters;
  }, [consultationsStatuses, consultationsTypes]);

  const rencontresChipFilters = useMemo(() => {
    const filters = [];
    if (rencontresTerritories.length) {
      filters.push({ field: "territory", value: rencontresTerritories.map((t) => t.label || t.value) });
    }
    return filters;
  }, [rencontresTerritories]);

  // === Tab chip filter setters (for remove via setFilters) ===
  const setActionsChipFilters = useCallback(
    (newFilters) => {
      const statusFilter = newFilters.find((f) => f.field === "status");
      setActionsStatuses(statusFilter ? statusFilter.value.map((name) => mappedIdsToLabels.find((s) => s.name === name)?._id).filter(Boolean) : []);
      const groupFilter = newFilters.find((f) => f.field === "categoryGroup");
      setActionsCategoriesGroups(groupFilter ? groupFilter.value : []);
      const catFilter = newFilters.find((f) => f.field === "category");
      setActionsCategories(catFilter ? catFilter.value : []);
    },
    [setActionsStatuses, setActionsCategoriesGroups, setActionsCategories]
  );

  const setServicesChipFilters = useCallback(
    (newFilters) => {
      const groupFilter = newFilters.find((f) => f.field === "serviceGroup");
      setServicesGroupFilter(groupFilter ? groupFilter.value : []);
      const serviceFilter = newFilters.find((f) => f.field === "service");
      setServicesFilter(serviceFilter ? serviceFilter.value : []);
    },
    [setServicesGroupFilter, setServicesFilter]
  );

  const setConsultationsChipFilters = useCallback(
    (newFilters) => {
      const statusFilter = newFilters.find((f) => f.field === "status");
      setConsultationsStatuses(
        statusFilter ? statusFilter.value.map((name) => mappedIdsToLabels.find((s) => s.name === name)?._id).filter(Boolean) : []
      );
      const typeFilter = newFilters.find((f) => f.field === "type");
      setConsultationsTypes(typeFilter ? typeFilter.value : []);
    },
    [setConsultationsStatuses, setConsultationsTypes]
  );

  const setRencontresChipFilters = useCallback(
    (newFilters) => {
      const territoryFilter = newFilters.find((f) => f.field === "territory");
      setRencontresTerritories(territoryFilter ? territoryFilter.value.map((name) => ({ value: name, label: name })) : []);
    },
    [setRencontresTerritories]
  );

  // === Simple filter modal helpers ===
  const simpleFilterModalBase = useMemo(() => {
    if (simpleFilterTab === "Actions") return actionsFilterBase;
    if (simpleFilterTab === "Services") return servicesFilterBase;
    if (simpleFilterTab === "Consultations") return consultationsFilterBase;
    if (simpleFilterTab === "Rencontres") return rencontresFilterBase;
    return [];
  }, [simpleFilterTab, actionsFilterBase, servicesFilterBase, consultationsFilterBase, rencontresFilterBase]);

  const simpleFilterEditingFilter = useMemo(() => {
    if (simpleFilterEditingIndex == null) return null;
    const filters =
      simpleFilterTab === "Actions"
        ? actionsChipFilters
        : simpleFilterTab === "Services"
          ? servicesChipFilters
          : simpleFilterTab === "Consultations"
            ? consultationsChipFilters
            : simpleFilterTab === "Rencontres"
              ? rencontresChipFilters
              : [];
    const active = filters.filter((f) => f.field && f.value);
    return active[simpleFilterEditingIndex] || null;
  }, [simpleFilterEditingIndex, simpleFilterTab, actionsChipFilters, servicesChipFilters, consultationsChipFilters, rencontresChipFilters]);

  const applySimpleFilter = useCallback(
    (filter) => {
      if (simpleFilterTab === "Actions") {
        if (filter.field === "status") {
          setActionsStatuses(filter.value.map((name) => mappedIdsToLabels.find((s) => s.name === name)?._id).filter(Boolean));
        } else if (filter.field === "categoryGroup") {
          setActionsCategoriesGroups(filter.value);
        } else if (filter.field === "category") {
          setActionsCategories(filter.value);
        }
      } else if (simpleFilterTab === "Services") {
        if (filter.field === "serviceGroup") {
          setServicesGroupFilter(filter.value);
        } else if (filter.field === "service") {
          setServicesFilter(filter.value);
        }
      } else if (simpleFilterTab === "Consultations") {
        if (filter.field === "status") {
          setConsultationsStatuses(filter.value.map((name) => mappedIdsToLabels.find((s) => s.name === name)?._id).filter(Boolean));
        } else if (filter.field === "type") {
          setConsultationsTypes(filter.value);
        }
      } else if (simpleFilterTab === "Rencontres") {
        if (filter.field === "territory") {
          setRencontresTerritories(filter.value.map((name) => ({ value: name, label: name })));
        }
      }
    },
    [
      simpleFilterTab,
      setActionsStatuses,
      setActionsCategoriesGroups,
      setActionsCategories,
      setServicesGroupFilter,
      setServicesFilter,
      setConsultationsStatuses,
      setConsultationsTypes,
      setRencontresTerritories,
    ]
  );

  const availableTabs = tabsV2.filter((tabCaption) => {
    if (["Observations"].includes(tabCaption)) return !!organisation.territoriesEnabled;
    if (["Services"].includes(tabCaption)) return !!organisation.receptionEnabled;
    if (["Rencontres"].includes(tabCaption)) return !!organisation.rencontresEnabled;
    if (["Passages"].includes(tabCaption)) return !!organisation.passagesEnabled;
    return true;
  });

  useRestoreScrollPosition();

  const { transformPerson, transformPersonMedical, transformAction, transformConsultation, transformRencontre, transformPassage, transformObservation } =
    useExportTransforms();

  const exportDisabled =
    ["Général", "Services", "Comptes-rendus"].includes(activeTab) || (activeTab === "Dossiers médicaux" && !user.healthcareProfessional);

  const handleExport = async () => {
    const loadedUsers = await fetchUsers();
    switch (activeTab) {
      case "Personnes":
        exportXlsx("Personnes", personsForStats.map(transformPerson(loadedUsers)));
        break;
      case "Dossiers médicaux":
        exportXlsx("Dossiers médicaux", personsForStats.map(transformPersonMedical(loadedUsers)));
        break;
      case "Actions":
        exportXlsx(
          "Actions",
          actionsWithDetailedGroupAndCategories
            .reduce((uniqueActions, action) => {
              if (!uniqueActions.find((a) => a._id === action._id)) uniqueActions.push(action);
              return uniqueActions;
            }, [])
            .map(transformAction(loadedUsers))
        );
        break;
      case "Consultations":
        exportXlsx("Consultations", consultationsFilteredByStatus.map(transformConsultation(loadedUsers)));
        break;
      case "Passages":
        exportXlsx("Passages", passagesFilteredByPersons.map(transformPassage(loadedUsers)));
        break;
      case "Rencontres":
        exportXlsx("Rencontres", rencontresFilteredByPersons.map(transformRencontre(loadedUsers)));
        break;
      case "Observations":
        exportXlsx("Observations", observations.map(transformObservation(loadedUsers)));
        break;
    }
  };

  const filtersDisabled = ["Services", "Observations", "Comptes-rendus"].includes(activeTab);
  const personTypeDisabled = !["Personnes", "Dossiers médicaux"].includes(activeTab);
  const evolutifDisabled = activeTab !== "Personnes";

  return (
    <>
      <div>
        <button
          type="button"
          className="tw-absolute tw-right-4 !tw-p-0 tw-top-4 tw-text-xs tw-flex tw-gap-1 tw-text-zinc-400 hover:tw-text-zinc-600 tw-transition-colors tw-cursor-pointer"
          onClick={onSwitchVersion}
        >
          <ArrowsRightLeftIcon className="tw-w-4 tw-h-4" />
          Revenir à l'ancienne version
        </button>
        <div className="printonly tw-px-8 tw-py-4 tw-text-2xl tw-font-bold" aria-hidden>
          Statistiques{" "}
          {viewAllOrganisationData ? (
            <>globales</>
          ) : (
            <>
              {selectedTeams.length > 1 ? "des équipes" : "de l'équipe"} {selectedTeams.map((t) => t.name).join(", ")}
            </>
          )}{" "}
          - {formatPeriod({ period, preset })}
        </div>
        {/* Line 1: Title + switch button */}
        <div className="noprint tw-flex tw-items-center tw-mt-8 tw-mb-4">
          <h1 className="tw-grow tw-text-xl tw-font-normal">Statistiques</h1>
          <div className="tw-flex tw-items-center tw-gap-4">
            <ButtonCustom type="button" color="link" title="Imprimer" onClick={window.print} />
            {user.role === "admin" && (
              <ButtonCustom title="Télécharger un export" onClick={handleExport} disabled={exportDisabled} />
            )}
          </div>
        </div>
      </div>

      {/* Line 2: Tabs */}
      <div className="noprint tw-flex tw-flex-row tw-flex-wrap tw-border-b tw-border-zinc-200 tw-mb-6">
        {availableTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-border-b-2 tw-transition-colors tw-cursor-pointer",
              activeTab === tab
                ? "tw-border-main tw-text-main tw-bg-stone-50 tw-rounded-t-md"
                : "tw-border-transparent tw-text-zinc-500 hover:tw-text-zinc-700 hover:tw-border-zinc-300",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Line 3: Controls */}
      <div className="noprint tw-flex tw-flex-row tw-items-start tw-gap-2 tw-flex-nowrap">
        <div className="tw-min-w-48 tw-grow">
          <SelectTeamMultiple
            onChange={(teamsId) => {
              setSelectedTeams(teams.filter((t) => teamsId.includes(t._id)));
            }}
            value={selectedTeams.map((e) => e?._id)}
            colored
            isDisabled={viewAllOrganisationData}
          />
          {teams.length > 1 && (
            <label htmlFor="viewAllOrganisationData-v2" className="tw-flex tw-items-center tw-text-xs tw-mt-0.5 text-zinc-700">
              <input
                id="viewAllOrganisationData-v2"
                type="checkbox"
                className="tw-mr-1"
                checked={viewAllOrganisationData}
                value={viewAllOrganisationData}
                onChange={() => setViewAllOrganisationData(!viewAllOrganisationData)}
              />
              Statistiques de toute l'organisation
            </label>
          )}
        </div>

        <div className="tw-shrink-0">
          <DateRangePickerWithPresets
            presets={statsPresets}
            period={period}
            setPeriod={setPeriod}
            preset={preset}
            setPreset={setPreset}
            removePreset={removePreset}
            isStatsV2
            pickerOffsetClassName={personTypeDisabled && evolutifDisabled ? "-tw-right-1" : "-tw-right-56"}
          />
        </div>

        {!personTypeDisabled && (
          <div className="tw-flex tw-items-center tw-shrink-0">
            <SelectCustom
              options={personTypeOptions}
              value={personTypeOptions.find((o) => o.value === personType) || personTypeOptions[0]}
              onChange={(option) => setPersonType(option?.value || "all")}
              name="person-type-v2"
              inputId="person-type-v2"
              className="tw-text-sm tw-w-56"
              formatOptionLabel={(option) => <span className="tw-text-sm">{option.label}</span>}
              isDisabled={personTypeDisabled}
            />
            <HelpButtonAndModal title="Personnes comptabilisées dans les statistiques" size="3xl">
              <div className="tw-flex tw-flex-col tw-gap-4 tw-text-sm tw-text-zinc-700">
                <p>
                  Ce filtre détermine quelles personnes sont comptabilisées dans les statistiques. Seules les personnes assignées à au moins{" "}
                  <b>une des équipes sélectionnées pendant la période sélectionnée</b> sont prises en compte.
                </p>
                <div>
                  <h4 className="tw-text-base !tw-mb-1">Toutes les personnes</h4>
                  <p>
                    Toutes les personnes assignées à au moins une des équipes sélectionnées pendant la période, qu'il y ait eu une interaction ou non.
                  </p>
                </div>
                <div>
                  <h4 className="tw-text-base !tw-mb-1">Personnes mises à jour</h4>
                  <p>
                    Personnes pour lesquelles il y a eu au moins une interaction durant la période sélectionnée, quel que soit leur statut au moment
                    de la modification, y compris pendant qu'elles sont en dehors de la file active ou en dehors des équipes sélectionnées : création,
                    modification, commentaire, action, rencontre, passage, lieu fréquenté, consultation, traitement.
                  </p>
                </div>
                <div>
                  <h4 className="tw-text-base !tw-mb-1">Personnes suivies</h4>
                  <p>
                    Personnes pour lesquelles il y a eu au moins une interaction durant la période, en excluant les interactions réalisées lorsque la
                    personne était sortie de file active ou en dehors des équipes sélectionnées.
                  </p>
                </div>
                <div>
                  <h4 className="tw-text-base !tw-mb-1">Nouvelles personnes</h4>
                  <p>
                    Personnes qui ont rejoint une des équipes sélectionnées pour la première fois ou dont le suivi a commencé durant la période
                    sélectionnée.
                  </p>
                </div>
                <p className="tw-text-zinc-500 tw-italic">
                  Si aucune période n'est définie, l'ensemble des personnes présentes dans une des équipes sélectionnées à un moment ou un autre est
                  considéré.
                </p>
              </div>
            </HelpButtonAndModal>
          </div>
        )}

        {!evolutifDisabled && (
          <label
            className={[
              "tw-flex tw-items-center tw-gap-2 tw-select-none tw-shrink-0 tw-mt-2",
              evolutifDisabled ? "tw-opacity-40 tw-pointer-events-none" : "tw-cursor-pointer",
            ].join(" ")}
          >
            <div
              onClick={() => !evolutifDisabled && setEvolutivesStatsActivated(!evolutivesStatsActivated)}
              className={[
                "tw-relative tw-inline-flex tw-h-5 tw-w-9 tw-shrink-0 tw-rounded-full tw-transition-colors tw-duration-200",
                !evolutifDisabled ? "tw-cursor-pointer" : "",
                evolutivesStatsActivated && !evolutifDisabled ? "tw-bg-main" : "tw-bg-zinc-300",
              ].join(" ")}
            >
              <span
                className={[
                  "tw-inline-block tw-h-4 tw-w-4 tw-rounded-full tw-bg-white tw-shadow tw-transform tw-transition-transform tw-duration-200 tw-mt-0.5",
                  evolutivesStatsActivated && !evolutifDisabled ? "tw-translate-x-4 tw-ml-0.5" : "tw-translate-x-0 tw-ml-0.5",
                ].join(" ")}
              />
            </div>
            <span className="tw-text-sm tw-text-zinc-700">Affichage évolutif</span>
          </label>
        )}
      </div>

      {/* Tab-specific filter chips */}
      {activeTab === "Actions" && (
        <div className="noprint tw-mt-4">
          <FilterChipsV2
            filters={actionsChipFilters}
            setFilters={setActionsChipFilters}
            filterBase={actionsFilterBase}
            chipBgClass="tw-bg-orange-600/10"
            chipTextClass="tw-text-orange-700"
            chipLabelClass="tw-text-orange-700/60"
            chipHoverClass="hover:tw-bg-orange-600/20"
            addFilterLabel="Ajouter un filtre d'action"
            onAddFilter={() => {
              setSimpleFilterTab("Actions");
              setSimpleFilterEditingIndex(null);
              setSimpleFilterModalOpen(true);
            }}
            onEditFilter={(chipIndex) => {
              setSimpleFilterTab("Actions");
              setSimpleFilterEditingIndex(chipIndex);
              setSimpleFilterModalOpen(true);
            }}
          />
        </div>
      )}
      {!!organisation.receptionEnabled && activeTab === "Services" && (
        <div className="noprint tw-mt-4">
          <FilterChipsV2
            filters={servicesChipFilters}
            setFilters={setServicesChipFilters}
            filterBase={servicesFilterBase}
            chipBgClass="tw-bg-pink-500/10"
            chipTextClass="tw-text-pink-700"
            chipLabelClass="tw-text-pink-700/60"
            chipHoverClass="hover:tw-bg-pink-500/20"
            addFilterLabel="Ajouter un filtre de service"
            onAddFilter={() => {
              setSimpleFilterTab("Services");
              setSimpleFilterEditingIndex(null);
              setSimpleFilterModalOpen(true);
            }}
            onEditFilter={(chipIndex) => {
              setSimpleFilterTab("Services");
              setSimpleFilterEditingIndex(chipIndex);
              setSimpleFilterModalOpen(true);
            }}
          />
        </div>
      )}
      {activeTab === "Consultations" && (
        <div className="noprint tw-mt-4">
          <FilterChipsV2
            filters={consultationsChipFilters}
            setFilters={setConsultationsChipFilters}
            filterBase={consultationsFilterBase}
            chipBgClass="tw-bg-sky-600/10"
            chipTextClass="tw-text-sky-700"
            chipLabelClass="tw-text-sky-700/60"
            chipHoverClass="hover:tw-bg-sky-600/20"
            addFilterLabel="Ajouter un filtre de consultation"
            onAddFilter={() => {
              setSimpleFilterTab("Consultations");
              setSimpleFilterEditingIndex(null);
              setSimpleFilterModalOpen(true);
            }}
            onEditFilter={(chipIndex) => {
              setSimpleFilterTab("Consultations");
              setSimpleFilterEditingIndex(chipIndex);
              setSimpleFilterModalOpen(true);
            }}
          />
        </div>
      )}
      {!!organisation.rencontresEnabled && activeTab === "Rencontres" && !!organisation.territoriesEnabled && (
        <div className="noprint tw-mt-4">
          <FilterChipsV2
            filters={rencontresChipFilters}
            setFilters={setRencontresChipFilters}
            filterBase={rencontresFilterBase}
            chipBgClass="tw-bg-rose-500/10"
            chipTextClass="tw-text-rose-700"
            chipLabelClass="tw-text-rose-700/60"
            chipHoverClass="hover:tw-bg-rose-500/20"
            addFilterLabel="Ajouter un filtre de rencontre"
            onAddFilter={() => {
              setSimpleFilterTab("Rencontres");
              setSimpleFilterEditingIndex(null);
              setSimpleFilterModalOpen(true);
            }}
            onEditFilter={(chipIndex) => {
              setSimpleFilterTab("Rencontres");
              setSimpleFilterEditingIndex(chipIndex);
              setSimpleFilterModalOpen(true);
            }}
          />
        </div>
      )}
      {activeTab === "Observations" && (
        <div className="noprint tw-mt-4">
          <FilterChipsV2
            filters={filterObs}
            setFilters={setFilterObs}
            filterBase={obsFilterBase}
            chipBgClass="tw-bg-orange-600/10"
            chipTextClass="tw-text-orange-700"
            chipLabelClass="tw-text-orange-700/60"
            chipHoverClass="hover:tw-bg-orange-600/20"
            addFilterLabel="Ajouter un filtre d'observation"
            onAddFilter={() => {
              setObsEditingFilterIndex(null);
              setObsFilterModalOpen(true);
            }}
            onEditFilter={(chipIndex) => {
              const activeFilters = filterObs.filter((f) => f.field && f.value);
              const realIndex = filterObs.findIndex((f) => f === activeFilters[chipIndex]);
              setObsEditingFilterIndex(realIndex);
              setObsFilterModalOpen(true);
            }}
          />
        </div>
      )}

      {/* Person filter chips */}
      {!filtersDisabled && (
        <div className="noprint tw-mt-4">
          <FilterChipsV2
            filters={filterPersons}
            setFilters={setFilterPersons}
            filterBase={filterPersonsWithAllFields}
            onAddFilter={() => {
              setEditingFilterIndex(null);
              setFilterModalOpen(true);
            }}
            onEditFilter={(chipIndex) => {
              const activeFilters = filterPersons.filter((f) => f.field && f.value);
              const realIndex = filterPersons.findIndex((f) => f === activeFilters[chipIndex]);
              setEditingFilterIndex(realIndex);
              setFilterModalOpen(true);
            }}
          />
        </div>
      )}

      <FilterModalV2
        open={filterModalOpen}
        onClose={() => {
          setEditingFilterIndex(null);
          setFilterModalOpen(false);
        }}
        filterBase={filterPersonsWithAllFields}
        editingFilter={editingFilterIndex != null ? filterPersons[editingFilterIndex] : null}
        onAddFilter={(newFilter) => {
          setFilterPersons([...filterPersons, newFilter]);
        }}
        onEditFilter={(updatedFilter) => {
          setFilterPersons(filterPersons.map((f, i) => (i === editingFilterIndex ? updatedFilter : f)));
        }}
        filterLabel="de personne"
      />

      <FilterModalSimple
        open={simpleFilterModalOpen}
        onClose={() => {
          setSimpleFilterEditingIndex(null);
          setSimpleFilterModalOpen(false);
        }}
        filterBase={simpleFilterModalBase}
        editingFilter={simpleFilterEditingFilter}
        onAddFilter={applySimpleFilter}
        onEditFilter={applySimpleFilter}
        filterLabel={
          simpleFilterTab === "Actions"
            ? "d'action"
            : simpleFilterTab === "Services"
              ? "de service"
              : simpleFilterTab === "Consultations"
                ? "de consultation"
                : simpleFilterTab === "Rencontres"
                  ? "de rencontre"
                  : ""
        }
      />

      <FilterModalV2
        open={obsFilterModalOpen}
        onClose={() => {
          setObsEditingFilterIndex(null);
          setObsFilterModalOpen(false);
        }}
        filterBase={obsFilterBase}
        editingFilter={obsEditingFilterIndex != null ? filterObs[obsEditingFilterIndex] : null}
        onAddFilter={(newFilter) => {
          setFilterObs([...filterObs, newFilter]);
        }}
        onEditFilter={(updatedFilter) => {
          setFilterObs(filterObs.map((f, i) => (i === obsEditingFilterIndex ? updatedFilter : f)));
        }}
        filterLabel="d'observation"
      />

      {/* Tab content */}
      <StatsV2Provider>
        <div className="tw-pb-[75vh] tw-mt-6 print:tw-flex print:tw-flex-col print:tw-px-8 print:tw-py-4">
          {activeTab === "Général" && (
            <GeneralStats
              personTypeCounts={personTypeCounts}
              rencontres={rencontresFilteredByPersons}
              passages={passagesFilteredByPersons}
              actions={actionsWithDetailedGroupAndCategories}
              countFollowedWithActions={countFollowedWithActions}
              personsUpdatedWithActions={personsUpdatedWithActions}
              filterBase={filterPersonsWithAllFields}
              filterPersons={filterPersons}
              setFilterPersons={setFilterPersons}
              isStatsV2
            />
          )}
          {!!organisation.receptionEnabled && activeTab === "Services" && (
            <ServicesStats
              period={period}
              teamIds={selectedTeams.map((e) => e?._id)}
              isStatsV2
              servicesGroupFilter={servicesGroupFilter}
              setServicesGroupFilter={setServicesGroupFilter}
              servicesFilter={servicesFilter}
              setServicesFilter={setServicesFilter}
            />
          )}
          {activeTab === "Actions" && (
            <ActionsStats
              actionsWithDetailedGroupAndCategories={actionsWithDetailedGroupAndCategories}
              setActionsStatuses={setActionsStatuses}
              actionsStatuses={actionsStatuses}
              setActionsCategoriesGroups={setActionsCategoriesGroups}
              actionsCategoriesGroups={actionsCategoriesGroups}
              groupsCategories={groupsCategories}
              setActionsCategories={setActionsCategories}
              actionsCategories={actionsCategories}
              filterableActionsCategories={filterableActionsCategories}
              personsUpdatedWithActions={personsUpdatedWithActions}
              filterBase={filterPersonsWithAllFields}
              filterPersons={filterPersons}
              setFilterPersons={setFilterPersons}
              isStatsV2
            />
          )}
          {activeTab === "Personnes" && (
            <PersonStats
              title="personnes"
              firstBlockHelp={`Nombre de personnes comptabilisées selon le filtre sélectionné.\n\nSi aucune période n'est définie, on considère l'ensemble des personnes.`}
              filterBase={filterPersonsWithAllFields}
              filterPersons={filterPersons}
              setFilterPersons={setFilterPersons}
              personsForStats={personsForStats}
              personFields={personFields}
              flattenedCustomFieldsPersons={flattenedCustomFieldsPersons}
              evolutivesStatsActivated={evolutivesStatsActivated}
              period={period}
              evolutiveStatsIndicators={evolutiveStatsIndicators}
              setEvolutiveStatsIndicators={setEvolutiveStatsIndicators}
              viewAllOrganisationData={viewAllOrganisationData}
              selectedTeamsObjectWithOwnPeriod={selectedTeamsObjectWithOwnPeriod}
              isStatsV2
            />
          )}
          {!!organisation.passagesEnabled && activeTab === "Passages" && (
            <PassagesStats
              passages={passages}
              personFields={personFields}
              personsInPassagesBeforePeriod={personsInPassagesBeforePeriod}
              personsUpdated={personsForStats}
              personsWithPassages={personsWithPassages}
              filterBase={filterPersonsWithAllFields}
              filterPersons={filterPersons}
              setFilterPersons={setFilterPersons}
              isStatsV2
            />
          )}
          {!!organisation.rencontresEnabled && activeTab === "Rencontres" && (
            <RencontresStats
              rencontres={rencontresFilteredByPersons}
              territories={territories}
              personFields={personFields}
              personsInRencontresBeforePeriod={personsInRencontresBeforePeriod}
              personsUpdated={personsForStats}
              filterBase={filterPersonsWithAllFields}
              filterPersons={filterPersons}
              setFilterPersons={setFilterPersons}
              selectedTerritories={rencontresTerritories}
              setSelectedTerritories={setRencontresTerritories}
              isTerritoriesEnabled={!!organisation.territoriesEnabled}
              isStatsV2
            />
          )}
          {activeTab === "Observations" && (
            <ObservationsStats
              territories={territories}
              filterObs={filterObs}
              setFilterObs={setFilterObs}
              observations={observations}
              customFieldsObs={customFieldsObs}
              period={period}
              selectedTeams={selectedTeams}
              isStatsV2
            />
          )}
          {activeTab === "Comptes-rendus" && <ReportsStats reports={reports} hideTitle />}
          {activeTab === "Consultations" && (
            <ConsultationsStats
              consultations={consultationsFilteredByStatus}
              personsUpdated={personsForStats}
              personsWithConsultations={personsWithConsultations}
              filterBase={filterPersonsWithAllFields}
              filterPersons={filterPersons}
              setFilterPersons={setFilterPersons}
              consultationsStatuses={consultationsStatuses}
              setConsultationsStatuses={setConsultationsStatuses}
              consultationsTypes={consultationsTypes}
              setConsultationsTypes={setConsultationsTypes}
              isStatsV2
            />
          )}
          {activeTab === "Dossiers médicaux" && (
            <MedicalFilesStats
              title="personnes"
              personsUpdated={personsForStats}
              personsForStats={personsForStats}
              customFieldsMedicalFile={customFieldsMedicalFile}
              personFields={personFields}
              filterBase={filterPersonsWithAllFields}
              filterPersons={filterPersons}
              setFilterPersons={setFilterPersons}
              isStatsV2
            />
          )}
        </div>
      </StatsV2Provider>
      {/* HACK: this last div is because Chrome crop the end of the page - I didn't find any better solution */}
      <div className="printonly tw-h-screen" aria-hidden />
    </>
  );
};

export default StatsV2;
