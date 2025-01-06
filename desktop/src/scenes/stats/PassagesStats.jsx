import { useMemo, useState } from "react";
import { CustomResponsivePie } from "./Charts";
import { getPieData } from "./utils";
import { AgeRangeBar } from "./PersonsStats";
import Filters from "../../components/Filters";
import { SelectedPersonsModal } from "./PersonsStats";
import { useRecoilValue } from "recoil";
import { userState } from "../../recoil/auth";

const PassagesStats = ({
  passages,
  personFields,
  personsWithPassages,
  personsInPassagesBeforePeriod,
  filterBase,
  filterPersons,
  setFilterPersons,
}) => {
  const [isPersonsModalOpened, setIsPersonsModalOpened] = useState(false);
  const [isOnlyNewPersons, setIsOnlyNewPersons] = useState(false);
  const [genderSlice, setGenderSlice] = useState(null);
  const user = useRecoilValue(userState);
  const filterTitle = useMemo(() => {
    if (!filterPersons.length) return `Filtrer par personnes suivies :`;
    if (personsWithPassages.length === 1)
      return `Filtrer par personnes suivies (${personsWithPassages.length} personne concernée par le filtre actuel) :`;
    return `Filtrer par personnes suivies (${personsWithPassages.length} personnes concernées par le filtre actuel) :`;
  }, [filterPersons, personsWithPassages]);

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

export default PassagesStats;
