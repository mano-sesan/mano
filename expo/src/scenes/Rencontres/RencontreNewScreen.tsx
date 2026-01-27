import React, { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import ScrollContainer from "../../components/ScrollContainer";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import Button from "../../components/Button";
import DateAndTimeInput from "../../components/DateAndTimeInput";
import Label from "../../components/Label";
import Tags from "../../components/Tags";
import { MyText } from "../../components/MyText";
import { currentTeamState, userState } from "../../recoil/auth";
import { rencontresState, prepareRencontreForEncryption } from "../../recoil/rencontres";
import API from "../../services/api";
import { useNavigation } from "@react-navigation/native";
import { refreshTriggerState } from "../../components/Loader";
import { PersonInstance } from "@/types/person";
import { RencontreInstance } from "@/types/rencontre";
import { RencontreNewStackParams, RootStackParamList } from "@/types/navigation";
import PersonsSearch from "../Persons/PersonsSearch";
import { createNativeStackNavigator, NativeStackScreenProps } from "@react-navigation/native-stack";
import PersonNew from "../Persons/PersonNew";
import InputMultilineAutoAdjust from "../../components/InputMultilineAutoAdjust";

const RencontreNewStack = createNativeStackNavigator<RencontreNewStackParams>();
type NewRencontreScreenProps = NativeStackScreenProps<RootStackParamList, "RENCONTRE_NEW_STACK">;

export default function RencontreNewScreen({ route, navigation }: NewRencontreScreenProps) {
  const person = route.params?.person;
  const [rencontrePersons, setRencontrePersons] = useState<PersonInstance[]>(() => (person ? [person] : []));

  const canChangePerson = !person;

  return (
    <RencontreNewStack.Navigator screenOptions={{ headerShown: false }}>
      <RencontreNewStack.Screen name="RENCONTRE_NEW">
        {(stackProps) => (
          <NewRencontreForm
            onBack={() => navigation.goBack()}
            onRencontreCreated={() => {
              navigation.goBack();
            }}
            rencontrePersons={rencontrePersons}
            setRencontrePersons={setRencontrePersons}
            canChangePerson={canChangePerson}
            onSearchPerson={() => {
              if (canChangePerson) {
                stackProps.navigation.navigate("PERSONS_SEARCH");
              }
            }}
          />
        )}
      </RencontreNewStack.Screen>
      <RencontreNewStack.Screen name="PERSONS_SEARCH" options={{ title: "Rechercher une personne" }}>
        {(stackProps) => (
          <PersonsSearch
            onBack={() => stackProps.navigation.goBack()}
            onCreatePersonRequest={() => stackProps.navigation.navigate("PERSON_NEW")}
            onPersonSelected={(person) => {
              setRencontrePersons((rencontrePersons) => [...rencontrePersons.filter((p) => p._id !== person._id), person]);
              stackProps.navigation.goBack();
            }}
          />
        )}
      </RencontreNewStack.Screen>
      <RencontreNewStack.Screen name="PERSON_NEW" options={{ title: "Nouvelle personne" }}>
        {(stackProps) => (
          <PersonNew
            onBack={() => stackProps.navigation.goBack()}
            onPersonCreated={(person) => {
              stackProps.navigation.goBack();
              setRencontrePersons((rencontrePersons) => [...rencontrePersons.filter((p) => p._id !== person._id), person]);
            }}
          />
        )}
      </RencontreNewStack.Screen>
    </RencontreNewStack.Navigator>
  );
}

type NewRencontreFormProps = {
  onBack: () => void;
  onRencontreCreated: () => void;
  rencontrePersons: PersonInstance[];
  setRencontrePersons: (rencontrePersons: PersonInstance[]) => void;
  onSearchPerson?: () => void;
  canChangePerson: boolean;
};

const NewRencontreForm = ({
  onSearchPerson,
  onBack: onBackProp,
  onRencontreCreated,
  rencontrePersons,
  setRencontrePersons,
  canChangePerson,
}: NewRencontreFormProps) => {
  const setRefreshTrigger = useSetAtom(refreshTriggerState);
  const currentTeam = useAtomValue(currentTeamState)!;
  const user = useAtomValue(userState)!;
  const navigation = useNavigation();
  const [date, setDate] = useState<Date>(new Date());
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [rencontres, setRencontres] = useAtom(rencontresState);

  const backRequestHandledRef = useRef(false);
  useEffect(() => {
    const handleBeforeRemove = (e: any) => {
      if (backRequestHandledRef.current) return;
      e.preventDefault();
      onGoBackRequested();
    };
    const beforeRemoveListenerUnsbscribe = navigation.addListener("beforeRemove", handleBeforeRemove);
    return () => {
      beforeRemoveListenerUnsbscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const onCreateRencontreRequest = () => {
    if (rencontrePersons.length === 0) {
      Alert.alert("Veuillez sélectionner au moins une personne");
      return;
    }
    if (rencontrePersons.length > 1) {
      Alert.alert(
        "Sauvegarde de multiples rencontres",
        `En sauvegardant, vous allez créer ${rencontrePersons.length} rencontres. Voulez-vous continuer ?`,
        [
          {
            text: "Continuer",
            onPress: onCreateRencontre,
          },
          {
            text: "Annuler",
            style: "cancel",
          },
        ]
      );
    } else {
      onCreateRencontre();
    }
  };

  const onCreateRencontre = async () => {
    setPosting(true);

    const newRencontres: RencontreInstance[] = [];

    // Créer une rencontre par personne
    for (const person of rencontrePersons) {
      const rencontre: Partial<RencontreInstance> = {
        date: date.toISOString(),
        comment,
        person: person._id,
        team: currentTeam._id,
        user: user._id,
      };

      const response = await API.post({
        path: "/rencontre",
        body: prepareRencontreForEncryption(rencontre),
      });

      if (!response.ok) {
        setPosting(false);
        Alert.alert(response.error || response.code);
        return;
      }

      newRencontres.push(response.decryptedData);
    }

    // Mettre à jour l'état avec toutes les nouvelles rencontres
    setRencontres([...newRencontres, ...rencontres]);
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
    setPosting(false);

    if (newRencontres.length > 1) {
      Alert.alert(`${newRencontres.length} rencontres créées !`);
    } else {
      Alert.alert("Rencontre créée !");
    }

    backRequestHandledRef.current = true;
    onRencontreCreated();
  };

  const onGoBackRequested = () => {
    if (rencontrePersons.length > 0 || comment) {
      Alert.alert("Voulez-vous abandonner la création de la rencontre ?", "Les informations saisies ne seront pas sauvegardées", [
        {
          text: "Continuer la création",
          style: "cancel",
        },
        {
          text: "Abandonner",
          style: "destructive",
          onPress: onBack,
        },
      ]);
    } else {
      onBack();
    }
  };

  const onBack = () => {
    backRequestHandledRef.current = true;
    onBackProp();
  };

  return (
    <SceneContainer>
      <ScreenTitle title="Ajouter une rencontre" onBack={onGoBackRequested} />
      <ScrollContainer keyboardShouldPersistTaps="handled">
        <View>
          <Label label="Personne(s) concerné(es)" />
          <Tags
            data={rencontrePersons}
            onChange={setRencontrePersons}
            editable={canChangePerson}
            onAddRequest={onSearchPerson}
            renderTag={(person) => <MyText>{person?.name}</MyText>}
          />
          <DateAndTimeInput
            label="Date"
            // @ts-expect-error Type 'PossibleDate' is not assignable to parameter of type 'SetStateAction<Date>'.
            setDate={setDate}
            date={date}
            showDay
            showTime
            withTime
            editable
          />
          <InputMultilineAutoAdjust onChangeText={setComment} value={comment} placeholder="Ajouter un commentaire" />
          <View className="mt-8">
            <Button caption="Enregistrer" disabled={rencontrePersons.length === 0} loading={posting} onPress={onCreateRencontreRequest} />
          </View>
        </View>
      </ScrollContainer>
    </SceneContainer>
  );
};
