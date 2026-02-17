import { useAtomValue } from "jotai";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";
import { teamsState } from "../../atoms/auth";
import { useState } from "react";
import { CalendarDaysIcon, XMarkIcon, PlusIcon } from "@heroicons/react/24/outline";
import SelectCustom from "../../components/SelectCustom";
import HelpButtonAndModal from "../../components/HelpButtonAndModal";

const tabs = [
  "Général",
  "Services",
  "Actions",
  "Personnes",
  "Passages",
  "Rencontres",
  "Observations",
  "Comptes-rendus",
  "Consultations",
  "Dossiers médicaux",
];

const Stats = () => {
  const teams = useAtomValue(teamsState);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [personFilter, setPersonFilter] = useState(null);
  const [activeTab, setActiveTab] = useState("Général");
  const [evolutif, setEvolutif] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <>
      <div className="tw-flex tw-w-full tw-items-center tw-mt-8 tw-mb-12">
        <div className="tw-grow tw-text-xl">{`Statistiques`}</div>
      </div>

      <div className="tw-flex tw-flex-row tw-flex-wrap tw-border-b tw-border-zinc-200 tw-mb-6">
        {tabs.map((tab) => (
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

      <div className="tw-flex tw-flex-row tw-items-end tw-gap-4">
        <div className="tw-grow">
          <SelectTeamMultiple
            onChange={(teamsId) => {
              setSelectedTeams(teams.filter((t) => teamsId.includes(t._id)));
            }}
            value={selectedTeams.map((e) => e?._id)}
            colored
            isDisabled={false}
          />
        </div>
        <div>
          <button className="button-classic !tw-ml-0 tw-flex tw-flex-row tw-items-center tw-gap-2">
            <CalendarDaysIcon className="tw-w-4 tw-h-4" />
            Entre le … et le …
          </button>
        </div>
        <div className="tw-text-sm tw-flex tw-items-center">
          <SelectCustom
            options={[
              { label: "Toutes les personnes", value: "modified" },
              { label: "Personnes suivies", value: "followed" },
              { label: "Nouvelles personnes", value: "created" },
            ]}
            value={personFilter}
            onChange={(value) => {
              setPersonFilter(value);
            }}
            name="person-filter"
            inputId="person-filter"
            className="tw-text-sm tw-min-w-64"
            formatOptionLabel={(option) => {
              return <span className="tw-text-sm">{option.label}</span>;
            }}
          />
          <HelpButtonAndModal open={helpOpen} setOpen={setHelpOpen} title="Personnes comptabilisées dans les statistiques" size="3xl">
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

        <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-select-none">
          <div
            onClick={() => setEvolutif(!evolutif)}
            className={[
              "tw-relative tw-inline-flex tw-h-5 tw-w-9 tw-shrink-0 tw-rounded-full tw-transition-colors tw-duration-200 tw-cursor-pointer",
              evolutif ? "tw-bg-main" : "tw-bg-zinc-300",
            ].join(" ")}
          >
            <span
              className={[
                "tw-inline-block tw-h-4 tw-w-4 tw-rounded-full tw-bg-white tw-shadow tw-transform tw-transition-transform tw-duration-200 tw-mt-0.5",
                evolutif ? "tw-translate-x-4 tw-ml-0.5" : "tw-translate-x-0 tw-ml-0.5",
              ].join(" ")}
            />
          </div>
          <span className="tw-text-sm tw-text-zinc-700">Affichage évolutif</span>
        </label>
      </div>
      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-mt-4">
        {[
          { label: "Situation personnelle", value: "Hébergé" },
          { label: "Genre", value: "Homme" },
          /* { label: "Catégorie d'action", value: "Hébergement" }, */
        ].map((filter) => (
          <span
            key={filter.label}
            className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-md tw-bg-main/10 tw-text-main tw-text-sm tw-pl-3 tw-pr-1.5 tw-py-1"
          >
            <span className="tw-text-main/60">{filter.label} :</span>
            <span className="tw-font-medium">{filter.value}</span>
            <button className="tw-ml-0.5 tw-rounded hover:tw-bg-main/20 tw-p-0.5 tw-cursor-pointer tw-transition-colors">
              <XMarkIcon className="tw-w-3.5 tw-h-3.5" />
            </button>
          </span>
        ))}
        <button className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-md tw-border tw-border-dashed tw-border-zinc-300 tw-text-zinc-500 tw-text-sm tw-px-3 tw-py-1 hover:tw-border-zinc-400 hover:tw-text-zinc-700 tw-cursor-pointer tw-transition-colors">
          <PlusIcon className="tw-w-3.5 tw-h-3.5" />
          Ajouter un filtre
        </button>
      </div>
      <div className="tw-flex tw-flex-col tw-gap-4 tw-mt-8">
        <h1 className="tw-text-xl">Général</h1>
        <div className="tw-grid tw-grid-cols-3 tw-gap-4 tw-w-full">
          <Card title="Nombre de personnes " unit={undefined} count={497} help={`blabla`} />
          <Card title="Temps de suivi moyen" unit={"mois"} count={10} help={`blabla`} />
          <Card title="Temps d'errance moyen" unit={"ans"} count={45} help={`blabla`} />
        </div>
      </div>
    </>
  );
};

const Card = ({ title, count, unit, children, countId, dataTestId, help, onClick = null }) => {
  dataTestId = dataTestId || title.toLocaleLowerCase().split(" ").join("-");

  const Component = onClick ? "button" : "div";
  const props = onClick ? { onClick, type: "button", name: "card", className: "button-cancel" } : {};
  return (
    <>
      <div className="tw-relative tw-flex tw-h-full tw-w-full tw-flex-col tw-items-start tw-justify-start tw-rounded-2xl tw-border tw-border-main25 tw-bg-white tw-font-bold print:tw-break-inside-avoid">
        {!!title && (
          <div className="tw-w-full tw-flex tw-bg-[#707597] tw-px-3 tw-py-1.5 tw-text-base tw-font-medium tw-items-center tw-col-span-7 print:tw-col-span-1 tw-text-white print:tw-text-black print:tw-bg-white tw-rounded-t-2xl">
            <div className="tw-flex-1">{title}</div>
            <div className="tw-flex-none -tw-mt-1">{!!help && <HelpButtonAndModal questionMarkColor="violet" title={title} help={help} />}</div>
          </div>
        )}
        <div className="tw-p-4 tw-w-full tw-flex tw-flex-col tw-items-center tw-justify-end tw-grow">
          <Component {...props} className={["tw-grow tw-flex tw-items-end tw-text-5xl tw-text-main tw-my-2"].join(" ")}>
            <div className="tw-flex tw-items-end">
              <span data-test-id={`${dataTestId}-${count}`} id={countId}>
                {count}
              </span>
              {!!unit && <span className="tw-ml-2.5 tw-mb-1 tw-text-base">{unit}</span>}
            </div>
          </Component>
          {children}
        </div>
      </div>
    </>
  );
};

export default Stats;
