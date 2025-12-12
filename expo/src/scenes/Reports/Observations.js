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
const keyExtractor = (item) => item._id;

const Observations = ({ navigation, route }) => {
  const { date } = route.params;
  const observations = useObservationsForReport(date);
  const territories = useAtomValue(territoriesState);
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const currentTeam = useAtomValue(currentTeamState);

  const onRefresh = useCallback(async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  }, [setRefreshTrigger]);

  const onUpdatObs = useCallback(
    (obs) => navigation.navigate("TerritoryObservation", { obs, territory: territories.find((t) => t._id === obs.territory), editable: true }),
    [navigation, territories]
  );

  const onTerritoryPress = useCallback((territory) => navigation.push("Territory", { territory }), [navigation]);

  const renderItem = ({ item }) => {
    const obs = item;
    const territory = territories.find((t) => t._id === obs.territory);
    return (
      <TerritoryObservationRow
        key={obs._id}
        observation={obs}
        onUpdate={onUpdatObs}
        territoryToShow={territory}
        onTerritoryPress={onTerritoryPress}
      />
    );
  };

  return (
    <SceneContainer backgroundColor="#fff">
      <ScreenTitle title={`Observations\n${getPeriodTitle(date, currentTeam?.nightSession)}`} onBack={navigation.goBack} />
      <FlashListStyled
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        data={observations}
        initialNumToRender={5}
        renderItem={renderItem}
        estimatedItemSize={545}
        keyExtractor={keyExtractor}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={ListEmptyObservations}
        ListFooterComponent={observations.length > 0 ? ListNoMoreObservations : null}
      />
    </SceneContainer>
  );
};

export default Observations;
