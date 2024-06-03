import { useRecoilValue } from "recoil";
import { evolutiveStatsForPersonsSelector } from "../recoil/evolutiveStats";
import type { PersonPopulated } from "../types/person";
import type { IndicatorsSelection } from "../types/evolutivesStats";
import { ResponsiveStream } from "@nivo/stream";
import { useMemo, useState } from "react";
import { capture } from "../services/sentry";
import type { Dayjs } from "dayjs";
import type { FilterableField } from "../types/field";
import type { EvolutiveStatOption } from "../types/evolutivesStats";
import { SelectedPersonsModal } from "../scenes/stats/PersonsStats";
import { itemsGroupedByPersonSelector } from "../recoil/selectors";

interface EvolutiveStatsViewerProps {
  evolutiveStatsIndicators: IndicatorsSelection;
  period: {
    startDate: string;
    endDate: string;
  };
  persons: Array<PersonPopulated>;
  filterBase: Array<FilterableField>;
}

export default function EvolutiveStatsViewer({ evolutiveStatsIndicators, period, persons, filterBase }: EvolutiveStatsViewerProps) {
  try {
    const [personsModalOpened, setPersonsModalOpened] = useState(false);
    const [sliceDate, setSliceDate] = useState(null);
    const [sliceField, setSliceField] = useState(null);
    const [sliceValue, setSliceValue] = useState(null);
    const [slicedData, setSlicedData] = useState([]);

    const evolutiveStatsPerson = useRecoilValue(
      evolutiveStatsForPersonsSelector({
        persons,
        startDate: period.startDate,
        endDate: period.endDate,
        evolutiveStatsIndicators,
      })
    );
    if (!evolutiveStatsPerson) return null;

    const {
      startDateConsolidated,
      endDateConsolidated,
      valueStart,
      valueEnd,
      countSwitched,
      countPersonSwitched,
      percentSwitched,
      indicatorFieldLabel,
      initPersonsIds,
      personsIdsSwitched,
    } = evolutiveStatsPerson;

    const personsObject = useRecoilValue(itemsGroupedByPersonSelector);

    // TODO: dans un second temps, on pourra afficher un tableau avec les stats par valeur
    if (valueStart == null) return null;
    if (valueEnd == null) return null;

    return (
      <>
        <div className="tw-flex tw-w-full tw-justify-around tw-flex-col tw-items-center tw-gap-y-4">
          <h5>
            Entre le {startDateConsolidated.format("DD/MM/YYYY")} et le {endDateConsolidated.format("DD/MM/YYYY")}
          </h5>

          <div className="tw-flex tw-items-baseline tw-gap-x-2">
            <p className="tw-text-2xl tw-font-bold tw-text-main">{initPersonsIds.length}</p>
            <p>
              personnes ont eu un statut de <strong>{indicatorFieldLabel}</strong>: <strong>{valueStart}</strong>
            </p>
          </div>

          <div className="tw-flex tw-shrink-0 tw-items-center tw-justify-evenly tw-gap-y-4 tw-w-full">
            <button
              className="tw-flex tw-flex-col tw-items-center tw-justify-around tw-rounded-lg tw-border tw-p-4"
              type="button"
              onClick={() => {
                setPersonsModalOpened(true);
              }}
            >
              <div className="tw-flex tw-items-baseline tw-gap-x-2">
                <p className="tw-text-6xl tw-font-bold tw-text-main">{countSwitched}</p>
                <p>changements</p>
              </div>
              <p className="tw-text-center">
                de <strong>{indicatorFieldLabel}</strong> de <strong>{valueStart} </strong> vers <strong>{valueEnd}</strong>
                <br />
                ont été effectués
              </p>
            </button>
          </div>
          <div className="tw-flex tw-items-baseline tw-gap-x-2">
            <p className="tw-text-center">
              impactant <strong>{countPersonSwitched}</strong> personnes, ce qui représente <strong>{percentSwitched}%</strong> des personnes qui
              avaient{" "}
              <em>
                {indicatorFieldLabel}: {valueStart}
              </em>
            </p>
          </div>
        </div>

        <SelectedPersonsModal
          open={personsModalOpened}
          onClose={() => {
            setPersonsModalOpened(false);
          }}
          persons={personsIdsSwitched.map((id) => personsObject[id])}
          sliceField={filterBase.find((f) => f.name === evolutiveStatsIndicators[0].fieldName)}
          onAfterLeave={() => {}}
          title={
            <p className="tw-basis-1/2">
              Personnes dont le champ {indicatorFieldLabel} est passé de {valueStart} à {valueEnd} entre le{" "}
              {startDateConsolidated.format("DD/MM/YYYY")} et le {endDateConsolidated.format("DD/MM/YYYY")}
              <br />
              <br />
              <small className="tw-text-gray-500 tw-block tw-text-xs">
                Attention: cette liste affiche les personnes <strong>telles qu'elles sont aujourd'hui</strong>, et non pas telles qu'elles sont au{" "}
                {sliceDate}.
                <br /> Pour en savoir plus sur l'évolution de chaque personne, cliquez dessus et consultez son historique.
              </small>
            </p>
          }
        />
      </>
    );
  } catch (error) {
    capture(error, {
      extra: {
        evolutiveStatsIndicators,
        period,
      },
    });
  }
  return (
    <div>
      <h4>Erreur</h4>
      <p>Une erreur est survenue lors de l'affichage des statistiques évolutives. Les équipes techniques ont été prévenues</p>
    </div>
  );
}

