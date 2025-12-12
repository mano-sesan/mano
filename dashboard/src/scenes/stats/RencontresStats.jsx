import { useMemo, useState } from "react";
import { CustomResponsivePie } from "./Charts";
import { getPieData } from "./utils";
import Filters from "../../components/Filters";
import { Block } from "./Blocks";
import { SelectedPersonsModal } from "./PersonsStats";
import { userState } from "../../atoms/auth";
import { useAtomValue } from "jotai";
import SelectCustom from "../../components/SelectCustom";

const NO_TERRITORY_KEY = "__NO_TERRITORY__";

const TEXT_PERIODE =
  "\n\nSi aucune période n'est définie, on considère l'ensemble des rencontres. De la même manière, si aucun territoire n'est sélectionné, on considère l'ensemble des territoires, ainsi que les rencontres en dehors des territoires.";

const RencontresStats = ({
  rencontres,
  territories,
  personFields,
  personsUpdated,
  personsInRencontresBeforePeriod,
  // filter by persons
  filterBase,
  filterPersons,
  setFilterPersons,
  selectedTerritories,
  setSelectedTerritories,
  isTerritoriesEnabled,
}) => {
  const [isPersonsModalOpened, setIsPersonsModalOpened] = useState(false);
  const [isOnlyNewPersons, setIsOnlyNewPersons] = useState(false);
  const [genderSlice, setGenderSlice] = useState(null);
  const [territoriesSlice, setTerritoriesSlice] = useState(null);
  // const [selectedTerritories, setSelectedTerritories] = useState([]);
  const user = useAtomValue(userState);
  const filterTitle = useMemo(() => {
    if (!filterPersons.length) return `Filtrer par personnes suivies :`;
    if (personsUpdated.length === 1) return `Filtrer par personnes suivies (${personsUpdated.length} personne concernée par le filtre actuel) :`;
    return `Filtrer par personnes suivies (${personsUpdated.length} personnes concernées par le filtre actuel) :`;
  }, [filterPersons, personsUpdated.length]);

  const personObject = useMemo(() => {
    const personObject = {};
    for (const p of personsUpdated) {
      personObject[p._id] = p;
    }
    return personObject;
  }, [personsUpdated]);

  const { filteredRencontresByTerritories, filteredPersons, filteredRencontresByTerritoriesUniquePersons } = useMemo(() => {
    const rencontresGroupedByTerritories = {};
    const filteredPersonsObject = {};
    const isFilteredByTerritories = selectedTerritories.length;
    const territoriesObject = selectedTerritories.reduce((acc, t) => {
      acc[t.value] = true;
      return acc;
    }, {});

    // Group rencontres by territories
    for (const r of rencontres) {
      const territoryKey = r.territoryObject?.name || NO_TERRITORY_KEY;
      if (isFilteredByTerritories && !territoriesObject[territoryKey]) continue;
      if (!personObject[r.person]) continue;

      if (!filteredPersonsObject[r.person]) {
        filteredPersonsObject[r.person] = { ...personObject[r.person], territories: [] };
      }
      filteredPersonsObject[r.person].territories.push(territoryKey);

      if (!rencontresGroupedByTerritories[territoryKey]) rencontresGroupedByTerritories[territoryKey] = [];
      rencontresGroupedByTerritories[territoryKey].push({
        gender: r.gender,
        territoryName: r.territoryObject?.name,
        person: r.person,
      });
    }

    // Group rencontres by unique persons
    const rencontresGroupedByTerritoriesUniquePersonsObject = {};
    for (const [territoryKey, rencontres] of Object.entries(rencontresGroupedByTerritories)) {
      rencontresGroupedByTerritoriesUniquePersonsObject[territoryKey] = rencontres.filter(
        (r, index, self) => index === self.findIndex((t) => t.person === r.person)
      );
    }

    // Flatten rencontres and persons
    const filteredRencontresByTerritories = Object.values(rencontresGroupedByTerritories).flat();
    const filteredPersons = Object.values(filteredPersonsObject);
    const filteredRencontresByTerritoriesUniquePersons = Object.values(rencontresGroupedByTerritoriesUniquePersonsObject).flat();
    return { filteredRencontresByTerritories, filteredPersons, filteredRencontresByTerritoriesUniquePersons };
  }, [rencontres, selectedTerritories, personObject]);

  const filteredPersonsBySlice = useMemo(() => {
    if (genderSlice) {
      const withCatSlice = {};
      for (const person of filteredPersons) {
        if (genderSlice === "Non renseigné" && !person.gender) {
          withCatSlice[person._id] = person;
        }
        if (person.gender === genderSlice) {
          withCatSlice[person._id] = person;
        }
      }
      return Object.values(withCatSlice);
    }
    if (territoriesSlice) {
      const withTerritoriesSlice = {};
      for (const person of filteredPersons) {
        if (territoriesSlice === "Non renseigné" && person.territories.includes(NO_TERRITORY_KEY)) {
          withTerritoriesSlice[person._id] = person;
        }
        if (person.territories.includes(territoriesSlice)) {
          withTerritoriesSlice[person._id] = person;
        }
      }
      return Object.values(withTerritoriesSlice);
    }
    return [];
  }, [genderSlice, filteredPersons, territoriesSlice]);

  const territoriesForFilter = useMemo(() => {
    return territories.map((t) => ({ value: t.name, label: t.name }));
  }, [territories]);

  return (
    <>
      <h3 className="tw-my-5 tw-text-xl">Statistiques des rencontres</h3>
      <div className="tw-flex tw-basis-full tw-items-center">
        <Filters title={filterTitle} base={filterBase} filters={filterPersons} onChange={setFilterPersons} />
      </div>
      {Boolean(isTerritoriesEnabled) && (
        <div className="tw-grid lg:tw-grid-cols-2 tw-grid-cols-1 tw-gap-2 tw-mb-8">
          <div>
            <label htmlFor="filter-by-status" className="tw-m-0">
              Filtrer par territoire
            </label>
            <div>
              <SelectCustom
                inputId="rencontres-select-territory-filter"
                options={territoriesForFilter}
                name="rencontres-territory"
                onChange={(s) => setSelectedTerritories(s)}
                isClearable
                isMulti
                value={selectedTerritories}
              />
            </div>
          </div>
        </div>
      )}
      <div className="tw-flex tw-flex-col tw-gap-4">
        <div className="tw-grid tw-grid-cols-2 tw-gap-4">
          <Block
            data={filteredRencontresByTerritories.length}
            title="Nombre de rencontres"
            help={`Nombre de rencontres enregistrées dans la période définie, pour les territoires sélectionnés.${TEXT_PERIODE}`}
          />
          <Block
            data={filteredPersons.length}
            title="Nombre de personnes différentes rencontrées"
            help={`Nombre de personnes uniques rencontrées dans la période définie, pour les territoires sélectionnés.${TEXT_PERIODE}`}
          />
        </div>

        <CustomResponsivePie
          title="Répartition des rencontres par genre"
          help={`Répartition par genre des rencontres enregistrées dans la période définie.${TEXT_PERIODE}`}
          data={getPieData(filteredRencontresByTerritories, "gender", {
            options: [...personFields.find((f) => f.name === "gender").options, "Non précisé"],
          })}
          tableHeaderTitles={{
            name: "Genre",
            value: "Nb rencontres",
            percentage: "%",
          }}
        />
        <CustomResponsivePie
          title="Répartition des personnes uniques rencontrées par genre"
          help={`Répartition par genre des personnes uniques rencontrées dans la période définie.\n\nEn d'autres termes, si une personne est rencontrée plusieurs fois, elle n'est comptabilisée ici qu'une seule fois.${TEXT_PERIODE}`}
          data={getPieData(filteredPersons, "gender", {
            options: [...personFields.find((f) => f.name === "gender").options, "Non précisé"],
          })}
          onItemClick={
            user.role === "stats-only"
              ? undefined
              : (id) => {
                  setIsPersonsModalOpened(true);
                  setIsOnlyNewPersons(false);
                  setTerritoriesSlice(null);
                  setGenderSlice(id);
                }
          }
          tableHeaderTitles={{
            name: "Genre",
            value: "Nb personnes",
            percentage: "%",
          }}
        />
        <CustomResponsivePie
          title="Répartition des nouvelles personnes uniques rencontrées par genre"
          help={`Répartition par genre des personnes uniques créées et rencontrées pendant la période définiee.${TEXT_PERIODE}`}
          data={getPieData(
            filteredPersons.filter((person) => !personsInRencontresBeforePeriod[person._id]),
            "gender",
            { options: [...personFields.find((f) => f.name === "gender").options, "Non précisé"] }
          )}
          tableHeaderTitles={{
            name: "Genre",
            value: "Nb nouv. personnes",
            percentage: "%",
          }}
          onItemClick={
            user.role === "stats-only"
              ? undefined
              : (id) => {
                  setIsPersonsModalOpened(true);
                  setIsOnlyNewPersons(true);
                  setTerritoriesSlice(null);
                  setGenderSlice(id);
                }
          }
        />
        {Boolean(isTerritoriesEnabled) && (
          <>
            <CustomResponsivePie
              title="Répartition des rencontres par territoire"
              help={`Répartition par territoire du nombre de rencontres lors de la saisie d'une observation dans la période définie. Chaque rencontre est comptabilisée, même si plusieurs rencontres avec une même personne ont eu lieu sur un même territoire.${TEXT_PERIODE}`}
              data={getPieData(filteredRencontresByTerritories, "territoryName", {
                options: [...territoriesForFilter],
              })}
              tableHeaderTitles={{
                name: "Territoire",
                value: "Nb rencontres",
                percentage: "%",
              }}
            />
            <CustomResponsivePie
              title="Répartition des personnes rencontrées par territoire"
              help={`Répartition par territoire du nombre de personnes suivies ayant été rencontrées lors de la saisie d'une observation dans la période définie. Si une personne est rencontrée plusieurs fois sur un même territoire, elle n'est comptabilisée qu'une seule fois. Si elle est rencontrée sur deux territoires différents, elle sera comptée indépendamment sur chaque territoire.${TEXT_PERIODE}`}
              data={getPieData(filteredRencontresByTerritoriesUniquePersons, "territoryName", {
                options: [...territoriesForFilter],
              })}
              onItemClick={
                user.role === "stats-only"
                  ? undefined
                  : (id) => {
                      setIsPersonsModalOpened(true);
                      setIsOnlyNewPersons(false);
                      setGenderSlice(null);
                      setTerritoriesSlice(id);
                    }
              }
              tableHeaderTitles={{
                name: "Territoire",
                value: "Nb personnes",
                percentage: "%",
              }}
            />
          </>
        )}
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
