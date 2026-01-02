import React, { useState } from "react";
import { Linking } from "react-native";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import Row from "../../components/Row";
import Spacer from "../../components/Spacer";
import API from "../../services/api";
import ScrollContainer from "../../components/ScrollContainer";
import { MANO_DOWNLOAD_URL, MANO_TEST_ORGANISATION_ID } from "../../config";
import { useAtomValue } from "jotai";
import { currentTeamState, organisationState } from "../../recoil/auth";
import { capture } from "../../services/sentry";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { LoginStackParamsList, RootStackParamList, TabsParamsList } from "@/types/navigation";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type MenuProps = BottomTabScreenProps<TabsParamsList, "MENU">;

const Menu = ({ navigation }: MenuProps) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const organisation = useAtomValue(organisationState)!;
  const currentTeam = useAtomValue(currentTeamState)!;

  const onLogoutRequest = async (clearAll = false) => {
    setIsLoggingOut(true);
    API.logout(clearAll);
  };

  const navigateRootStack = (screen: "COMPTES_RENDUS" | "STRUCTURES" | "SOLIGUIDE" | "CHANGE_TEAM" | "CHANGE_PASSWORD" | "LEGAL" | "PRIVACY") => {
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>().navigate(screen);
  };

  const navigateToLoginStack = (screen: keyof LoginStackParamsList) => {
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>().navigate("LOGIN_STACK", { screen });
  };

  return (
    <SceneContainer>
      <ScreenTitle title="Menu" />
      <ScrollContainer noPadding>
        <Spacer height={30} />
        <Row
          withNextButton
          caption={`Comptes-rendus de l'équipe ${currentTeam?.name}`}
          onPress={() => {
            navigateRootStack("COMPTES_RENDUS");
          }}
        />
        <Row withNextButton caption="Contacts" onPress={() => navigateRootStack("STRUCTURES")} />
        <Row withNextButton caption="Soliguide" onPress={() => navigateRootStack("SOLIGUIDE")} />
        <Spacer height={30} />
        <Row withNextButton caption={`Changer d'équipe (actuellement ${currentTeam?.name})`} onPress={() => navigateRootStack("CHANGE_TEAM")} />
        <Row withNextButton caption="Changer le mot de passe" onPress={() => navigateRootStack("CHANGE_PASSWORD")} />
        <Spacer height={30} />
        <Row withNextButton caption="Télécharger Mano" onPress={() => Linking.openURL(MANO_DOWNLOAD_URL)} />
        {API.updateLink && (
          <Row withNextButton caption="Mettre à jour la dernière version" onPress={() => API.downloadAndInstallUpdate(API.updateLink)} />
        )}
        <Spacer height={30} />
        <Row withNextButton caption="Charte des utilisateurs" onPress={() => navigateToLoginStack("CHARTE_ACCEPTANCE")} />
        <Row withNextButton caption="Conditions générales d'utilisation" onPress={() => navigateToLoginStack("CGUS_ACCEPTANCE")} />
        <Row withNextButton caption="Mentions Légales" onPress={() => navigateRootStack("LEGAL")} />
        <Row withNextButton caption="Politique de Confidentialité" onPress={() => navigateRootStack("PRIVACY")} />
        <Spacer height={30} />
        {(__DEV__ || organisation._id === MANO_TEST_ORGANISATION_ID) && (
          <>
            <Row
              caption="Test Sentry"
              onPress={() => {
                capture("Test Sentry Capture", { extra: { test: "test" } });
                // throw new Error('Test Sentry Error Crash');
              }}
            />
            <Spacer height={30} />
          </>
        )}
        <Row caption="Se déconnecter" color="#F00" loading={isLoggingOut} onPress={() => onLogoutRequest()} />
        <Row caption="Se déconnecter et vider le cache" color="#F00" loading={isLoggingOut} onPress={() => onLogoutRequest(true)} />
        <Spacer height={30} />
      </ScrollContainer>
    </SceneContainer>
  );
};

export default Menu;