function EvolutiveStatsTable({
  personsAtStartByValue,
  personsAtEndByValue,
  chartData,
  startDateConsolidated,
  endDateConsolidated,
  field,
}: {
  personsAtStartByValue: Record<EvolutiveStatOption, Array<PersonPopulated>>;
  personsAtEndByValue: Record<EvolutiveStatOption, Array<PersonPopulated>>;
  chartData: {
    data: Array<Record<string, number>>;
    keys: Array<string>;
    legend: any;
  };
  startDateConsolidated: Dayjs;
  endDateConsolidated: Dayjs;
  field: FilterableField;
}) {
  const [personsModalOpened, setPersonsModalOpened] = useState(false);
  const [sliceDate, setSliceDate] = useState(null);
  const [sliceField, setSliceField] = useState(null);
  const [sliceValue, setSliceValue] = useState(null);
  const [slicedData, setSlicedData] = useState([]);

  const onLineClick = (date: string, option: string, personsByValue: Record<EvolutiveStatOption, Array<PersonPopulated>>) => {
    setSliceDate(date);
    setSliceField(field);
    setSliceValue(option);
    const slicedData = personsByValue[option];
    setSlicedData(slicedData);
    setPersonsModalOpened(true);
  };

  console.log({
    personsModalOpened,
    sliceDate,
    sliceField,
    sliceValue,
    slicedData,
  });

  return (
    <>
      <SelectedPersonsModal
        open={personsModalOpened}
        onClose={() => {
          setPersonsModalOpened(false);
        }}
        persons={slicedData}
        sliceField={sliceField}
        onAfterLeave={() => {
          setSliceDate(null);
          setSliceField(null);
          setSliceValue(null);
          setSlicedData([]);
        }}
        title={
          <p className="tw-basis-1/2">
            {`${sliceField?.label} au ${sliceDate}: ${sliceValue} (${slicedData.length})`}
            <br />
            <br />
            <small className="tw-text-gray-500 tw-block tw-text-xs">
              Attention: cette liste affiche les personnes <strong>telles qu'elles sont aujourd'hui</strong>, et non pas telles qu'elles sont au{" "}
              {sliceDate}.
              <br /> Pour en savoir plus sur l'évolution de chaque personne, cliquez dessus et consultez son historique.
            </small>
          </p>
        }
      />
    </>
  );
}
