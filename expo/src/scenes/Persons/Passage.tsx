import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useAtomValue } from "jotai";
import styled from "styled-components/native";
import Button from "../../components/Button";
import DateAndTimeInput from "../../components/DateAndTimeInput";
import InputMultilineAutoAdjust from "../../components/InputMultilineAutoAdjust";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import ScrollContainer from "../../components/ScrollContainer";
import { currentTeamState, userState } from "../../atoms/auth";
import { preparePassageForEncryption } from "../../atoms/passages";
import API from "../../services/api";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { dayjsInstance } from "@/services/dateDayjs";
import { PassageInstance } from "@/types/passage";
import { useDataLoader } from "@/services/dataLoader";

type PassageProps = NativeStackScreenProps<RootStackParamList, "PASSAGE">;

const Passage = ({ navigation, route }: PassageProps) => {
  const personId = route.params?.person?._id;
  const isNewPassage = !route.params?.passage?._id;
  const currentTeam = useAtomValue(currentTeamState)!;
  const user = useAtomValue(userState)!;
  const [passage, setPassage] = useState(() => {
    if (route.params?.passage) {
      return {
        _id: route.params?.passage._id,
        organisation: route.params?.passage.organisation,
        entityKey: route.params?.passage.entityKey,
        date: route.params?.passage.date,
        comment: route.params?.passage.comment,
        user: route.params?.passage.user,
        team: route.params?.passage.team,
        person: route.params?.passage.person,
        createdAt: route.params?.passage.createdAt,
        updatedAt: route.params?.passage.updatedAt,
      };
    }
    return {
      date: dayjsInstance().toISOString(),
      user: user._id,
      team: currentTeam._id,
      person: personId,
    } as PassageInstance;
  });
  const [submitting, setSubmitting] = useState(false);
  const { refresh } = useDataLoader();

  const createPassage = async () => {
    const response = await API.post({
      path: "/passage",
      body: preparePassageForEncryption(passage),
    });
    if (response.ok) {
      await refresh();
      Alert.alert("Passage ajouté !");
    }
    return response;
  };

  const updatePassage = async () => {
    const response = await API.put({
      path: `/passage/${passage._id}`,
      body: preparePassageForEncryption(passage),
    });
    if (response.ok) {
      await refresh();
      Alert.alert("Passage modifié !");
    }
    return response;
  };

  return (
    <SceneContainer>
      <ScreenTitle title={isNewPassage ? "Ajouter un passage" : "Modifier un passage"} onBack={() => navigation.goBack()} />
      <ScrollContainer keyboardShouldPersistTaps="handled">
        <View>
          <DateAndTimeInput
            label="Date"
            // @ts-expect-error Type 'PossibleDate' is not assignable to type 'string | Date | undefined'.
            setDate={(date) => setPassage((a) => ({ ...a, date }))}
            date={passage.date}
            showDay
            showTime
            withTime
            editable
          />
          <InputMultilineAutoAdjust
            onChangeText={(x) => setPassage((a) => ({ ...a, comment: x }))}
            value={passage.comment || ""}
            placeholder="Ajouter un commentaire"
          />
          <ButtonContainer>
            <Button
              caption="Valider"
              disabled={false}
              loading={submitting}
              onPress={async () => {
                setSubmitting(true);
                if (isNewPassage) await createPassage();
                else await updatePassage();
                setSubmitting(false);
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

export default Passage;
