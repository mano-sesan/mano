import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { teamsState } from "../atoms/auth";
import { getTeamColors } from "./TagTeam";

export default function ColorHeaderBand({ teamId }) {
  const teams = useAtomValue(teamsState);
  const team = teams?.find((t) => t._id === teamId);

  const { borderColor, backgroundColor } = getTeamColors(team);

  useEffect(() => {
    const metaThemeColor = document.querySelector("meta[name=theme-color]");
    metaThemeColor.setAttribute("content", borderColor);
  }, [borderColor]);

  if (!team) return null;

  return <div key={team?._id} style={{ backgroundColor, borderColor }} className="tw-border tw-py-0.5" />;
}
