import React from "react";
import { useStore } from "../store";
import SelectCustom from "./SelectCustom";

const SelectTeamMultiple = ({ onChange, value: teamIds = [], inputId, classNamePrefix, isDisabled = false }) => {
  const teams = useStore((state) => state.teams);

  return (
    <SelectCustom
      name="name"
      options={teams}
      onChange={(teams) => onChange(teams?.map((t) => t._id) || [])}
      value={teamIds.map((_teamId) => teams.find((_team) => _team._id === _teamId))}
      getOptionValue={(team) => team._id}
      getOptionLabel={(team) => team.name}
      isMulti
      isDisabled={isDisabled}
      inputId={inputId}
      classNamePrefix={classNamePrefix}
    />
  );
};

export default SelectTeamMultiple;
