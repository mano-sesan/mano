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
import { prepareRencontreForEncryption } from "../../atoms/rencontres";
import API from "../../services/api";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { RencontreInstance } from "@/types/rencontre";
import { useDataLoader } from "@/services/dataLoader";

type RencontreProps = NativeStackScreenProps<RootStackParamList, "RENCONTRE">;
const Rencontre = ({ navigation, route }: RencontreProps) => {
  const personId = route.params.person._id;
  const isNewRencontre = !route.params.rencontre;
  const { refresh } = useDataLoader();
  const currentTeam = useAtomValue(currentTeamState)!;
  const user = useAtomValue(userState)!;
  const [rencontre, setRencontre] = useState<RencontreInstance>(() => {
    if (route.params.rencontre) {
      return {
        _id: route.params.rencontre._id,
        organisation: route.params.rencontre.organisation,
        entityKey: route.params.rencontre.entityKey,
        createdAt: route.params.rencontre.createdAt,
        deletedAt: route.params.rencontre.deletedAt,
        updatedAt: route.params.rencontre.updatedAt,
        date: route.params.rencontre.date,
        person: route.params.rencontre.person,
        user: route.params.rencontre.user,
        team: route.params.rencontre.team,
        observation: route.params.rencontre.observation,
        comment: route.params.rencontre.comment,
      };
    }
    return {
      date: new Date().toISOString(),
      user: user._id,
      team: currentTeam._id,
      person: personId,
    } as RencontreInstance;
  });
  const [submitting, setSubmitting] = useState(false);

  const createRencontre = async () => {
    const response = await API.post({
      path: "/rencontre",
      body: prepareRencontreForEncryption(rencontre),
      entityType: "rencontre",
    });
    if (response.ok) {
      await refresh();
      Alert.alert("Rencontre ajoutée !");
    }
    return response;
  };

  const updateRencontre = async () => {
    const response = await API.put({
      path: `/rencontre/${rencontre._id}`,
      body: prepareRencontreForEncryption(rencontre),
      entityType: "rencontre",
      entityId: rencontre._id,
    });
    if (response.ok) {
      await refresh();
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
                const response = isNewRencontre ? await createRencontre() : await updateRencontre();
                setSubmitting(false);
                if (!response.ok) {
                  Alert.alert("Erreur", response.error || response.code || "Une erreur est survenue lors de l'enregistrement de la rencontre");
                  return;
                }
                await refresh();
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
