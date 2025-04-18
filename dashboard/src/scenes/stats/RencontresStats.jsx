import { useMemo, useState } from "react";
import { CustomResponsivePie } from "./Charts";
import { getPieData } from "./utils";
import Filters from "../../components/Filters";
import { Block } from "./Blocks";
import { SelectedPersonsModal } from "./PersonsStats";
import { userState } from "../../recoil/auth";
import { useRecoilValue } from "recoil";

const RencontresStats = ({
  rencontres,
  personFields,
  personsWithRencontres,
  personsUpdated,
  personsInRencontresBeforePeriod,
  // filter by persons
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
    if (personsUpdated.length === 1) return `Filtrer par personnes suivies (${personsUpdated.length} personne concernée par le filtre actuel) :`;
    return `Filtrer par personnes suivies (${personsUpdated.length} personnes concernées par le filtre actuel) :`;
  }, [filterPersons, personsUpdated.length]);

  const filteredPersonsBySlice = useMemo(() => {
    if (genderSlice) {
      const withCatSlice = {};
      for (const person of personsWithRencontres) {
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
  }, [genderSlice, personsWithRencontres]);

  return (
    <>
      <h3 className="tw-my-5 tw-text-xl">Statistiques des rencontres</h3>
      <div className="tw-flex tw-basis-full tw-items-center">
        <Filters title={filterTitle} base={filterBase} filters={filterPersons} onChange={setFilterPersons} />
      </div>
      <div className="tw-flex tw-flex-col tw-gap-4">
        <Block
          data={rencontres.length}
          title="Nombre de rencontres"
          help={`Nombre de rencontres enregistrées dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des rencontres.`}
        />

        <CustomResponsivePie
          title="Répartition des rencontres"
          help={`Répartition par genre des rencontres non-anonymes (c'est-à-dire attachées à une personne) enregistrées dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des rencontres.`}
          data={getPieData(rencontres, "gender", { options: [...personFields.find((f) => f.name === "gender").options, "Non précisé"] })}
        />
        <CustomResponsivePie
          title="Nombre de personnes différentes rencontrées"
          help={`Répartition par genre des rencontres non-anonymes (c'est-à-dire attachées à une personne) et uniques enregistrées dans la période définie.\n\nEn d'autres termes, si une personne est rencontrée plusieurs fois, elle n'est comptabilisée ici qu'une seule fois.\n\nSi aucune période n'est définie, on considère l'ensemble des rencontres.`}
          data={getPieData(personsWithRencontres, "gender", {
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
          title="Nombre de nouvelles personnes rencontrées"
          help={`Répartition par genre des rencontres concernant des personnes créées pendant la période définie, enregistrées dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des rencontres.`}
          data={getPieData(
            personsWithRencontres.filter((person) => !personsInRencontresBeforePeriod[person._id]),
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
      </div>
      <SelectedPersonsModal
        open={isPersonsModalOpened}
        onClose={() => {
          setIsPersonsModalOpened(false);
        }}
        persons={isOnlyNewPersons ? filteredPersonsBySlice.filter((person) => !personsInRencontresBeforePeriod[person._id]) : filteredPersonsBySlice}
        title={`Personnes rencontrées`}
      />
    </>
  );
};

export default RencontresStats;
