import React, { useMemo } from "react";
import { useActionSheet } from "@expo/react-native-action-sheet";
import { Alert } from "react-native";
import { useAtomValue, useSetAtom } from "jotai";
import { userState } from "../../recoil/auth";
import API from "../../services/api";
import BubbleRow from "../../components/BubbleRow";
import { itemsGroupedByPersonSelector } from "../../recoil/selectors";
import { passagesState } from "../../recoil/passages";
import { PassageInstance } from "@/types/passage";
import { PersonPopulated } from "@/types/person";

type PassageRowProps = {
  onUpdate?: (person: PersonPopulated) => void;
  passage: PassageInstance;
  itemName?: string;
  onItemNamePress?: () => void;
};

const PassageRow = ({ onUpdate, passage, itemName, onItemNamePress }: PassageRowProps) => {
  const personsObject = useAtomValue(itemsGroupedByPersonSelector);
  const user = useAtomValue(userState)!;
  const setPassages = useSetAtom(passagesState);
  const person = useMemo(() => (passage?.person ? personsObject[passage.person] : undefined), [personsObject, passage.person]);
  const { showActionSheetWithOptions } = useActionSheet();

  const onMorePress = async () => {
    const options = ["Supprimer", "Annuler"];
    if (onUpdate && passage.user === user._id) options.unshift("Modifier");
    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: options.findIndex((o) => o === "Supprimer"),
      },
      async (buttonIndex) => {
        if (options[buttonIndex!] === "Modifier") onUpdate!(person!);
        if (options[buttonIndex!] === "Supprimer") onPassageDeleteRequest();
      }
    );
  };

  const onPassageDeleteRequest = () => {
    Alert.alert("Voulez-vous supprimer ce passage ?", "Cette opération est irréversible.", [
      {
        text: "Supprimer",
        style: "destructive",
        onPress: onPassageDelete,
      },
      {
        text: "Annuler",
        style: "cancel",
      },
    ]);
  };

  const onPassageDelete = async () => {
    const response = await API.delete({ path: `/passage/${passage._id}` });
    if (!response.ok) return Alert.alert(response.error);
    setPassages((passages) => passages.filter((p) => p._id !== passage._id));
  };

  return (
    <BubbleRow
      onMorePress={onMorePress}
      caption={passage.comment || ""}
      date={passage.date || passage.createdAt!}
      user={passage.user}
      itemName={itemName || person?.name || person?.personName}
      onItemNamePress={onItemNamePress}
      metaCaption="Passage enregistré par"
    />
  );
};

export default PassageRow;
