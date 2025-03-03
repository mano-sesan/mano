import type { PieData, BarData } from "./Charts";

export const getDuration = (timestampFromNow: number) => {
  const inDays = Math.round(timestampFromNow / 1000 / 60 / 60 / 24);
  if (inDays < 90) return [inDays, "jours"];
  const inMonths = inDays / (365 / 12);
  if (inMonths < 24) return [Math.round(inMonths), "mois"];
  const inYears = inDays / 365.25;
  return [Math.round(inYears), "années"];
};

export function getPieData(
  source: Array<any>,
  key: string,
  {
    options = null,
    isBoolean = false,
  }: {
    options?: Array<string>;
    isBoolean?: boolean;
  } = {}
): PieData {
  const data = source.reduce(
    (newData, item) => {
      if (isBoolean) {
        newData[item[key] ? "Oui" : "Non"]++;
        return newData;
      }
      if (!item[key] || !item[key].length || item[key].includes("Choisissez") || item[key].includes("Choisir")) {
        newData["Non renseigné"]++;
        return newData;
      }
      if (options && options.length) {
        let hasMatched = false;
        for (const option of [...options, "Uniquement"]) {
          if (typeof item[key] === "string" ? item[key] === option : item[key].includes(option)) {
            if (!newData[option]) newData[option] = 0;
            newData[option]++;
            hasMatched = true;
          }
        }
        if (!hasMatched) {
          if (typeof item[key] === "string") {
            const unregisteredOption = item[key];
            if (!newData[unregisteredOption]) newData[unregisteredOption] = 0;
            newData[unregisteredOption]++;
          }
        }
        return newData;
      }
      if (!newData[item[key]]) newData[item[key]] = 0;
      newData[item[key]]++;
      return newData;
    },
    { "Non renseigné": 0, Oui: 0, Non: 0 }
  );

  return Object.keys(data)
    .map((key) => ({ id: key, label: key, value: data[key] }))
    .filter((d) => d.value > 0);
}

export function getMultichoiceBarData(
  source: Array<any>,
  key: string,
  {
    options = [],
    showEmptyBars = false,
  }: {
    options?: Array<string>;
    showEmptyBars?: boolean;
  } = {}
): BarData {
  const objOptions = { "Non renseigné": [] };
  for (const option of options) {
    objOptions[option] = [];
  }

  const reducedDataPerOption = source.reduce((newData, item) => {
    if (!item[key] || !item[key].length) {
      newData["Non renseigné"].push(item);
      return newData;
    }
    const choices = typeof item[key] === "string" ? [item[key]] : item[key];

    for (const choice of choices) {
      if (!newData[choice]) newData[choice] = [];
      newData[choice].push(item);
    }
    return newData;
  }, objOptions);

  const barData = Object.keys(reducedDataPerOption)
    .filter((key) => reducedDataPerOption[key]?.length > 0 || showEmptyBars)
    // Je ne touche à rien mais jje n'ai pas compris pourquoi c'est transformé en string ici
    // ça provoque un bug (du coup j'ai repassé en number pour le sort)
    // Introduit ici: https://github.com/mano-sesan/mano/pull/437
    .map((key) => ({ name: key, [key]: String(reducedDataPerOption[key]?.length) }))
    .sort((a, b) => (Number(b[b.name]) > Number(a[a.name]) ? 1 : -1));

  return barData;
}
