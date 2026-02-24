import React, { useEffect, useMemo } from "react";
import { useAtomValue } from "jotai";
import SelectCustom from "./SelectCustom";
import type { TeamInstance } from "../types/team";
import type { SelectCustomProps } from "./SelectCustom";
import type { GroupBase, SingleValue, ActionMeta } from "react-select";
import { getTeamColors } from "./TagTeam";
import { teamsState } from "../atoms/auth";

interface SelectTeamProps extends Omit<SelectCustomProps<TeamInstance, false, GroupBase<TeamInstance>>, "onChange"> {
  name: string;
  onChange?: (team: TeamInstance) => void;
  teamId?: TeamInstance["_id"] | null;
  teams?: Array<TeamInstance>;
  style?: React.CSSProperties;
  inputId?: string;
}

const SelectTeam = ({ name, onChange, teamId = null, teams = [], style = undefined, inputId = "", ...rest }: SelectTeamProps) => {
  const allTeams = useAtomValue(teamsState);
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => (a.name || "").localeCompare(b.name || "")), [teams]);

  useEffect(() => {
    if (teams?.length === 1 && !teamId && onChange) onChange(teams[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  if (!teams) return <div />;

  const handleChange = (newValue: SingleValue<TeamInstance>, _actionMeta: ActionMeta<TeamInstance>) => {
    if (onChange && newValue) {
      onChange(newValue);
    }
  };

  return (
    <div style={style} className="tw-flex tw-w-full tw-flex-col tw-rounded-md">
      <SelectCustom
        name={name}
        onChange={handleChange}
        value={teams.find((_team) => _team._id === teamId)}
        options={sortedTeams}
        getOptionValue={(team) => team._id}
        getOptionLabel={(team) => team.name}
        formatOptionLabel={(team) => {
          const teamIndex = allTeams.findIndex((t) => t._id === team._id);
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
        isClearable={false}
        inputId={inputId}
        classNamePrefix={inputId}
        {...rest}
      />
    </div>
  );
};

export default SelectTeam;
