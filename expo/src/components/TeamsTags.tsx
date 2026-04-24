import React from "react";
import styled from "styled-components/native";
import { useAtomValue } from "jotai";
import { MyText } from "./MyText";
import colors from "../utils/colors";
import { teamsState } from "../atoms/auth";
import { TeamInstance } from "@/types/team";

type TeamsTagsProps = {
  teams?: TeamInstance["_id"][];
};

const TeamsTags = ({ teams = [] }: TeamsTagsProps) => {
  const allTeams = useAtomValue(teamsState);

  if (!teams?.length) return null;

  return (
    <TeamsContainer>
      {teams?.map((teamId) => {
        if (!teamId) return;
        if (!allTeams?.length) return;
        const team = allTeams.find((t) => t._id === teamId);
        if (!team) return;
        const backgroundColor = team.color;
        return (
          <Team key={team?._id} backgroundColor={backgroundColor}>
            {team?.name}
          </Team>
        );
      })}
    </TeamsContainer>
  );
};

const TeamsContainer = styled.View`
  margin-top: 10px;
  color: ${colors.app.color};
  flex-grow: 0;
  flex-direction: row;
  flex-wrap: wrap;
`;

const Team = styled(MyText)<{ backgroundColor: string }>`
  background-color: ${(props) => props.backgroundColor || colors.app.color};
  margin-right: 10px;
  margin-bottom: 5px;
  padding: 2px 10px;
  border-radius: 5px;
  overflow: hidden;
  line-height: 18px;
  flex-grow: 0;
  color: #fff;
  align-self: flex-start;
`;

export default TeamsTags;
