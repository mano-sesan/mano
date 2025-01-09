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
import ChartPie from "./components/ChartPie";
import ChartBar from "./components/ChartBar";
import { Block } from "../stats/Blocks";
import { SelectedPersonsModal } from "../stats/PersonsStats";

type StatsPersonnesProps = {
  context: StatsContext;
  population?: StatsPopulation;
};

export function StatsPersonnes({ context, population = "personnes_creees" }: StatsPersonnesProps) {
  const [open, setOpen] = useState(false);
  const [slicedData, setSlicedData] = useState<{ id: string; name: string }[]>([]);
  const [sliceTitle, setSliceTitle] = useState<string | null>(null);
  const [sliceValue, setSliceValue] = useState<string | null>(null);
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex gap-4">
          <Total context={context} population={population} />
          <SuiviDepuisLe context={context} population={population} />
          <EnRueDepuisLe context={context} population={population} />
        </div>
        <div className="grid grid-cols-2 gap-2">
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
          <ByTrancheDage context={context} population={population} />
          <BySuiviDepuisLe context={context} population={population} />
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
        title={`${sliceTitle}&nbsp;: ${sliceValue} (${slicedData.length})`}
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
  onSliceClick: (value: string, data: { id: string; name: string }[]) => void;
}) {
  const [data, setData] = useState<{ genre: string; total: string }[]>([]);

  useEffect(() => {
    sqlSelectPersonnesByGenreCount(context, population).then((res) => setData(res));
  }, [context, population]);

  return (
    <>
      <div className="border p-2">
        <div className="text-sm font-bold">Total par genre</div>
        <div className="h-80">
          <ChartPie
            data={data.map((d) => ({
              label: d.genre || "Non renseigné",
              value: Number(d.total),
              id: d.genre || "Non renseigné",
            }))}
          />
        </div>
        {data.map((d) => (
          <div
            key={d.genre}
            onClick={() => {
              sqlSelectPersonnesByGenre(context, population, d.genre).then((res) => onSliceClick(d.genre, res));
            }}
          >
            {d.genre || "Non renseigné"}: {d.total}
          </div>
        ))}
      </div>
    </>
  );
}

function ByTrancheDage({ context, population }: { context: StatsContext; population: StatsPopulation }) {
  const [data, setData] = useState<{ count: string; age_group: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string | null>(null);
  const [selectedAgeGroupData, setSelectedAgeGroupData] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    sqlSelectPersonnesByAgeGroupCount(context, population).then((res) => setData(res));
  }, [context, population]);

  useEffect(() => {
    if (selectedAgeGroup) {
      sqlSelectPersonnesByAgeGroup(context, population, selectedAgeGroup).then((res) => setSelectedAgeGroupData(res));
    }
  }, [selectedAgeGroup, context, population]);

  return (
    <>
      <div className="border p-2">
        <div className="text-sm font-bold">Tranches d'age</div>
        <div className="h-80">
          <ChartPie data={data.map((d) => ({ label: d.age_group || "Non renseigné", value: Number(d.count), id: d.age_group }))} />
        </div>
        {data.map((d) => (
          <div
            key={d.age_group}
            onClick={() => {
              setSelectedAgeGroup(d.age_group);
              setOpen(true);
            }}
          >
            {d.age_group || "non renseigné"}: {d.count}
          </div>
        ))}
      </div>
      {/* <ModalPersons open={open} setOpen={setOpen} persons={selectedAgeGroupData} title={selectedAgeGroup || "Age"} /> */}
    </>
  );
}

function BySuiviDepuisLe({ context, population }: { context: StatsContext; population: StatsPopulation }) {
  const [data, setData] = useState<{ total: string; follow_duration: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedFollowDuration, setSelectedFollowDuration] = useState<string | null>(null);
  const [selectedFollowDurationData, setSelectedFollowDurationData] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    sqlSelectPersonnesSuiviesDepuisLeByGroupCount(context, population).then((res) => setData(res));
  }, [context, population]);

  useEffect(() => {
    if (selectedFollowDuration) {
      sqlSelectPersonnesSuiviesDepuisLeByGroup(context, population, selectedFollowDuration).then((res) => setSelectedFollowDurationData(res));
    }
  }, [selectedFollowDuration, context, population]);

  return (
    <>
      <div className="border p-2">
        <div className="text-sm font-bold">Suivi depuis le</div>
        <div className="h-80">
          <ChartBar data={data.map((d) => ({ label: d.follow_duration, value: Number(d.total), id: d.follow_duration }))} />
        </div>
        {data.map((d) => (
          <div
            key={d.follow_duration}
            onClick={() => {
              setSelectedFollowDuration(d.follow_duration);
              setOpen(true);
            }}
          >
            {d.follow_duration}: {d.total}
          </div>
        ))}
      </div>
      {/* <ModalPersons
        open={open}
        setOpen={setOpen}
        persons={selectedFollowDurationData}
        title={selectedFollowDuration || "Suivi depuis le"}
      /> */}
    </>
  );
}
