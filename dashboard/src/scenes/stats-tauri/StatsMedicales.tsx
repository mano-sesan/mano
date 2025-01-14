import { useEffect, useState } from "react";
import {
  sqlSelectPersonnesByAgeGroup,
  sqlSelectPersonnesByAgeGroupCount,
  sqlSelectPersonnesByGenre,
  sqlSelectPersonnesByGenreCount,
  StatsContext,
  StatsPopulation,
} from "./queries";
import { SelectedPersonsModal } from "../stats/PersonsStats";
import { CustomResponsivePie } from "../stats/Charts";
import { customFieldsPersonsSelector } from "../../recoil/persons";
import { useRecoilValue } from "recoil";
import { CustomFieldBlock } from "./StatsCustomFields";
import { customFieldsMedicalFileSelector, groupedCustomFieldsMedicalFileSelector } from "../../recoil/medicalFiles";

type PersonLoose = {
  [key: string]: string | undefined | null | string[] | number | boolean;
};

type StatsMedicalesProps = {
  context: StatsContext;
  population?: StatsPopulation;
};

export function StatsMedicales({ context, population = "personnes_creees" }: StatsMedicalesProps) {
  const groupedCustomFieldsMedicalFile = useRecoilValue(groupedCustomFieldsMedicalFileSelector);
  const [open, setOpen] = useState(false);
  const [slicedData, setSlicedData] = useState<PersonLoose[]>([]);
  const [sliceTitle, setSliceTitle] = useState<string | null>(null);
  const [sliceValue, setSliceValue] = useState<string | null>(null);

  const openModal = (title: string, value: string, data: PersonLoose[]) => {
    setSliceTitle(title);
    setSliceValue(value);
    setSlicedData(data);
    setOpen(true);
  };

  return (
    <>
      <div className="tw-flex tw-flex-col tw-gap-2">
        <div className="tw-flex tw-flex-col tw-gap-4">
          <ByGenre
            context={context}
            population={population}
            onSliceClick={(value, data) => {
              openModal("Genre", value, data);
            }}
          />
          <ByTrancheDage
            context={context}
            population={population}
            onSliceClick={(value, data) => {
              openModal("Tranche d'age", value, data);
            }}
          />
          {groupedCustomFieldsMedicalFile.map((section) => {
            return (
              <>
                <h1>{section.name}</h1>
                <div className="tw-flex tw-flex-wrap tw-justify-center tw-items-stretch tw-gap-4">
                  {section.fields.map((field) => {
                    return (
                      <CustomFieldBlock
                        key={field.name}
                        context={context}
                        population={population}
                        field={field}
                        onSliceClick={(label, value, data) => {
                          openModal(label, value, data);
                        }}
                      />
                    );
                  })}
                </div>
              </>
            );
          })}
        </div>
      </div>
      <SelectedPersonsModal
        open={open}
        onClose={() => {
          setOpen(false);
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
    </>
  );
}

function ByGenre({
  context,
  population,
  onSliceClick,
}: {
  context: StatsContext;
  population: StatsPopulation;
  onSliceClick: (value: string, data: PersonLoose[]) => void;
}) {
  const [data, setData] = useState<{ genre: string; total: string }[]>([]);

  useEffect(() => {
    sqlSelectPersonnesByGenreCount(context, population).then((res) => setData(res));
  }, [context, population]);

  return (
    <CustomResponsivePie
      title="Total par genre"
      onItemClick={(genre) => {
        sqlSelectPersonnesByGenre(context, population, genre).then((res) => {
          onSliceClick(
            genre,
            res.map((r) => ({ ...r, assignedTeams: (r.assignedTeams || "").split(",") }))
          );
        });
      }}
      data={data.map((d) => ({
        label: d.genre || "Non renseigné",
        value: Number(d.total),
        id: d.genre || "Non renseigné",
      }))}
    />
  );
}

function ByTrancheDage({
  context,
  population,
  onSliceClick,
}: {
  context: StatsContext;
  population: StatsPopulation;
  onSliceClick: (value: string, data: PersonLoose[]) => void;
}) {
  const [data, setData] = useState<{ age_group: string; total: string }[]>([]);

  useEffect(() => {
    sqlSelectPersonnesByAgeGroupCount(context, population).then((res) => setData(res));
  }, [context, population]);

  return (
    <CustomResponsivePie
      title="Total par tranche d'age"
      onItemClick={(ageGroup) => {
        sqlSelectPersonnesByAgeGroup(context, population, ageGroup).then((res) => {
          onSliceClick(
            ageGroup,
            res.map((r) => ({ ...r, assignedTeams: (r.assignedTeams || "").split(",") }))
          );
        });
      }}
      data={data.map((d) => ({
        label: d.age_group || "Non renseigné",
        value: Number(d.total),
        id: d.age_group || "Non renseigné",
      }))}
    />
  );
}
