import React from "react";
import { useAtomValue } from "jotai";
import { teamsState } from "../atoms/auth";
import SelectCustom from "./SelectCustom";
import { getTeamColors } from "./TagTeam";

const SelectTeamMultiple = ({ onChange, value: teamIds = [], inputId, classNamePrefix, isDisabled = false }) => {
  const teams = useAtomValue(teamsState);

  return (
    <SelectCustom
      name="name"
      options={teams}
      onChange={(teams) => onChange(teams?.map((t) => t._id) || [])}
      value={teamIds.map((_teamId) => teams.find((_team) => _team._id === _teamId))}
      getOptionValue={(team) => team._id}
      getOptionLabel={(team) => team.name}
      formatOptionLabel={(team) => {
        const teamIndex = teams.findIndex((t) => t._id === team._id);
        const { backgroundColor, borderColor } = getTeamColors(team, teamIndex);
        return (
          <div className="tw-flex tw-items-center tw-gap-2">
            <span
              className="tw-inline-block tw-h-3 tw-w-3 tw-rounded-full tw-shrink-0"
              style={{ backgroundColor, border: `1px solid ${borderColor}` }}
            />
            {team.name}
          </div>
        );
      }}
      isMulti
      isDisabled={isDisabled}
      inputId={inputId}
      classNamePrefix={classNamePrefix}
    />
  );
};

export default SelectTeamMultiple;
