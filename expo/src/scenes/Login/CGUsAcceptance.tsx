import React, { useState } from "react";
import styled from "styled-components/native";
import { Linking, Dimensions } from "react-native";
import Pdf from "react-native-pdf";
import API from "../../services/api";
import SceneContainer from "../../components/SceneContainer";
import ScrollContainer from "../../components/ScrollContainer";
import ButtonsContainer from "../../components/ButtonsContainer";
import Button from "../../components/Button";
import Title, { SubTitle } from "../../components/Title";
import { useAtomValue, useSetAtom } from "jotai";
import { currentTeamState, userState } from "../../recoil/auth";
import { refreshTriggerState } from "../../components/Loader";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LoginStackParamsList } from "@/types/navigation";

type CGUsAcceptanceProps = NativeStackScreenProps<LoginStackParamsList, "CGUS_ACCEPTANCE">;

const CGUsAcceptance = ({ navigation }: CGUsAcceptanceProps) => {
  const [loading, setLoading] = useState(false);
  const user = useAtomValue(userState);
  const setCurrentTeam = useSetAtom(currentTeamState);
  const setRefreshTrigger = useSetAtom(refreshTriggerState);

  const onAccept = async () => {
    setLoading(true);
    const response = await API.put({ path: "/user", body: { termsAccepted: Date.now() } });
    if (response.ok) {
      if (!response.user?.termsAccepted) {
        navigation.navigate("CHARTE_ACCEPTANCE");
      } else if (user?.teams?.length === 1) {
        setCurrentTeam(user.teams[0]);
        setRefreshTrigger({ status: true, options: { showFullScreen: true, initialLoad: true } });
        navigation.getParent()?.navigate("TABS_STACK");
      } else {
        navigation.navigate("TEAM_SELECTION");
      }
    }
    setTimeout(() => {
      setLoading(false);
    }, 500);
  };

  return (
    <Background>
      <SceneContainer backgroundColor="#fff">
        <ScrollContainer noPadding>
          <Container>
            <Title>Conditions générales d'utilisation</Title>
            <SubTitle>Veuillez lire et accepter les Conditions Générales d'Utilisation de Mano avant de continuer</SubTitle>
          </Container>
          <PdfContainer>
            <PdfViewer
              source={{ uri: "https://espace-mano.sesan.fr/cgu.pdf" }}
              onPressLink={async (url) => {
                if (await Linking.canOpenURL(url)) Linking.openURL(url);
              }}
              trustAllCerts={false}
            />
          </PdfContainer>
          <Container>
            <ButtonsContainer>
              <Button caption="J'accepte les Conditions Générales d'Utilisation de Mano" onPress={onAccept} loading={loading} disabled={loading} />
            </ButtonsContainer>
          </Container>
        </ScrollContainer>
      </SceneContainer>
    </Background>
  );
};

const Container = styled.View`
  margin: 30px;
`;

const Background = styled.View`
  flex: 1;
  background-color: #fff;
`;

const PdfContainer = styled.View`
  width: 100%;
  flex-shrink: 0;
  margin-bottom: 30px;
`;

const docWidth = Dimensions.get("window").width;
const pageHeight = (docWidth * 29.7) / 21; // A4
const pagesSpacing = 10;

const PdfViewer = styled(Pdf)`
  flex-grow: 1;
  width: ${docWidth}px;
  height: ${pageHeight * 4 + pagesSpacing * 3}px;
`;

export default CGUsAcceptance;
