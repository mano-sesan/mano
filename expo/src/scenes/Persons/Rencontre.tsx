import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import styled from "styled-components/native";
import Button from "../../components/Button";
import DateAndTimeInput from "../../components/DateAndTimeInput";
import InputMultilineAutoAdjust from "../../components/InputMultilineAutoAdjust";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import ScrollContainer from "../../components/ScrollContainer";
import { currentTeamState, userState } from "../../recoil/auth";
import { rencontresState, prepareRencontreForEncryption } from "../../recoil/rencontres";
import API from "../../services/api";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { RencontreInstance } from "@/types/rencontre";
import { refreshTriggerState } from "@/components/Loader";

type RencontreProps = NativeStackScreenProps<RootStackParamList, "RENCONTRE">;
const Rencontre = ({ navigation, route }: RencontreProps) => {
  const personId = route.params.person._id;
  const isNewRencontre = !route.params.rencontre;
  const setRefreshTrigger = useSetAtom(refreshTriggerState);
  const currentTeam = useAtomValue(currentTeamState)!;
  const user = useAtomValue(userState)!;
  const [rencontre, setRencontre] = useState<RencontreInstance>(
    () => route.params.rencontre || { date: new Date().toISOString(), user: user._id, team: currentTeam._id, person: personId }
  );
  const [submitting, setSubmitting] = useState(false);
  const [rencontres, setRencontres] = useAtom(rencontresState);

  const createRencontre = async () => {
    const response = await API.post({
      path: "/rencontre",
      body: prepareRencontreForEncryption(rencontre),
    });
    if (response.ok) {
      const newRencontre = response.decryptedData;

      setRencontres([newRencontre, ...rencontres]);
      Alert.alert("Rencontre ajoutée !");
    }
    return response;
  };

  const updateRencontre = async () => {
    const response = await API.put({
      path: `/rencontre/${rencontre._id}`,
      body: prepareRencontreForEncryption(rencontre),
    });
    if (response.ok) {
      const updatedRencontre = response.decryptedData;

      setRencontres((rencontres) => rencontres.map((r) => (r._id === updatedRencontre._id ? updatedRencontre : r)));
      Alert.alert("Rencontre modifiée !");
    }
    return response;
  };

  return (
    <SceneContainer>
      <ScreenTitle title={isNewRencontre ? "Ajouter une rencontre" : "Modifier une rencontre"} onBack={() => navigation.goBack()} />
      <ScrollContainer keyboardShouldPersistTaps="handled">
        <View>
          <DateAndTimeInput
            label="Date"
            // @ts-expect-error Type 'PossibleDate' is not assignable to parameter of type 'SetStateAction<Date>'.
            setDate={(date) => setRencontre((a) => ({ ...a, date }))}
            date={rencontre.date}
            showDay
            showTime
            withTime
            editable
          />
          <InputMultilineAutoAdjust
            onChangeText={(x) => setRencontre((a) => ({ ...a, comment: x }))}
            value={rencontre.comment}
            placeholder="Ajouter un commentaire"
          />
          <ButtonContainer>
            <Button
              caption="Valider"
              disabled={false}
              loading={submitting}
              onPress={async () => {
                setSubmitting(true);
                if (isNewRencontre) await createRencontre();
                else await updateRencontre();
                setSubmitting(false);
                setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
                navigation.goBack();
              }}
            />
          </ButtonContainer>
        </View>
      </ScrollContainer>
    </SceneContainer>
  );
};

const ButtonContainer = styled.View`
  margin-top: 30px;
`;

export default Rencontre;
