import React, { useEffect } from "react";
import SelectCustom from "./SelectCustom";
import type { TerritoryInstance } from "../types/territory";
import type { SelectCustomProps } from "./SelectCustom";
import type { GroupBase, SingleValue, ActionMeta } from "react-select";

interface SelectTerritoryProps extends Omit<SelectCustomProps<TerritoryInstance, false, GroupBase<TerritoryInstance>>, "onChange"> {
  name: string;
  onChange?: (territory: TerritoryInstance) => void;
  territoryId?: TerritoryInstance["_id"] | null;
  territories?: Array<TerritoryInstance>;
  style?: React.CSSProperties;
  inputId?: string;
}

const SelectTerritory = ({
  name,
  onChange,
  territoryId = null,
  territories = [],
  style = undefined,
  inputId = "",
  ...rest
}: SelectTerritoryProps) => {
  useEffect(() => {
    if (territories?.length === 1 && !territoryId && onChange) onChange(territories[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territories]);

  if (!territories) return <div />;

  const handleChange = (newValue: SingleValue<TerritoryInstance>, _actionMeta: ActionMeta<TerritoryInstance>) => {
    if (onChange && newValue) {
      onChange(newValue);
    }
  };

  return (
    <div style={style} className="tw-flex tw-w-full tw-flex-col tw-rounded-md">
      <SelectCustom
        name={name}
        onChange={handleChange}
        value={territories.find((_territory) => _territory._id === territoryId)}
        options={territories}
        getOptionValue={(territory) => territory._id}
        getOptionLabel={(territory) => territory.name}
        isClearable={false}
        inputId={inputId}
        classNamePrefix={inputId}
        {...rest}
      />
    </div>
  );
};

export default SelectTerritory;

