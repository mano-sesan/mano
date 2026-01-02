import React from "react";
import { useActionSheet } from "@expo/react-native-action-sheet";
import { Alert } from "react-native";
import { useSetAtom } from "jotai";
import API from "../../services/api";
import BubbleRow from "../../components/BubbleRow";
import { relsPersonPlaceState } from "../../recoil/relPersonPlace";
import { PlaceInstance, RelPersonPlaceInstance } from "@/types/place";
import { PersonPopulated } from "@/types/person";
import { RootStackParamList } from "@/types/navigation";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type PlaceRowProps = {
  place: PlaceInstance;
  relPersonPlace: RelPersonPlaceInstance;
  personDB: PersonPopulated;
  navigation: NativeStackNavigationProp<RootStackParamList, "PERSON_STACK">;
};

const PlaceRow = ({ place, relPersonPlace, personDB, navigation }: PlaceRowProps) => {
  const setRelsPersonPlace = useSetAtom(relsPersonPlaceState);
  const { showActionSheetWithOptions } = useActionSheet();

  const onMorePress = async () => {
    const options = ["Modifier", "Retirer", "Annuler"];
    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: options.findIndex((o) => o === "Retirer"),
      },
      async (buttonIndex) => {
        if (options[buttonIndex!] === "Modifier") {
          navigation.navigate("PLACE", {
            place,
            personName: personDB.name,
          });
        }
        if (options[buttonIndex!] === "Retirer") onRelPersonPlaceRequest();
      }
    );
  };

  const onRelPersonPlaceRequest = () => {
    Alert.alert("Voulez-vous supprimer ce lieu fréquenté ?", "Cette opération est irréversible.", [
      {
        text: "Supprimer",
        style: "destructive",
        onPress: onRelPersonPlaceDelete,
      },
      {
        text: "Annuler",
        style: "cancel",
      },
    ]);
  };

  const onRelPersonPlaceDelete = async () => {
    const response = await API.delete({ path: `/relPersonPlace/${relPersonPlace?._id}` });
    if (response.ok) {
      setRelsPersonPlace((relsPersonPlace) => relsPersonPlace.filter((rel) => rel._id !== relPersonPlace?._id));
    }
    if (!response.ok) return Alert.alert(response.error);
  };

  return (
    <BubbleRow
      onMorePress={onMorePress}
      caption={place.name!}
      date={relPersonPlace.createdAt!}
      user={relPersonPlace.user!}
      metaCaption="Lieu ajouté par"
    />
  );
};

export default PlaceRow;
