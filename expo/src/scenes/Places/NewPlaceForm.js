import React, { useMemo, useState, useCallback } from "react";
import { Alert } from "react-native";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import API from "../../services/api";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import Button from "../../components/Button";
import Search from "../../components/Search";
import { FlashListStyled } from "../../components/Lists";
import { ListEmptyPlaceWithName } from "../../components/ListEmptyContainer";
import Row from "../../components/Row";
import Spacer from "../../components/Spacer";
import { placesState, preparePlaceForEncryption } from "../../recoil/places";
import { prepareRelPersonPlaceForEncryption, relsPersonPlaceState } from "../../recoil/relPersonPlace";
import { userState } from "../../recoil/auth";
import { refreshTriggerState } from "../../components/Loader";
import { sortByName } from "../../utils/sortByName";

const NewPlaceForm = ({ route, navigation }) => {
  const [name, setName] = useState("");
  const [posting, setPosting] = useState(false);

  const [places, setPlaces] = useAtom(placesState);
  const setRelsPersonPlace = useSetAtom(relsPersonPlaceState);
  const user = useAtomValue(userState);

  const data = useMemo(() => {
    if (!name) return places;
    return places.filter((p) => p?.name?.toLocaleLowerCase().includes(name?.toLocaleLowerCase()));
  }, [name, places]);

  const { person } = route.params;

  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const onCreatePlace = useCallback(async () => {
    setPosting(true);
    const response = await API.post({ path: "/place", body: preparePlaceForEncryption({ name, user: user._id }) });
    if (response.error) {
      setPosting(false);
      Alert.alert(response.error);
      return;
    }
    if (response.ok) {
      setPlaces((places) => [response.decryptedData, ...places].sort(sortByName));
      onSubmit(response.decryptedData);
    }
  }, [name, setPlaces, user._id, onSubmit]);

  const onSubmit = useCallback(
    async (place) => {
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
      });
      if (response.error) {
        setPosting(false);
        Alert.alert(response.error);
        return;
      }
      if (response.ok) {
        setRelsPersonPlace((relsPersonPlace) => [response.decryptedData, ...relsPersonPlace]);
        setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
        navigation.goBack();
      }
    },
    [posting, person.relsPersonPlace, person._id, user._id, setRelsPersonPlace, setRefreshTrigger, navigation]
  );

  const isReadyToSave = !!name?.trim()?.length;
  const keyExtractor = (place) => place._id;
  const renderRow = ({ item: place }) => <Row onPress={() => onSubmit(place)} caption={place.name} />;
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
      <Search results={data} placeholder="Rechercher un lieu..." onChange={setName} />
      <FlashListStyled
        data={data}
        key={JSON.stringify(data) + posting}
        refreshing={refreshTrigger.status}
        estimatedItemSize={77}
        ListHeaderComponent={ListHeaderComponent}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        ListEmptyComponent={name.length ? ListEmptyPlaceWithName(name) : null}
      />
    </SceneContainer>
  );
};

export default NewPlaceForm;
