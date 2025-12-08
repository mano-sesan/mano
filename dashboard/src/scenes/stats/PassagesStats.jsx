import { useMemo, useState } from "react";
import { CustomResponsiveBar, CustomResponsivePie } from "./Charts";
import { getMultichoiceBarData, getPieData } from "./utils";
import { AgeRangeBar, SelectedPersonsModal } from "./PersonsStats";
import Filters from "../../components/Filters";
import { useAtomValue } from "jotai";
import { userState } from "../../recoil/auth";
import { groupByPeriod } from "../../utils/group-by-period";

const PassagesStats = ({
  passages,
  personFields,
  personsWithPassages,
  personsUpdated,
  personsInPassagesBeforePeriod,
  filterBase,
  filterPersons,
  setFilterPersons,
}) => {
  const [isPersonsModalOpened, setIsPersonsModalOpened] = useState(false);
  const [isOnlyNewPersons, setIsOnlyNewPersons] = useState(false);
  const [genderSlice, setGenderSlice] = useState(null);
  const user = useAtomValue(userState);
  const filterTitle = useMemo(() => {
    if (!filterPersons.length) return `Filtrer par personnes suivies :`;
    if (personsUpdated.length === 1) return `Filtrer par personnes suivies (${personsUpdated.length} personne concernée par le filtre actuel) :`;
    return `Filtrer par personnes suivies (${personsUpdated.length} personnes concernées par le filtre actuel) :`;
  }, [filterPersons, personsUpdated]);

  const filteredPersonsBySlice = useMemo(() => {
    if (genderSlice) {
      const withCatSlice = {};
      for (const person of personsWithPassages) {
        if (genderSlice === "Non renseigné" && !person.gender) {
          withCatSlice[person._id] = person;
        }
        if (person.gender === genderSlice) {
          withCatSlice[person._id] = person;
        }
      }
      return Object.values(withCatSlice);
    }
    return [];
  }, [genderSlice, personsWithPassages]);

  return (
    <>
      <h3 className="tw-my-5 tw-text-xl">Statistiques des passages</h3>
      <div className="tw-flex tw-basis-full tw-items-center">
        <Filters title={filterTitle} base={filterBase} filters={filterPersons} onChange={setFilterPersons} />
      </div>
      <div className="tw-flex tw-flex-col tw-gap-4">
        <CustomResponsivePie
          title="Nombre de passages"
          data={getPieData(passages, "type", { options: ["Anonyme", "Non-anonyme"] })}
          help={`Nombre de passages enregistrés dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des passages.`}
        />
        <CustomResponsivePie
          title="Répartition des passages non-anonymes"
          help={`Répartition par genre des passages non-anonymes (c'est-à-dire attachés à une personne) enregistrés dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des passages.`}
          data={getPieData(
            passages.filter((p) => !!p.gender),
            "gender",
            { options: [...personFields.find((f) => f.name === "gender").options, "Non précisé"] }
          )}
        />
        <CustomResponsivePie
          title="Nombre de personnes différentes passées (passages anonymes exclus)"
          help={`Répartition par genre des passages non-anonymes (c'est-à-dire attachés à une personne) et uniques enregistrés dans la période définie.\n\nEn d'autres termes, si une personne est passée plusieurs fois, elle n'est comptabilisée ici qu'une seule fois.\n\nSi aucune période n'est définie, on considère l'ensemble des passages.`}
          data={getPieData(personsWithPassages, "gender", {
            options: [...personFields.find((f) => f.name === "gender").options, "Non précisé"],
          })}
          onItemClick={
            user.role === "stats-only"
              ? undefined
              : (id) => {
                  setIsPersonsModalOpened(true);
                  setIsOnlyNewPersons(false);
                  setGenderSlice(id);
                }
          }
        />
        <CustomResponsivePie
          title="Nombre de nouvelles personnes passées (passages anonymes exclus)"
          help={`Répartition par genre des passages concernant des personnes créées pendant la période définie, enregistrés dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des passages.`}
          data={getPieData(
            personsWithPassages.filter((person) => !personsInPassagesBeforePeriod[person._id]),
            "gender",
            { options: [...personFields.find((f) => f.name === "gender").options, "Non précisé"] }
          )}
          onItemClick={
            user.role === "stats-only"
              ? undefined
              : (id) => {
                  setIsPersonsModalOpened(true);
                  setIsOnlyNewPersons(true);
                  setGenderSlice(id);
                }
          }
        />
        <AgeRangeBar persons={personsWithPassages} />
        <PassagesBar passages={passages} />
      </div>
      <SelectedPersonsModal
        open={isPersonsModalOpened}
        onClose={() => {
          setIsPersonsModalOpened(false);
        }}
        persons={isOnlyNewPersons ? filteredPersonsBySlice.filter((person) => !personsInPassagesBeforePeriod[person._id]) : filteredPersonsBySlice}
        title={`Passages`}
      />
    </>
  );
};

function PassagesBar({ passages }) {
  // TODO: possibilité de sélectionner une période

  const { data, options } = useMemo(() => {
    const { data, options } = groupByPeriod(passages, "month", "date", "groupedByMonth");
    return { data, options };
  }, [passages]);

  // Count unique persons across all the grouped data
  const uniquePersonsCount = useMemo(() => {
    const uniquePersonIds = new Set();
    data.forEach((passage) => {
      // Only count passages that have a person (exclude anonymous passages)
      if (passage.person) {
        uniquePersonIds.add(passage.person);
      }
    });
    return uniquePersonIds.size;
  }, [data]);

  return (
    <CustomResponsiveBar
      title="Répartition des passages par mois"
      forcedXAxis={options}
      help={`Répartition par mois des passages enregistrés dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des passages.`}
      axisTitleY="Nombre de passage"
      axisTitleX="Mois"
      isMultiChoice
      totalForMultiChoice={uniquePersonsCount}
      totalTitleForMultiChoice={<span className="tw-font-bold">Nombre de personnes concernées</span>}
      data={getMultichoiceBarData(data, "groupedByMonth", { options, showEmptyBars: true }).filter((d) => d.name !== "Non renseigné")}
    />
  );
}

export default PassagesStats;
