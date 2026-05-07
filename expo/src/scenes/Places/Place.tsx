import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { useAtomValue } from "jotai";
import ScrollContainer from "../../components/ScrollContainer";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import InputLabelled from "../../components/InputLabelled";
import Button from "../../components/Button";
import ButtonsContainer from "../../components/ButtonsContainer";
import ButtonDelete from "../../components/ButtonDelete";
import { placesState, preparePlaceForEncryption } from "../../atoms/places";
import { relsPersonPlaceState } from "../../atoms/relPersonPlace";
import API from "../../services/api";
import { useDataLoader } from "@/services/dataLoader";
import { userState } from "../../atoms/auth";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";

type PlaceProps = NativeStackScreenProps<RootStackParamList, "PLACE">;

const Place = ({ navigation, route }: PlaceProps) => {
  const [name, setName] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const user = useAtomValue(userState)!;

  const places = useAtomValue(placesState);
  const relsPersonPlace = useAtomValue(relsPersonPlaceState);
  const { refresh } = useDataLoader();

  const placeDB = useMemo(() => places.find((p) => p._id === route.params.place._id)!, [places, route.params.place._id]);

  const backRequestHandledRef = useRef(false);
  const handleBeforeRemove = (e: any) => {
    if (backRequestHandledRef.current === true) return;
    e.preventDefault();
    onGoBackRequested();
  };

  useEffect(() => {
    const beforeRemoveListenerUnsbscribe = navigation.addListener("beforeRemove", handleBeforeRemove);
    return () => {
      beforeRemoveListenerUnsbscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUpdatePlace = async () => {
    setUpdating(true);
    const response = await API.put({
      path: `/place/${placeDB._id}`,
      body: preparePlaceForEncryption({
        name: name.trim(),
        _id: placeDB._id,
        user: placeDB.user || user._id,
        entityKey: placeDB.entityKey,
        createdAt: placeDB.createdAt,
        updatedAt: placeDB.updatedAt,
      }),
      entityType: "place",
      entityId: placeDB._id,
    });
    if (!response.ok) {
      setUpdating(false);
      if (response.error) {
        Alert.alert(response.error);
      }
      return false;
    }
    if (response.ok) {
      await refresh();
      setUpdating(false);
      Alert.alert("Lieu mis à jour !", undefined, [{ text: "OK", onPress: onBack }]);
    }
  };

  const onDeleteRequest = () => {
    Alert.alert("Voulez-vous vraiment supprimer ce lieu ?", "Cette opération est irréversible.", [
      {
        text: "Supprimer",
        style: "destructive",
        onPress: onDelete,
      },
      {
        text: "Annuler",
        style: "cancel",
      },
    ]);
  };

  const onDelete = async () => {
    setDeleting(true);
    const response = await API.delete({
      path: `/place/${placeDB._id}`,
      body: {
        relsPersonPlaceIds: relsPersonPlace.filter((rel) => rel.place === placeDB._id).map((rel) => rel._id),
      },
      entityType: "place",
      entityId: placeDB._id,
    });
    setDeleting(false);
    if (!response.ok) {
      if (response.error) {
        Alert.alert(response.error);
      }
      return;
    }
    if (response.ok) {
      await refresh();
      Alert.alert("Lieu supprimé !");
      onBack();
    }
  };

  const isUpdateDisabled = useMemo(() => placeDB.name === name, [name, placeDB.name]);

  const onBack = () => {
    backRequestHandledRef.current = true;
    navigation.goBack();
  };

  const onGoBackRequested = () => {
    if (isUpdateDisabled) return onBack();
    Alert.alert("Voulez-vous enregistrer ce lieu ?", undefined, [
      {
        text: "Enregistrer",
        onPress: onUpdatePlace,
      },
      {
        text: "Ne pas enregistrer",
        onPress: onBack,
        style: "destructive",
      },
      {
        text: "Annuler",
        style: "cancel",
      },
    ]);
  };

  return (
    <SceneContainer>
      <ScreenTitle title={`${route.params.personName} - Lieu`} onBack={onGoBackRequested} />
      <ScrollContainer>
        <View>
          <InputLabelled label="Nom du lieu" onChangeText={setName} value={name} placeholder="Description" multiline />
          <ButtonsContainer>
            <ButtonDelete onPress={onDeleteRequest} deleting={deleting} />
            <Button caption="Mettre à jour" onPress={onUpdatePlace} disabled={isUpdateDisabled} loading={updating} />
          </ButtonsContainer>
        </View>
      </ScrollContainer>
    </SceneContainer>
  );
};

export default Place;
