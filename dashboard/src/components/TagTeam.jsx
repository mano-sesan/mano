import React from "react";
import { useAtomValue } from "jotai";
import { teamsState } from "../atoms/auth";
import { MoonIcon } from "@heroicons/react/24/solid";

const DEFAULT_TEAM_COLOR = "#255c99";

export const getTeamColors = (team) => {
  const color = team?.color || DEFAULT_TEAM_COLOR;
  return {
    backgroundColor: `${color}cc`,
    borderColor: color,
  };
};

const TagTeam = ({ teamId }) => {
  const teams = useAtomValue(teamsState);
  const team = teams?.find((t) => t._id === teamId);
  if (!team) return null;
  const { backgroundColor, borderColor } = getTeamColors(team);
  return (
    <div
      key={team?._id}
      style={{ backgroundColor, borderColor }}
      className="tw-inline-flex tw-justify-center tw-gap-4 tw-rounded tw-border tw-px-2.5 tw-py-0.5 tw-text-center tw-text-xs tw-text-white"
    >
      {team?.nightSession && <MoonIcon className="tw-h-3.5 tw-w-3.5" />}
      {team?.name}
    </div>
  );
};

export default TagTeam;
