import React, { useState } from "react";
import styled from "styled-components/native";
import { ActivityIndicator } from "react-native";
import colors from "../../utils/colors";
import SceneContainer from "../../components/SceneContainer";
import ScrollContainer from "../../components/ScrollContainer";
import { MyText } from "../../components/MyText";
import Title from "../../components/Title";
import ScreenTitle from "../../components/ScreenTitle";
import { useAtomValue, useSetAtom } from "jotai";
import { currentTeamState, userState } from "../../atoms/auth";
import { refreshTriggerState } from "../../components/Loader";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LoginStackParamsList, RootStackParamList } from "@/types/navigation";
import { TeamInstance } from "@/types/team";

const TeamBody = ({ onSelect }: { onSelect: () => void }) => {
  const [loading, setLoading] = useState<string | undefined>(undefined);
  const user = useAtomValue(userState)!;
  const setCurrentTeam = useSetAtom(currentTeamState);
  const setRefreshTrigger = useSetAtom(refreshTriggerState);

  const onTeamSelected = async (team: TeamInstance) => {
    setLoading(team._id);
    setRefreshTrigger({ status: true, options: { showFullScreen: true, initialLoad: true } });
    setCurrentTeam(team);
    setLoading(undefined);
    onSelect();
  };

  const sortedTeams = [...(user?.teams ?? [])].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return (
    <ScrollContainer backgroundColor="#fff">
      {sortedTeams.map((team) => (
        <TeamContainer disabled={!!loading} key={team._id} onPress={() => onTeamSelected(team)}>
          {loading === team._id ? <ActivityIndicator size="small" color={colors.app.color} /> : <Team>{team.name}</Team>}
        </TeamContainer>
      ))}
    </ScrollContainer>
  );
};

export const TeamSelection = (props: NativeStackScreenProps<LoginStackParamsList, "TEAM_SELECTION">) => {
  const onSelect = () =>
    props.navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: "TABS_STACK" }],
    });

  return (
    <SceneContainer backgroundColor="#fff">
      <Title>Choisissez une équipe</Title>
      <Wrapper>
        <TeamBody onSelect={onSelect} />
      </Wrapper>
    </SceneContainer>
  );
};

export const ChangeTeam = (props: NativeStackScreenProps<RootStackParamList, "CHANGE_TEAM">) => {
  const onSelect = () => {
    props.navigation.goBack();
  };
  return (
    <SceneContainer>
      <ScreenTitle title="Choisissez une équipe" onBack={props.navigation.goBack} />
      <TeamBody onSelect={onSelect} />
    </SceneContainer>
  );
};

const Wrapper = styled.View`
  display: flex;
  flex-direction: column;
  padding-horizontal: 20px;
  flex: 1;
  padding-bottom: 20px;
`;

const TeamContainer = styled.TouchableOpacity`
  margin-vertical: 10px;
  padding-vertical: 25px;
  background-color: ${colors.app.color}15;
  border-radius: 12px;
`;

const Team = styled(MyText)`
  text-align: center;
  color: ${colors.app.color};
`;
