import React, { useCallback, useMemo } from "react";
import * as Sentry from "@sentry/react-native";
import { useAtom, useAtomValue } from "jotai";
import SceneContainer from "../../components/SceneContainer";
import ActionRow from "../../components/ActionRow";
import Spinner from "../../components/Spinner";
import { ListEmptyActions, ListNoMoreActions } from "../../components/ListEmptyContainer";
import FloatAddButton from "../../components/FloatAddButton";
import { FlashListStyled } from "../../components/Lists";
import { refreshTriggerState, loadingState } from "../../components/Loader";
import { useActionsForReport } from "./selectors";
import ScreenTitle from "../../components/ScreenTitle";
import { CANCEL, DONE } from "../../recoil/actions";
import { currentTeamState } from "../../recoil/auth";
import { getPeriodTitle } from "./utils";

const keyExtractor = (action) => action._id;

const Actions = ({ route, navigation }) => {
  const loading = useAtomValue(loadingState);
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const currentTeam = useAtomValue(currentTeamState);
  const { status, date } = route.params;

  const { actionsCreated, actionsCompleted, actionsCanceled } = useActionsForReport(date);

  const actionsToShow = useMemo(() => {
    if (!status) return actionsCreated;
    if (status === DONE) return actionsCompleted;
    if (status === CANCEL) return actionsCanceled;
    return [];
  }, [status, actionsCreated, actionsCompleted, actionsCanceled]);

  const onRefresh = useCallback(async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  }, [setRefreshTrigger]);

  const onCreateAction = useCallback(() => navigation.navigate("NewActionForm", { fromRoute: "Actions" }), [navigation]);

  const ListEmptyComponent = useMemo(() => (loading ? Spinner : ListEmptyActions), [loading]);

  const onPseudoPress = useCallback(
    (person) => {
      Sentry.setContext("person", { _id: person._id });
      navigation.push("Person", { person, fromRoute: "ActionsList" });
    },
    [navigation]
  );

  const onActionPress = useCallback(
    (action) => {
      Sentry.setContext("action", { _id: action._id });
      navigation.push("Action", {
        action,
        fromRoute: "ActionsList",
      });
    },
    [navigation]
  );

  const renderItem = (item) => {
    return <ActionRow action={item.item} onPseudoPress={onPseudoPress} onActionPress={onActionPress} />;
  };

  return (
    <SceneContainer testID="actions-list-for-report" backgroundColor="#fff">
      <ScreenTitle
        title={`Actions ${status === DONE ? "faites" : status === CANCEL ? "annulées" : "créées"}\n${getPeriodTitle(
          date,
          currentTeam?.nightSession
        )}`}
        onBack={navigation.goBack}
      />
      <FlashListStyled
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        estimatedItemSize={126}
        data={actionsToShow}
        initialNumToRender={5}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        onEndReachedThreshold={0.3}
        ListFooterComponent={actionsToShow.length > 0 ? ListNoMoreActions : null}
      />
      <FloatAddButton onPress={onCreateAction} />
    </SceneContainer>
  );
};

export default Actions;
