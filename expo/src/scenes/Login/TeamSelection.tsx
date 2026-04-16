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
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LoginStackParamsList, RootStackParamList } from "@/types/navigation";
import { useDataLoader } from "@/services/dataLoader";

const TeamBody = ({ onSelect }: { onSelect: () => void }) => {
  const [loading, setLoading] = useState<number | undefined>(undefined);
  const user = useAtomValue(userState)!;
  const setCurrentTeam = useSetAtom(currentTeamState);
  const { startInitialLoad } = useDataLoader();

  const onTeamSelected = async (teamIndex: number) => {
    setLoading(teamIndex);
    startInitialLoad();
    setCurrentTeam(user.teams![teamIndex]!);
    setLoading(undefined);
    onSelect();
  };

  return (
    <ScrollContainer backgroundColor="#fff">
      {user?.teams?.map(({ _id, name }, i) => (
        <TeamContainer disabled={!!loading} key={_id} onPress={() => onTeamSelected(i)}>
          {loading === i ? <ActivityIndicator size="small" color={colors.app.color} /> : <Team>{name}</Team>}
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
