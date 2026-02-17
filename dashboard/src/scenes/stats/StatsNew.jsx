import { useState, useMemo, useEffect } from "react";
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
import { actionsCategoriesSelector, DONE, flattenedActionsCategoriesSelector } from "../../atoms/actions";
import { reportsState } from "../../atoms/reports";
import { territoriesState } from "../../atoms/territory";
import { customFieldsMedicalFileSelector } from "../../atoms/medicalFiles";
import { arrayOfitemsGroupedByPersonSelector, populatedPassagesSelector } from "../../atoms/selectors";
import useTitle from "../../services/useTitle";
import { formatPeriod, statsPresets } from "../../components/DateRangePickerWithPresets";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";
import SelectCustom from "../../components/SelectCustom";
import ExportFormattedData from "../data-import-export/ExportFormattedData";
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
import { dayjsInstance, dateForDatePicker } from "../../services/date";
import { useRestoreScrollPosition } from "../../utils/useRestoreScrollPosition";
import FilterBadges from "./FilterBadges";
import { computeStatsData } from "./utils-v2";
import HelpButtonAndModal from "../../components/HelpButtonAndModal";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import OutsideClickHandler from "react-outside-click-handler";
import ReactDatePicker from "react-datepicker";

const allTabs = [
  { key: "general", label: "Général" },
  { key: "services", label: "Services", enabledKey: "receptionEnabled" },
  { key: "actions", label: "Actions" },
  { key: "personnes", label: "Personnes" },
  { key: "passages", label: "Passages", enabledKey: "passagesEnabled" },
  { key: "rencontres", label: "Rencontres", enabledKey: "rencontresEnabled" },
  { key: "observations", label: "Observations", enabledKey: "territoriesEnabled" },
  { key: "comptes-rendus", label: "Comptes-rendus" },
  { key: "consultations", label: "Consultations" },
  { key: "dossiers-medicaux", label: "Dossiers médicaux" },
];

const personFilterModes = [
  { label: "Toutes les personnes", value: "modified" },
  { label: "Personnes suivies", value: "followed" },
  { label: "Nouvelles personnes", value: "created" },
];

const tabsWithNoPersonFilter = ["services", "observations", "comptes-rendus"];
const tabsWithEvolutiveStats = ["personnes"];

const initFilters = [];

