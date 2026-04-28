import React, { useMemo, useState, useCallback } from "react";
import { Alert } from "react-native";
import { useAtomValue } from "jotai";
import API from "../../services/api";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import Button from "../../components/Button";
import Search from "../../components/Search";
import { FlashListStyled } from "../../components/Lists";
import { ListEmptyPlaceWithName } from "../../components/ListEmptyContainer";
import Row from "../../components/Row";
import Spacer from "../../components/Spacer";
import { placesState, preparePlaceForEncryption } from "../../atoms/places";
import { prepareRelPersonPlaceForEncryption } from "../../atoms/relPersonPlace";
import { userState } from "../../atoms/auth";
import { useDataLoader } from "@/services/dataLoader";
import { sortByName } from "../../utils/sortByName";
import { RootStackParamList } from "@/types/navigation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PlaceInstance } from "@/types/place";

type PlaceNewProps = NativeStackScreenProps<RootStackParamList, "PLACE_NEW">;

const PlaceNew = ({ route, navigation }: PlaceNewProps) => {
  const [name, setName] = useState("");
  const [posting, setPosting] = useState(false);

  const places = useAtomValue(placesState);
  const user = useAtomValue(userState)!;

  const data = useMemo(() => {
    if (!name) return places;
    return places.filter((p) => p?.name?.toLocaleLowerCase().includes(name?.toLocaleLowerCase()));
  }, [name, places]);

  const { person } = route.params;

  const { refresh, isLoading } = useDataLoader();

  const onSubmit = useCallback(
    async (place: PlaceInstance) => {
      if (posting) return;
      if (person.relsPersonPlace?.find((rpp) => rpp.place === place._id)) {
        Alert.alert("Ce lieu est déjà enregistré pour cette personne");
        return;
      }
      //
      setPosting(true);

      const response = await API.post({
        path: "/relPersonPlace",
        body: prepareRelPersonPlaceForEncryption({ place: place._id, person: person._id, user: user._id }),
        entityType: "relPersonPlace",
      });
      if (response.error) {
        setPosting(false);
        Alert.alert(response.error);
        return;
      }
      if (response.ok) {
        await refresh();
        navigation.goBack();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posting, person.relsPersonPlace, person._id, user._id, navigation]
  );

  const onCreatePlace = useCallback(async () => {
    setPosting(true);
    const response = await API.post({ path: "/place", body: preparePlaceForEncryption({ name, user: user._id }), entityType: "place" });
    if (response.error) {
      setPosting(false);
      Alert.alert(response.error);
      return;
    }
    if (response.ok) {
      await refresh();
      onSubmit(response.decryptedData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, user._id, onSubmit]);

  const isReadyToSave = !!name?.trim()?.length;
  const keyExtractor = (place: PlaceInstance) => place._id;
  const renderRow = ({ item: place }: { item: PlaceInstance }) => <Row onPress={() => onSubmit(place)} caption={place.name} />;
  const ListHeaderComponent = useMemo(
    () => (
      <>
        <Button caption="Créer" disabled={!isReadyToSave} onPress={onCreatePlace} loading={posting} />
        <Spacer height={15} />
      </>
    ),
    [isReadyToSave, onCreatePlace, posting]
  );

  return (
    <SceneContainer>
      <ScreenTitle title={`Nouveau lieu - ${person.name}`} onBack={() => navigation.goBack()} />
      <Search placeholder="Rechercher un lieu..." onChange={setName} />
      <FlashListStyled
        data={data}
        key={JSON.stringify(data) + posting}
        refreshing={isLoading}
        ListHeaderComponent={ListHeaderComponent}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        ListEmptyComponent={name.length ? ListEmptyPlaceWithName(name) : null}
      />
    </SceneContainer>
  );
};

export default PlaceNew;
