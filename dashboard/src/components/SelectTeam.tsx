import { useEffect } from "react";
import SelectCustom from "./SelectCustom";
import type { TeamInstance } from "../types/team";
import type { SelectCustomProps } from "./SelectCustom";
import type { GroupBase } from "react-select";

interface SelectTeamProps extends SelectCustomProps<TeamInstance, false, GroupBase<TeamInstance>> {
  name: string;
  onChange?: (team: TeamInstance) => void;
  teamId?: TeamInstance["_id"] | null;
  teams?: Array<TeamInstance>;
  style?: React.CSSProperties;
  inputId?: string;
}

const SelectTeam = ({ name, onChange, teamId = null, teams = null, style = null, inputId = "", ...rest }: SelectTeamProps) => {
  useEffect(() => {
    if (teams?.length === 1 && !teamId && onChange) onChange(teams[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  if (!teams) return <div />;

  return (
    <div style={style} className="tw-flex tw-w-full tw-flex-col tw-rounded-md">
      <SelectCustom
        name={name}
        onChange={onChange}
        value={teams.find((_team) => _team._id === teamId)}
        options={teams}
        getOptionValue={(team) => team._id}
        getOptionLabel={(team) => team.name}
        isClearable={false}
        inputId={inputId}
        classNamePrefix={inputId}
        {...rest}
      />
    </div>
  );
};

export default SelectTeam;
