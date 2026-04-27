import { useAtomValue } from "jotai";
import React from "react";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import { FlashListStyled } from "../../components/Lists";
import { ListEmptyRencontres, ListNoMoreRencontres } from "../../components/ListEmptyContainer";
import { useRencontresForReport } from "./selectors";
import { getPeriodTitle } from "./utils";
import { currentTeamState } from "../../atoms/auth";
import RencontreRow from "../Persons/RencontreRow";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { RencontreInstance } from "@/types/rencontre";
import { PersonInstance } from "@/types/person";
import { useDataLoader } from "@/services/dataLoader";

const keyExtractor = (item: RencontreInstance) => item._id;

type Props = NativeStackScreenProps<RootStackParamList, "RENCONTRES_FOR_REPORT">;
const RencontresForReport = ({ navigation, route }: Props) => {
  const date = route?.params?.date;
  const rencontres = useRencontresForReport(date);
  const currentTeam = useAtomValue(currentTeamState)!;
  const { refresh, isLoading } = useDataLoader();

  const onUpdateRencontre = async (person: PersonInstance, rencontre: RencontreInstance) => {
    navigation.push("RENCONTRE", { person, rencontre });
  };

  const renderItem = ({ item: rencontre }: { item: RencontreInstance }) => {
    return (
      <RencontreRow
        rencontre={rencontre}
        onUpdate={(person) => onUpdateRencontre(person, rencontre)}
        onPersonPress={(person) => navigation.push("PERSON_STACK", { person })}
      />
    );
  };

  return (
    <SceneContainer backgroundColor="#fff">
      <ScreenTitle title={`Rencontres \n${getPeriodTitle(date, currentTeam?.nightSession)}`} onBack={navigation.goBack} />
      <FlashListStyled
        refreshing={isLoading}
        onRefresh={refresh}
        data={rencontres}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={ListEmptyRencontres}
        ListFooterComponent={rencontres.length > 0 ? ListNoMoreRencontres : null}
      />
    </SceneContainer>
  );
};

export default RencontresForReport;
