import { StylesConfig, Theme } from "react-select";
import { theme } from "../config";
import AsyncSelect from "react-select/async";

type GeoApiResponse = {
  codeDepartement: string;
  centre: {
    type: string;
    coordinates: [number, number];
  };
  region: {
    code: number;
    nom: string;
  };
  nom: string;
  code: string;
  _score: number;
};

type CitySelectValue = {
  city: string;
  region: string;
};

export default function CitySelect({
  name,
  id,
  value,
  onChange,
}: {
  value: CitySelectValue;
  onChange: (value: CitySelectValue) => void;
  name: string;
  id: string;
}) {
  async function loadOptions(inputValue: string) {
    const response: Array<GeoApiResponse> = await fetch(
      `https://geo.api.gouv.fr/communes?nom=${inputValue}&fields=codeDepartement,centre,region&boost=population&limit=5`
    ).then((res) => res.json());
    const options = response.map((item) => {
      const cityAndDepartment = `${item.nom} (${item.codeDepartement})`;
      return {
        value: {
          city: `${cityAndDepartment} - ${JSON.stringify(item.centre.coordinates)}`,
          region: item.region.nom,
        },
        label: cityAndDepartment,
      };
    });
    return options;
  }

  return (
    <AsyncSelect
      styles={filterStyles}
      placeholder="Choisir..."
      noOptionsMessage={() => "Aucun résultat"}
      theme={setTheme}
      name={name}
      instanceId={id}
      inputId={id}
      classNamePrefix={id}
      value={{
        value: {
          city: value.city,
          region: value.region,
        },
        label: value?.city?.split?.(" - ")[0],
      }}
      onChange={(e) => onChange(e?.value)}
      loadOptions={loadOptions}
    />
  );
}

const filterStyles: StylesConfig<{ value: CitySelectValue; label: string }, false> = {
  // control: (styles) => ({ ...styles, borderWidth: 0 }),
  indicatorSeparator: (styles) => ({ ...styles, borderWidth: 0, backgroundColor: "transparent" }),
  menuPortal: (provided) => ({ ...provided, zIndex: 10000 }),
  menu: (provided) => ({ ...provided, zIndex: 10000 }),
};

function setTheme(defaultTheme: Theme): Theme {
  return {
    ...defaultTheme,
    colors: {
      ...defaultTheme.colors,
      primary: theme.main,
      primary25: theme.main25,
      primary50: theme.main50,
      primary75: theme.main75,
    },
  };
}
