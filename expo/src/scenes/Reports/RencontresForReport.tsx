import { useAtom, useAtomValue } from "jotai";
import React, { useCallback } from "react";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import { refreshTriggerState } from "../../components/Loader";
import { FlashListStyled } from "../../components/Lists";
import { ListEmptyRencontres, ListNoMoreRencontres } from "../../components/ListEmptyContainer";
import { useRencontresForReport } from "./selectors";
import { getPeriodTitle } from "./utils";
import { currentTeamState } from "../../recoil/auth";
import RencontreRow from "../Persons/RencontreRow";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { RencontreInstance } from "@/types/rencontre";
import { PersonInstance } from "@/types/person";

const keyExtractor = (item: RencontreInstance) => item._id;

type Props = NativeStackScreenProps<RootStackParamList, "RENCONTRES_FOR_REPORT">;
const RencontresForReport = ({ navigation, route }: Props) => {
  const date = route?.params?.date;
  const rencontres = useRencontresForReport(date);
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const currentTeam = useAtomValue(currentTeamState)!;

  const onRefresh = useCallback(async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  }, [setRefreshTrigger]);

  const onUpdateRencontre = async (person: PersonInstance, rencontre: RencontreInstance) => {
    navigation.push("RENCONTRE", { person, rencontre });
  };

  const renderItem = ({ item: rencontre }: { item: RencontreInstance }) => {
    return <RencontreRow rencontre={rencontre} onUpdate={(person) => onUpdateRencontre(person, rencontre)} />;
  };

  return (
    <SceneContainer backgroundColor="#fff">
      <ScreenTitle title={`Rencontres \n${getPeriodTitle(date, currentTeam?.nightSession)}`} onBack={navigation.goBack} />
      <FlashListStyled
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
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