const StatsDatePicker = ({ period, setPeriod, preset, setPreset, removePreset }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [localStartDate, setLocalStartDate] = useState(null);
  const [numberOfMonths, setNumberOfMonths] = useState(() => (window.innerWidth < 1100 ? 1 : 2));

  useEffect(() => {
    const handleResize = () => setNumberOfMonths(window.innerWidth < 1100 ? 1 : 2);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const onChange = (dates) => {
    const [startDate, endDate] = dates;
    if (!endDate) return setLocalStartDate(startDate);
    setLocalStartDate(null);
    setPeriod({
      startDate: dateForDatePicker(startDate, "start"),
      endDate: dateForDatePicker(endDate, "end"),
    });
    removePreset();
  };

  return (
    <div className="tw-relative">
      <button
        type="button"
        className="button-classic !tw-ml-0 tw-flex tw-items-center tw-gap-2 tw-whitespace-nowrap"
        onClick={() => setShowPicker(!showPicker)}
      >
        <CalendarDaysIcon className="tw-w-4 tw-h-4" />
        {formatPeriod({ preset, period })}
      </button>
      {showPicker && (
        <OutsideClickHandler onOutsideClick={() => setShowPicker(false)}>
          <div className="stats-datepicker tw-absolute tw-top-12 tw-right-0 tw-z-20 tw-flex tw-flex-nowrap tw-items-center tw-justify-end tw-overflow-x-auto tw-rounded-lg tw-border tw-border-gray-300 tw-bg-white tw-pl-56 lg:tw-min-w-[45rem]">
            <div className="tw-absolute tw-bottom-0 tw-left-0 tw-top-0 tw-ml-2 tw-box-border tw-flex tw-max-h-full tw-w-56 tw-flex-1 tw-flex-col tw-items-start tw-justify-start tw-overflow-y-scroll">
              {statsPresets.map((p) => (
                <button
                  type="button"
                  className="tw-w-full tw-rounded-lg tw-border-0 tw-bg-white tw-p-1 tw-text-center hover:tw-bg-main25"
                  key={p.label}
                  onClick={() => {
                    setPreset(p.label);
                    setPeriod({
                      startDate: dateForDatePicker(p.period.startDate, "start"),
                      endDate: dateForDatePicker(p.period.endDate, "end"),
                    });
                    setShowPicker(false);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <ReactDatePicker
              monthsShown={numberOfMonths}
              selectsRange
              inline
              locale="fr"
              name="date"
              selected={dateForDatePicker(localStartDate || period.startDate, "start")}
              onChange={onChange}
              startDate={dateForDatePicker(localStartDate || period.startDate, "start")}
              endDate={dateForDatePicker(localStartDate ? null : period.endDate, "end")}
            />
          </div>
        </OutsideClickHandler>
      )}
    </div>
  );
};

const personsForStatsSelector = (period, allRawPersons, personTypesByFieldsNames) => {
  const snapshotDate = dayjsInstance(period.endDate).format("YYYY-MM-DD");
  return allRawPersons.map((person) => {
    const snapshotAtDate = getPersonSnapshotAtDate({
      person,
      snapshotDate,
      typesByFields: personTypesByFieldsNames,
    });
    return {
      ...snapshotAtDate,
      followSinceMonths: dayjsInstance(snapshotDate).diff(person.followedSince, "months"),
    };
  });
};

const StatsNew = ({ onSwitchToLegacy }) => {
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

  // State with v2- prefixed localStorage keys for isolation
  const [activeTab, setActiveTab] = useLocalStorage("stats-v2-tabCaption", "general");
  const [filterPersons, setFilterPersons] = useLocalStorage("stats-v2-filterPersons", initFilters);
  const [filterObs, setFilterObs] = useLocalStorage("stats-v2-filterObs", []);
  const [viewAllOrganisationData, setViewAllOrganisationData] = useLocalStorage("stats-v2-viewAllOrganisationData", teams.length === 1);
  const [period, setPeriod] = useLocalStorage("stats-v2-period", { startDate: null, endDate: null });
  const [preset, setPreset, removePreset] = useLocalStorage("stats-v2-date-preset", null);
  const [manuallySelectedTeams, setSelectedTeams] = useLocalStorage("stats-v2-teams", [currentTeam]);
  const [personFilterMode, setPersonFilterMode] = useLocalStorage("stats-v2-personFilterMode", "modified");

  const [actionsStatuses, setActionsStatuses] = useLocalStorage("stats-v2-actionsStatuses", DONE);
  const [actionsCategoriesGroups, setActionsCategoriesGroups] = useLocalStorage("stats-v2-catGroups", []);
  const [actionsCategories, setActionsCategories] = useLocalStorage("stats-v2-categories", []);
  const [consultationsStatuses, setConsultationsStatuses] = useLocalStorage("stats-v2-consultationsStatuses", []);
  const [consultationsTypes, setConsultationsTypes] = useLocalStorage("stats-v2-consultationsTypes", []);
  const [rencontresTerritories, setRencontresTerritories] = useLocalStorage("stats-v2-rencontresTerritories", []);

  const [evolutivesStatsActivated, setEvolutivesStatsActivated] = useLocalStorage("stats-v2-evolutivesStatsActivated", false);
  const [evolutiveStatsIndicators, setEvolutiveStatsIndicators] = useLocalStorage("stats-v2-evolutivesStatsIndicatorsArray", []);
  useTitle(`Statistiques`);

  // Teams
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
      teamsIdsObject[team._id] = { isoStartDate, isoEndDate };
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

  // Persons snapshot
  const allRawPersons = useAtomValue(arrayOfitemsGroupedByPersonSelector);
  const personTypesByFieldsNames = useAtomValue(personTypesByFieldsNamesSelector);

  const allPersons = useMemo(() => {
    return personsForStatsSelector(period, allRawPersons, personTypesByFieldsNames);
  }, [period, allRawPersons, personTypesByFieldsNames]);

  // Core data computation
  const {
    personsCreated,
    personsUpdated,
    personsFollowed,
    personsUpdatedWithActions,
    actionsFilteredByPersons,
    personsWithConsultations,
    consultationsFilteredByPersons,
    personsWithPassages,
    personsInPassagesBeforePeriod,
    passagesFilteredByPersons,
    personsInRencontresBeforePeriod,
    rencontresFilteredByPersons,
  } = useMemo(() => {
    return computeStatsData({
      period,
      allPersons,
      filterPersons,
      selectedTeamsObjectWithOwnPeriod,
      viewAllOrganisationData,
      teams,
      territories,
      personFilterMode,
    });
  }, [period, filterPersons, selectedTeamsObjectWithOwnPeriod, viewAllOrganisationData, allPersons, teams, territories, personFilterMode]);

  // Persons for the active mode
  const personsForMode = useMemo(() => {
    if (personFilterMode === "created") return personsCreated;
    if (personFilterMode === "followed") return personsFollowed;
    return personsUpdated;
  }, [personFilterMode, personsCreated, personsFollowed, personsUpdated]);

  const personModeTitle = useMemo(() => {
    if (personFilterMode === "created") return "nouvelles personnes";
    if (personFilterMode === "followed") return "personnes suivies";
    return "toutes les personnes";
  }, [personFilterMode]);

  // Actions categories filter
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
      if (!!actionsStatuses.length && !actionsStatuses.includes(action.status)) continue;
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
    return actionsDetailed
      .filter((a) => !actionsCategoriesGroups.length || actionsCategoriesGroups.includes(a.categoryGroup))
      .filter((a) => {
        if (!actionsCategories.length) return true;
        if (actionsCategories.length === 1 && actionsCategories[0] === "-- Aucune --") return !a.categories?.length;
        return actionsCategories.includes(a.category);
      });
  }, [actionsFilteredByPersons, groupsCategories, actionsCategoriesGroups, actionsCategories, actionsStatuses]);

  const passages = useMemo(() => {
    const activeFilters = filterPersons.filter((f) => f.value);
    if (activeFilters.length) return passagesFilteredByPersons;
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

  // Filter base
  const filterPersonsBase = useAtomValue(filterPersonsBaseSelector);
  const filterPersonsWithAllFields = useMemo(() => {
    const filterBase = [
      ...filterPersonsBase.map((f) => {
        if (f.field === "outOfActiveList") {
          return { ...f, options: ["Oui", "Non"], type: "multi-choice" };
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

  // Available tabs
  const availableTabs = allTabs.filter((tab) => {
    if (tab.enabledKey) return !!organisation[tab.enabledKey];
    return true;
  });

  const isPersonFilterDisabled = tabsWithNoPersonFilter.includes(activeTab);
  const isEvolutiveDisabled = !tabsWithEvolutiveStats.includes(activeTab);
  const showPersonFilterBadges = !["services", "comptes-rendus", "observations"].includes(activeTab);

  useRestoreScrollPosition();

  return (
    <>
      {/* CSS to hide inline Filters rendered by sub-components */}
      <style>{`.stats-new-content .border-b.noprint.tw-z-10.tw-mb-4 { display: none !important; }`}</style>

      <div>
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
        <div className="noprint tw-flex tw-items-center tw-mt-8 tw-mb-6">
          <h1 className="tw-text-xl tw-font-normal tw-flex tw-items-center tw-gap-3">
            Statistiques
            <span className="tw-text-xs tw-font-medium tw-bg-main/10 tw-text-main tw-px-2 tw-py-0.5 tw-rounded-full">nouveau</span>
          </h1>
          <div className="tw-ml-auto tw-flex tw-items-center tw-gap-4">
            <ButtonCustom type="button" color="link" title="Imprimer" onClick={window.print} />
            <ExportFormattedData
              observations={observations}
              passages={passagesFilteredByPersons}
              rencontres={rencontresFilteredByPersons}
              personCreated={personsCreated}
              personUpdated={personsUpdated}
              actions={actionsWithDetailedGroupAndCategories}
              consultations={consultationsFilteredByPersons}
            />
            <button type="button" className="tw-text-sm tw-text-zinc-500 hover:tw-text-zinc-700 tw-cursor-pointer" onClick={onSwitchToLegacy}>
              Revenir à l'ancien affichage
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="noprint tw-flex tw-flex-row tw-flex-wrap tw-border-b tw-border-zinc-200 tw-mb-6">
        {availableTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-border-b-2 tw-transition-colors tw-cursor-pointer",
              activeTab === tab.key
                ? "tw-border-main tw-text-main tw-bg-stone-50 tw-rounded-t-md"
                : "tw-border-transparent tw-text-zinc-500 hover:tw-text-zinc-700 hover:tw-border-zinc-300",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Unified filter bar */}
      <div className="noprint tw-flex tw-flex-row tw-items-start tw-gap-4">
        <div className="tw-grow tw-min-w-48 tw-max-w-md">
          <SelectTeamMultiple
            onChange={(teamsId) => {
              setSelectedTeams(teams.filter((t) => teamsId.includes(t._id)));
            }}
            value={selectedTeams.map((e) => e?._id)}
            colored
            isDisabled={viewAllOrganisationData}
          />
          {teams.length > 1 && (
            <label htmlFor="stats-v2-viewAllOrganisationData" className="tw-flex tw-items-center tw-text-sm tw-mt-1">
              <input
                id="stats-v2-viewAllOrganisationData"
                type="checkbox"
                className="tw-mr-2.5"
                checked={viewAllOrganisationData}
                value={viewAllOrganisationData}
                onChange={() => setViewAllOrganisationData(!viewAllOrganisationData)}
              />
              Statistiques de toute l'organisation
            </label>
          )}
        </div>
        <StatsDatePicker period={period} setPeriod={setPeriod} preset={preset} setPreset={setPreset} removePreset={removePreset} />
        <div className="tw-flex tw-items-center">
          <SelectCustom
            options={personFilterModes}
            value={personFilterModes.find((m) => m.value === personFilterMode)}
            onChange={(option) => {
              if (option) setPersonFilterMode(option.value);
            }}
            getOptionValue={(o) => o.value}
            getOptionLabel={(o) => o.label}
            name="person-filter-mode"
            inputId="person-filter-mode"
            className="tw-text-sm tw-min-w-64"
            isDisabled={isPersonFilterDisabled}
            isClearable={false}
          />
          <HelpButtonAndModal title="Personnes comptabilisées dans les statistiques" size="3xl">
            <div className="tw-flex tw-flex-col tw-gap-4 tw-text-sm tw-text-zinc-700">
              <p>
                Ce filtre détermine quelles personnes sont comptabilisées dans les statistiques. Seules les personnes assignées à au moins{" "}
                <b>une des équipes sélectionnées pendant la période sélectionnée</b> sont prises en compte.
              </p>
              <div>
                <h4 className="tw-text-lg">Toutes les personnes</h4>
                <p>
                  Toutes les personnes pour lesquelles il y a eu au moins une interaction durant la période sélectionnée, quel que soit leur statut au
                  moment de la modification, y compris pendant qu'elles sont en dehors de la file active ou en dehors des équipes sélectionnées :
                  création, modification, commentaire, action, rencontre, passage, lieu fréquenté, consultation, traitement.
                </p>
              </div>
              <div>
                <h4 className="tw-text-lg">Personnes suivies</h4>
                <p>
                  Personnes pour lesquelles il y a eu au moins une interaction durant la période, en excluant les interactions réalisées lorsque la
                  personne était sortie de file active ou en dehors des équipes sélectionnées.
                </p>
              </div>
              <div>
                <h4 className="tw-text-lg">Nouvelles personnes</h4>
                <p>
                  Personnes qui ont rejoint une des équipes sélectionnées pour la première fois ou dont la fiche a été créée durant la période
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
        <label
          className={[
            "tw-flex tw-items-center tw-gap-2 tw-select-none tw-whitespace-nowrap tw-mt-2",
            isEvolutiveDisabled ? "tw-opacity-40 tw-pointer-events-none" : "tw-cursor-pointer",
          ].join(" ")}
        >
          <div
            onClick={() => !isEvolutiveDisabled && setEvolutivesStatsActivated(!evolutivesStatsActivated)}
            className={[
              "tw-relative tw-inline-flex tw-h-5 tw-w-9 tw-shrink-0 tw-rounded-full tw-transition-colors tw-duration-200",
              !isEvolutiveDisabled ? "tw-cursor-pointer" : "",
              evolutivesStatsActivated && !isEvolutiveDisabled ? "tw-bg-main" : "tw-bg-zinc-300",
            ].join(" ")}
          >
            <span
              className={[
                "tw-inline-block tw-h-4 tw-w-4 tw-rounded-full tw-bg-white tw-shadow tw-transform tw-transition-transform tw-duration-200 tw-mt-0.5",
                evolutivesStatsActivated && !isEvolutiveDisabled ? "tw-translate-x-4 tw-ml-0.5" : "tw-translate-x-0 tw-ml-0.5",
              ].join(" ")}
            />
          </div>
          <span className="tw-text-sm tw-text-zinc-700">Affichage évolutif</span>
        </label>
      </div>

      {/* Filter badges */}
      <div className="noprint tw-mt-4">
        {showPersonFilterBadges && <FilterBadges base={filterPersonsWithAllFields} filters={filterPersons} onChange={setFilterPersons} />}
      </div>

      {/* Tab content — stats-new-content class hides inline Filters from sub-components */}
      <div
        className={[
          "tw-pb-[75vh] print:tw-flex print:tw-flex-col print:tw-px-8 print:tw-py-4",
          showPersonFilterBadges ? "stats-new-content" : "",
        ].join(" ")}
      >
        {activeTab === "general" && (
          <GeneralStats
            personsCreated={personsCreated}
            personsUpdated={personsForMode}
            rencontres={rencontresFilteredByPersons}
            passages={passagesFilteredByPersons}
            actions={actionsWithDetailedGroupAndCategories}
            personsUpdatedWithActions={personsUpdatedWithActions}
            filterBase={filterPersonsWithAllFields}
            filterPersons={filterPersons}
            setFilterPersons={setFilterPersons}
          />
        )}
        {activeTab === "services" && !!organisation.receptionEnabled && <ServicesStats period={period} teamIds={selectedTeams.map((e) => e?._id)} />}
        {activeTab === "actions" && (
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
          />
        )}
        {activeTab === "personnes" && (
          <PersonStats
            title={personModeTitle}
            firstBlockHelp={`Nombre de ${personModeTitle} correspondant aux critères sélectionnés.\n\nSi aucune période n'est définie, on considère l'ensemble des personnes.`}
            filterBase={filterPersonsWithAllFields}
            filterPersons={filterPersons}
            setFilterPersons={setFilterPersons}
            personsForStats={personsForMode}
            personFields={personFields}
            flattenedCustomFieldsPersons={flattenedCustomFieldsPersons}
            evolutivesStatsActivated={evolutivesStatsActivated}
            period={period}
            evolutiveStatsIndicators={evolutiveStatsIndicators}
            setEvolutiveStatsIndicators={setEvolutiveStatsIndicators}
            viewAllOrganisationData={viewAllOrganisationData}
            selectedTeamsObjectWithOwnPeriod={selectedTeamsObjectWithOwnPeriod}
          />
        )}
        {activeTab === "passages" && !!organisation.passagesEnabled && (
          <PassagesStats
            passages={passages}
            personFields={personFields}
            personsInPassagesBeforePeriod={personsInPassagesBeforePeriod}
            personsUpdated={personsForMode}
            personsWithPassages={personsWithPassages}
            filterBase={filterPersonsWithAllFields}
            filterPersons={filterPersons}
            setFilterPersons={setFilterPersons}
          />
        )}
        {activeTab === "rencontres" && !!organisation.rencontresEnabled && (
          <RencontresStats
            rencontres={rencontresFilteredByPersons}
            territories={territories}
            personFields={personFields}
            personsInRencontresBeforePeriod={personsInRencontresBeforePeriod}
            personsUpdated={personsForMode}
            filterBase={filterPersonsWithAllFields}
            filterPersons={filterPersons}
            setFilterPersons={setFilterPersons}
            selectedTerritories={rencontresTerritories}
            setSelectedTerritories={setRencontresTerritories}
            isTerritoriesEnabled={!!organisation.territoriesEnabled}
          />
        )}
        {activeTab === "observations" && (
          <ObservationsStats
            territories={territories}
            filterObs={filterObs}
            setFilterObs={setFilterObs}
            observations={observations}
            customFieldsObs={customFieldsObs}
            period={period}
            selectedTeams={selectedTeams}
          />
        )}
        {activeTab === "comptes-rendus" && <ReportsStats reports={reports} />}
        {activeTab === "consultations" && (
          <ConsultationsStats
            consultations={consultationsFilteredByStatus}
            personsUpdated={personsForMode}
            personsWithConsultations={personsWithConsultations}
            filterBase={filterPersonsWithAllFields}
            filterPersons={filterPersons}
            setFilterPersons={setFilterPersons}
            consultationsStatuses={consultationsStatuses}
            setConsultationsStatuses={setConsultationsStatuses}
            consultationsTypes={consultationsTypes}
            setConsultationsTypes={setConsultationsTypes}
          />
        )}
        {activeTab === "dossiers-medicaux" && (
          <MedicalFilesStats
            filterBase={filterPersonsWithAllFields}
            title={personModeTitle}
            personsUpdated={personsForMode}
            filterPersons={filterPersons}
            setFilterPersons={setFilterPersons}
            personsForStats={personsForMode}
            customFieldsMedicalFile={customFieldsMedicalFile}
            personFields={personFields}
          />
        )}
      </div>
      <div className="printonly tw-h-screen" aria-hidden />
    </>
  );
};

export default StatsNew;
