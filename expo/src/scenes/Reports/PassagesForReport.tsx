import { useAtom, useAtomValue } from "jotai";
import React, { useCallback } from "react";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import { refreshTriggerState } from "../../components/Loader";
import { FlashListStyled } from "../../components/Lists";
import { ListEmptyPassages, ListNoMorePassages } from "../../components/ListEmptyContainer";
import { usePassagesForReport } from "./selectors";
import { getPeriodTitle } from "./utils";
import { currentTeamState } from "../../recoil/auth";
import { itemsGroupedByPersonSelector } from "../../recoil/selectors";
import BubbleRow from "../../components/BubbleRow";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { PassageInstance } from "@/types/passage";

const keyExtractor = (item: PassageInstance) => item._id;

type Props = NativeStackScreenProps<RootStackParamList, "PASSAGES_FOR_REPORT">;
const PassagesForReport = ({ navigation, route }: Props) => {
  const date = route?.params?.date;
  const passages = usePassagesForReport(date);
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const currentTeam = useAtomValue(currentTeamState)!;
  const personsObject = useAtomValue(itemsGroupedByPersonSelector);

  const onRefresh = useCallback(async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  }, [setRefreshTrigger]);

  const renderItem = ({ item: passage }: { item: PassageInstance }) => {
    return (
      <BubbleRow
        caption={passage.comment || ""}
        date={passage.date || passage.createdAt!}
        user={passage.user}
        urgent={false}
        onItemNamePress={() => navigation.push("PERSON_STACK", { person: personsObject[passage.person!] })}
        itemName={personsObject[passage.person!]?.name || personsObject[passage.person!]?.personName || "Passage anonyme"}
        metaCaption="Passage noté par"
      />
    );
  };

  return (
    <SceneContainer backgroundColor="#fff">
      <ScreenTitle title={`Passages \n${getPeriodTitle(date, currentTeam?.nightSession)}`} onBack={navigation.goBack} />
      <FlashListStyled
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        data={passages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={ListEmptyPassages}
        ListFooterComponent={passages.length > 0 ? ListNoMorePassages : null}
      />
    </SceneContainer>
  );
};

export default PassagesForReport;
