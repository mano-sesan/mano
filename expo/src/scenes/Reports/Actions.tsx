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
import { ActionInstance } from "@/types/action";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { PersonInstance } from "@/types/person";
const keyExtractor = (action: ActionInstance) => action._id;

type Props = NativeStackScreenProps<RootStackParamList, "ACTIONS_FOR_REPORT">;
const Actions = ({ route, navigation }: Props) => {
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const currentTeam = useAtomValue(currentTeamState)!;
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

  const onCreateAction = useCallback(() => navigation.push("ACTION_NEW_STACK"), [navigation]);

  const onPseudoPress = useCallback(
    (person: PersonInstance) => {
      Sentry.setContext("person", { _id: person._id });
      navigation.push("PERSON_STACK", { person });
    },
    [navigation]
  );

  const onActionPress = useCallback(
    (action: ActionInstance) => {
      Sentry.setContext("action", { _id: action._id });
      navigation.push("ACTION_STACK", { action });
    },
    [navigation]
  );

  const renderItem = ({ item: action }: { item: ActionInstance }) => {
    return <ActionRow action={action} onPseudoPress={onPseudoPress} onActionPress={onActionPress} />;
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
        data={actionsToShow}
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


const ListEmptyComponent = () => {
  const loading = useAtomValue(loadingState);
  if (loading) return <Spinner />;
  return <ListEmptyActions />;
};
export default Actions;
