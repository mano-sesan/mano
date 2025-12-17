import { useAtom, useAtomValue } from "jotai";
import React, { useCallback } from "react";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import { refreshTriggerState } from "../../components/Loader";
import { FlashListStyled } from "../../components/Lists";
import { ListEmptyObservations, ListNoMoreObservations } from "../../components/ListEmptyContainer";
import { useObservationsForReport } from "./selectors";
import { getPeriodTitle } from "./utils";
import { currentTeamState } from "../../recoil/auth";
import TerritoryObservationRow from "../Territories/TerritoryObservationRow";
import { territoriesState } from "../../recoil/territory";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { TerritoryObservationInstance } from "@/types/territoryObs";
import { TerritoryInstance } from "@/types/territory";
const keyExtractor = (item: TerritoryObservationInstance) => item._id;

type Props = NativeStackScreenProps<RootStackParamList, "TERRITORY_OBSERVATIONS_FOR_REPORT">;
const ObservationsForReport = ({ navigation, route }: Props) => {
  const { date } = route.params;
  const observations = useObservationsForReport(date);
  const territories = useAtomValue(territoriesState);
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const currentTeam = useAtomValue(currentTeamState)!;

  const onRefresh = useCallback(async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  }, [setRefreshTrigger]);

  const onUpdatObs = useCallback(
    (obs: TerritoryObservationInstance) =>
      navigation.push("TERRITORY_OBSERVATION", { obs, territory: territories.find((t) => t._id === obs.territory)!, editable: true }),
    [navigation, territories]
  );

  const onTerritoryPress = useCallback((territory: TerritoryInstance) => navigation.push("TERRITORY", { territory }), [navigation]);

  const renderItem = ({ item: obs }: { item: TerritoryObservationInstance }) => {
    const territory = territories.find((t) => t._id === obs.territory);
    return <TerritoryObservationRow observation={obs} onUpdate={onUpdatObs} territoryToShow={territory} onTerritoryPress={onTerritoryPress} />;
  };

  return (
    <SceneContainer backgroundColor="#fff">
      <ScreenTitle title={`Observations\n${getPeriodTitle(date, currentTeam?.nightSession)}`} onBack={navigation.goBack} />
      <FlashListStyled
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        data={observations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={ListEmptyObservations}
        ListFooterComponent={observations.length > 0 ? ListNoMoreObservations : null}
      />
    </SceneContainer>
  );
};

export default ObservationsForReport;
