import React from "react";
import styled from "styled-components/native";
import { useAtomValue, useSetAtom } from "jotai";
import SceneContainer from "../../components/SceneContainer";
import colors from "../../utils/colors";
import { ChangePasswordBody } from "./ChangePassword";
import { MyText } from "../../components/MyText";
import { currentTeamState, userState } from "../../atoms/auth";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LoginStackParamsList } from "@/types/navigation";
import { useDataLoader } from "@/services/dataLoader";

type ForceChangePasswordProps = NativeStackScreenProps<LoginStackParamsList, "FORCE_CHANGE_PASSWORD">;

const ForceChangePassword = ({ navigation }: ForceChangePasswordProps) => {
  const user = useAtomValue(userState)!;
  const setCurrentTeam = useSetAtom(currentTeamState);
  const { startInitialLoad, cleanupLoader } = useDataLoader();
  const onOk = () => {
    if (user.teams?.length === 1) {
      startInitialLoad().then(() => cleanupLoader());
      setCurrentTeam(user.teams[0]);
      navigation.getParent()?.navigate("TABS_STACK");
    } else {
      navigation.navigate("TEAM_SELECTION");
    }
  };

  return (
    <Background>
      <SceneContainer>
        <ChangePasswordBody onOK={onOk}>
          <Title>Mot de passe expiré</Title>
          <SubTitle>Veuillez confirmer votre mot de passe et saisir un nouveau</SubTitle>
        </ChangePasswordBody>
      </SceneContainer>
    </Background>
  );
};

const Background = styled.View`
  flex: 1;
  background-color: #fff;
`;

const Title = styled(MyText)`
  background-color: ${colors.app.color};
  padding-horizontal: 30px;
  padding-vertical: 15px;
  font-weight: bold;
  font-style: italic;
  font-size: 22px;
  margin-top: 20%;
  align-self: center;
  color: #fff;
`;

const SubTitle = styled(MyText)`
  font-size: 13px;
  margin-top: 15%;
  margin-bottom: 10%;
  align-self: center;
  text-align: center;
`;

export default ForceChangePassword;
