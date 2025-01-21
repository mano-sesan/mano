import { useRecoilValue } from "recoil";
import useTitle from "../../services/useTitle";
import { currentTeamState, organisationState, teamsState, userState } from "../../recoil/auth";
import { useLocalStorage } from "../../services/useLocalStorage";
import { useMemo, useState } from "react";
import { useRestoreScrollPosition } from "../../utils/useRestoreScrollPosition";
import DateRangePickerWithPresets, { formatPeriod, statsPresets } from "../../components/DateRangePickerWithPresets";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";
import ButtonCustom from "../../components/ButtonCustom";
import TabsNav from "../../components/tailwind/TabsNav";
import { dayjsInstance } from "../../services/date";
import { Filter, StatsContext } from "./queries";
import { StatsGeneral } from "./StatsGeneral";
import Filters from "../../components/Filters";
import { fieldsPersonsCustomizableOptionsSelector, filterPersonsBaseSelector, flattenedCustomFieldsPersonsSelector } from "../../recoil/persons";
import { customFieldsMedicalFileSelector } from "../../recoil/medicalFiles";
import { flattenedCustomFieldsConsultationsSelector } from "../../recoil/consultations";
import { StatsPersonnes } from "./StatsPersonnes";
import { StatsMedicales } from "./StatsMedicales";
import ServicesStats from "../stats/ServicesStats";
import { StatsActions } from "./StatsActions";
import { StatsConsultations } from "./StatsConsultations";

const tabs = [
  "Général",
  "Services",
  "Actions",
  "Personnes créées",
  "Personnes suivies",
  "Passages",
  "Rencontres",
  "Observations",
  "Comptes-rendus",
  "Consultations",
  "Dossiers médicaux des personnes créées",
  "Dossiers médicaux des personnes suivies",
];

const tabsWithPersonFilter = [
  "Général",
  "Actions",
  "Personnes créées",
  "Personnes suivies",
  "Passages",
  "Rencontres",
  "Observations",
  "Dossiers médicaux des personnes créées",
  "Dossiers médicaux des personnes suivies",
];

