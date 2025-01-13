import { useEffect, useState } from "react";
import {
  dayCountToHumanReadable,
  sqlSelectPersonnesByAgeGroup,
  sqlSelectPersonnesByAgeGroupCount,
  sqlSelectPersonnesByGenre,
  sqlSelectPersonnesByGenreCount,
  sqlSelectPersonnesCreesCount,
  sqlSelectPersonnesEnRueDepuisLe,
  sqlSelectPersonnesSuiviesCount,
  sqlSelectPersonnesSuiviesDepuisLeByGroup,
  sqlSelectPersonnesSuiviesDepuisLeByGroupCount,
  sqlSelectPersonnesSuiviesDepuisLeMoyenne,
  StatsContext,
  StatsPopulation,
} from "./queries";
import { Block } from "../stats/Blocks";
import { SelectedPersonsModal } from "../stats/PersonsStats";
import { CustomResponsiveBar, CustomResponsivePie } from "../stats/Charts";

type PersonLoose = {
  [key: string]: string | undefined | null | string[] | number | boolean;
};

type StatsPersonnesProps = {
  context: StatsContext;
  population?: StatsPopulation;
};

export function StatsPersonnes({ context, population = "personnes_creees" }: StatsPersonnesProps) {
  const [open, setOpen] = useState(false);
  const [slicedData, setSlicedData] = useState<PersonLoose[]>([]);
  const [sliceTitle, setSliceTitle] = useState<string | null>(null);
  const [sliceValue, setSliceValue] = useState<string | null>(null);
  return (
    <>
      <div className="tw-flex tw-flex-col tw-gap-2">
        <div className="tw-grid tw-grid-cols-2 xl:tw-grid-cols-3 2xl:tw-grid-cols-4 tw-gap-4 tw-my-8">
          <Total context={context} population={population} />
          <SuiviDepuisLe context={context} population={population} />
          <EnRueDepuisLe context={context} population={population} />
        </div>
        <div>
          <ByGenre
            context={context}
            population={population}
            onSliceClick={(value, data) => {
              setSliceTitle("Genre");
              setSliceValue(value);
              setSlicedData(data);
              setOpen(true);
            }}
          />
          <ByTrancheDage
            context={context}
            population={population}
            onSliceClick={(value, data) => {
              setSliceTitle("Tranche d'age");
              setSliceValue(value);
              setSlicedData(data);
              setOpen(true);
            }}
          />
          <BySuiviDepuisLe
            context={context}
            population={population}
            onSliceClick={(value, data) => {
              setSliceTitle("Suivi depuis le");
              setSliceValue(value);
              setSlicedData(data);
              setOpen(true);
            }}
          />
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

export function Total({ context, population }: { context: StatsContext; population: StatsPopulation }) {
  const [total, setTotal] = useState<string>("-");
  useEffect(() => {
    if (population === "personnes_creees") {
      sqlSelectPersonnesCreesCount(context).then((res) => setTotal(res[0].total));
    } else {
      sqlSelectPersonnesSuiviesCount(context).then((res) => setTotal(res[0].total));
    }
  }, [context, population]);
  return <Block title="Total" data={total} />;
}

function SuiviDepuisLe({ context, population }: { context: StatsContext; population: StatsPopulation }) {
  const [total, setTotal] = useState<string>("-");
  useEffect(() => {
    sqlSelectPersonnesSuiviesDepuisLeMoyenne(context, population).then((res) => setTotal(res[0].avg_follow_duration));
  }, [context, population]);
  return <Block title="Temps de suivi moyen" data={Number(total) ? dayCountToHumanReadable(Number(total)) : "-"} />;
}

function EnRueDepuisLe({ context, population }: { context: StatsContext; population: StatsPopulation }) {
  const [total, setTotal] = useState<string>("-");
  useEffect(() => {
    sqlSelectPersonnesEnRueDepuisLe(context, population).then((res) => setTotal(res[0].avg_en_rue));
  }, [context, population]);
  return <Block title="Temps d'errance" data={Number(total) ? dayCountToHumanReadable(Number(total)) : "-"} />;
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

function BySuiviDepuisLe({
  context,
  population,
  onSliceClick,
}: {
  context: StatsContext;
  population: StatsPopulation;
  onSliceClick: (value: string, data: PersonLoose[]) => void;
}) {
  const [data, setData] = useState<{ total: string; follow_duration: string }[]>([]);

  useEffect(() => {
    sqlSelectPersonnesSuiviesDepuisLeByGroupCount(context, population).then((res) => setData(res));
  }, [context, population]);

  return (
    <CustomResponsiveBar
      title="Total par suivi depuis le"
      data={data.map((d) => ({ name: d.follow_duration, [d.follow_duration]: d.total }))}
      axisTitleY="Nombre de personnes"
      onItemClick={(followDuration) => {
        sqlSelectPersonnesSuiviesDepuisLeByGroup(context, population, followDuration).then((res) => {
          onSliceClick(followDuration, res);
        });
      }}
    />
  );
}
