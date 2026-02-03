import React from "react";
import { useAtomValue } from "jotai";
import { teamsState } from "../atoms/auth";

/**
 * Retourne la couleur de fond et de bordure pour une équipe
 * Utilise team.color si disponible, sinon fallback sur l'index
 */
export const getTeamColors = (team, teamIndex) => {
  if (team?.color) {
    return {
      backgroundColor: `${team.color}cc`,
      borderColor: team.color,
    };
  }
  return {
    backgroundColor: teamsColors[teamIndex % teamsColors.length],
    borderColor: borderColors[teamIndex % borderColors.length],
  };
};

const TagTeam = ({ teamId }) => {
  const teams = useAtomValue(teamsState);
  const teamIndex = teams?.findIndex((t) => t._id === teamId);
  const team = teams?.find((t) => t._id === teamId);
  if (!team) return null;
  const { backgroundColor, borderColor } = getTeamColors(team, teamIndex);
  return (
    <div
      key={team?._id}
      style={{ backgroundColor, borderColor }}
      className="tw-inline-flex tw-justify-center tw-gap-4 tw-rounded tw-border tw-px-2.5 tw-py-0.5 tw-text-center tw-text-xs tw-text-white"
    >
      {team?.nightSession && <span>🌒</span>}
      {team?.name}
    </div>
  );
};

export const teamsColors = [
  "#255c99cc",
  "#74776bcc",
  "#00c6a5cc",
  "#ff4b64cc",
  "#ef798acc",
  "#a066ffcc",
  "#00e6d6cc",
  "#124660cc",
  "#ff4f38cc",
  "#1b9476cc",
  "#4dbac7cc",
  "#ffa500cc",
  "#e392dbcc",
  "#28A428cc",
  "#f5c000cc",
];
export const borderColors = [
  "#255c99",
  "#74776b",
  "#00c6a5",
  "#ff4b64",
  "#ef798a",
  "#a066ff",
  "#00e6d6",
  "#124660",
  "#ff4f38",
  "#1b9476",
  "#4dbac7",
  "#ffa500",
  "#e392db",
  "#28a428",
  "#f5d000",
];

export default TagTeam;