export default function Stats() {
  const fieldsPersonsCustomizableOptions = useRecoilValue(fieldsPersonsCustomizableOptionsSelector);
  const flattenedCustomFieldsPersons = useRecoilValue(flattenedCustomFieldsPersonsSelector);
  const consultationFields = useRecoilValue(flattenedCustomFieldsConsultationsSelector);
  const customFieldsMedicalFile = useRecoilValue(customFieldsMedicalFileSelector);
  const filterPersonsBase = useRecoilValue(filterPersonsBaseSelector);
  const organisation = useRecoilValue(organisationState);
  const currentTeam = useRecoilValue(currentTeamState);
  const teams = useRecoilValue(teamsState);
  const user = useRecoilValue(userState);

  const [viewAllOrganisationData, setViewAllOrganisationData] = useLocalStorage("stats-viewAllOrganisationData", teams.length === 1);
  const [manuallySelectedTeams, setSelectedTeams] = useLocalStorage("stats-teams", [currentTeam]);
  const [period, setPeriod] = useLocalStorage("period", { startDate: null, endDate: null });
  const [preset, setPreset, removePreset] = useLocalStorage("stats-date-preset", null);
  const [activeTab, setActiveTab] = useLocalStorage("stats-tabCaption", "Général");

  const [filterPersons, setFilterPersons] = useState<Filter[]>([]);

  useTitle(`${activeTab} - Statistiques`);

  const selectedTeams = useMemo(() => {
    if (viewAllOrganisationData) return teams;
    return manuallySelectedTeams;
  }, [manuallySelectedTeams, viewAllOrganisationData, teams]);

  const { from, to } = useMemo(() => {
    if (!period.startDate || !period.endDate) return { from: null, to: null };
    const hasNightSession = selectedTeams.some((team) => team.nightSession);
    const hasDaySession = selectedTeams.some((team) => !team.nightSession);
    const from = !hasDaySession ? dayjsInstance(period.startDate).add(12, "hour") : dayjsInstance(period.startDate);
    const to = hasNightSession ? dayjsInstance(period.endDate).add(12, "hour") : dayjsInstance(period.endDate);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [period, selectedTeams]);

  // Add enabled custom fields in filters.
  const filterPersonsWithAllFields = useMemo(() => {
    const filterBase = [
      ...filterPersonsBase.map((f) =>
        f.field !== "outOfActiveList"
          ? f
          : {
              ...f,
              options: ["Oui", "Non", "Oui et non (c'est-à-dire tout le monde)"],
              type: "multi-choice",
            }
      ),
      // On considère que les champs fieldsPersonsCustomizableOptions sont toujours activés
      // Parce qu'il s'agit uniquement du champ "Motif de sortie de file active" (outOfActiveListReasons)
      // et qu'un vieux bug qu'on pouvait les désactiver.
      ...fieldsPersonsCustomizableOptions.map((a) => ({ field: a.name, ...a })),
      // Par contre, les champs customFieldsPersons sont dépendants de l'état des équipes
      ...flattenedCustomFieldsPersons.filter((a) => a.enabled || a.enabledTeams?.includes(currentTeam._id)).map((a) => ({ field: a.name, ...a })),
    ];
    if (user.healthcareProfessional) {
      filterBase.push(
        ...customFieldsMedicalFile.filter((a) => a.enabled || a.enabledTeams?.includes(currentTeam._id)).map((a) => ({ field: a.name, ...a }))
      );
      filterBase.push(
        ...consultationFields.filter((a) => a.enabled || a.enabledTeams?.includes(currentTeam._id)).map((a) => ({ field: a.name, ...a }))
      );
    }
    return filterBase;
  }, [
    filterPersonsBase,
    fieldsPersonsCustomizableOptions,
    flattenedCustomFieldsPersons,
    customFieldsMedicalFile,
    consultationFields,
    currentTeam,
    user,
  ]);

  const usePersonFilter = tabsWithPersonFilter.includes(activeTab);

  const context: StatsContext = {
    baseFilters: (filterPersonsBase || []).map((f) => ({ ...f, id: f.field })),
    filters: usePersonFilter ? filterPersons : [],
    teams: selectedTeams.map((t: { _id: string }) => t._id),
    period: { from, to },
  };

  const availableTabs = tabs.filter((tabCaption) => {
    if (["Observations"].includes(tabCaption)) {
      return !!organisation.territoriesEnabled;
    }
    if (["Services"].includes(tabCaption)) {
      return !!organisation.receptionEnabled;
    }
    if (["Rencontres"].includes(tabCaption)) {
      return !!organisation.rencontresEnabled;
    }
    if (["Passages"].includes(tabCaption)) {
      return !!organisation.passagesEnabled;
    }
    return true;
  });

  useRestoreScrollPosition();
  return (
    <>
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
        <div className="noprint tw-flex tw-justify-start tw-items-start tw-mt-10 tw-mb-8">
          <h1 className="tw-block tw-text-xl tw-min-w-64 tw-full tw-font-normal">
            <span>Statistiques {viewAllOrganisationData ? <>globales</> : <>{selectedTeams.length > 1 ? "des équipes" : "de l'équipe"}</>}</span>
          </h1>
          <div className="tw-ml-4 tw-min-w-96">
            <SelectTeamMultiple
              inputId="stats-teams"
              classNamePrefix="stats-teams"
              onChange={(teamsId) => {
                setSelectedTeams(teams.filter((t) => teamsId.includes(t._id)));
              }}
              value={selectedTeams.map((e) => e?._id)}
              isDisabled={viewAllOrganisationData}
            />
            {teams.length > 1 && (
              <label htmlFor="viewAllOrganisationData" className="tw-flex tw-items-center tw-text-sm">
                <input
                  id="viewAllOrganisationData"
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
        </div>
      </div>
      <div className="noprint date-picker-container tw-mb-5 tw-flex tw-flex-wrap tw-items-center">
        <div className="tw-min-w-[15rem] tw-shrink-0 tw-basis-1/3 tw-p-0">
          <DateRangePickerWithPresets
            presets={statsPresets}
            defaultPreset={undefined}
            period={period}
            setPeriod={setPeriod}
            preset={preset}
            setPreset={setPreset}
            removePreset={removePreset}
          />
        </div>
        <div className="tw-ml-auto tw-flex tw-basis-1/3 tw-items-center tw-justify-end">
          <ButtonCustom type="button" color="link" title="Imprimer" onClick={window.print} />
        </div>
      </div>
      <TabsNav
        className="tw-flex-wrap tw-justify-center tw-px-3 tw-py-2"
        tabs={availableTabs}
        onClick={(tabCaption) => setActiveTab(tabCaption)}
        activeTabIndex={availableTabs.findIndex((tab) => tab === activeTab)}
      />
      {usePersonFilter && (
        <Filters
          title="Filtrer par personnes suivies:"
          base={filterPersonsWithAllFields}
          // Todo: optimize this
          filters={filterPersons.map((a) => {
            const base = filterPersonsWithAllFields.find((b) => b.field === a.id);
            return base ? { ...base, value: a.value } : a;
          })}
          onChange={(a) => {
            setFilterPersons(a.map((a) => ({ id: a.field, value: a.value })));
          }}
        />
      )}
      {activeTab === "Général" && <StatsGeneral context={context} />}
      {activeTab === "Services" && <ServicesStats period={{ startDate: period.from, endDate: period.to }} teamIds={context.teams} />}
      {activeTab === "Actions" && <StatsActions context={context} />}

      {activeTab === "Personnes créées" && <StatsPersonnes context={context} population="personnes_creees" />}
      {activeTab === "Personnes suivies" && <StatsPersonnes context={context} population="personnes_suivies" />}
      {activeTab === "Consultations" && <StatsConsultations context={context} />}
      {activeTab === "Dossiers médicaux des personnes créées" && <StatsMedicales context={context} population="personnes_creees" />}
      {activeTab === "Dossiers médicaux des personnes suivies" && <StatsMedicales context={context} population="personnes_suivies" />}
      <div className="tw-pb-[75vh] print:tw-flex print:tw-flex-col print:tw-px-8 print:tw-py-4"></div>
      {/* HACK: this last div is because Chrome crop the end of the page - I didn't find any better solution */}
      <div className="printonly tw-h-screen" aria-hidden />
    </>
  );
}
