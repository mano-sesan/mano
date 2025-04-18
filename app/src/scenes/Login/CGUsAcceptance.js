import React, { useState } from 'react';
import styled from 'styled-components';
import { Linking, Dimensions } from 'react-native';
import Pdf from 'react-native-pdf';
import API from '../../services/api';
import SceneContainer from '../../components/SceneContainer';
import ScrollContainer from '../../components/ScrollContainer';
import ButtonsContainer from '../../components/ButtonsContainer';
import Button from '../../components/Button';
import Title, { SubTitle } from '../../components/Title';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { currentTeamState, userState } from '../../recoil/auth';
import { refreshTriggerState } from '../../components/Loader';

const CGUsAcceptance = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const user = useRecoilValue(userState);
  const setCurrentTeam = useSetRecoilState(currentTeamState);
  const setRefreshTrigger = useSetRecoilState(refreshTriggerState);

  const onAccept = async () => {
    setLoading(true);
    const response = await API.put({ path: '/user', body: { termsAccepted: Date.now() } });
    if (response.ok) {
      if (!response.user?.termsAccepted) {
        navigation.navigate('CharteAcceptance');
      } else if (user?.teams?.length === 1) {
        setCurrentTeam(user.teams[0]);
        setRefreshTrigger({ status: true, options: { showFullScreen: true, initialLoad: true } });
        navigation.navigate('Home');
      } else {
        navigation.navigate('TeamSelection');
      }
    }
    setTimeout(() => {
      setLoading(false);
    }, 500);
  };

  return (
    <Background>
      <SceneContainer backgroundColor="#fff" noPadding>
        <ScrollContainer enabled={false} noPadding>
          <Container>
            <Title>Conditions générales d'utilisation</Title>
            <SubTitle>Veuillez lire et accepter les Conditions Générales d'Utilisation de Mano avant de continuer</SubTitle>
          </Container>
          <PdfContainer>
            <PdfViewer
              source={{ uri: 'https://espace-mano.sesan.fr/cgu.pdf' }}
              onPressLink={(url) => {
                if (Linking.canOpenURL(url)) Linking.openURL(url);
              }}
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

const docWidth = Dimensions.get('window').width;
const pageHeight = (docWidth * 29.7) / 21; // A4
const pagesSpacing = 10;

const PdfViewer = styled(Pdf)`
  flex-grow: 1;
  width: ${docWidth}px;
  height: ${pageHeight * 4 + pagesSpacing * 3}px;
`;

export default CGUsAcceptance;
