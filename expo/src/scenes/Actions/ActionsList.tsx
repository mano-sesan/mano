import React, { useCallback, useMemo, useState } from "react";
import * as Sentry from "@sentry/react-native";
import { useAtomValue } from "jotai";
import ActionRow from "../../components/ActionRow";
import Spinner from "../../components/Spinner";
import { ListEmptyActions, ListNoMoreActions } from "../../components/ListEmptyContainer";
import { FlashListStyled } from "../../components/Lists";
import { actionsFiltersState, TODO } from "../../atoms/actions";
import { useActionsByStatusAndTimeframeSelector, useTotalActionsByStatusSelector } from "../../atoms/selectors";
import Button from "../../components/Button";
import ConsultationRow from "../../components/ConsultationRow";
import { Dimensions, View } from "react-native";
import { ActionsScreenSubTabParams, ActionsScreenTopTabParams, RootStackParamList } from "@/types/navigation";
import { MaterialTopTabScreenProps } from "@react-navigation/material-top-tabs";
import { ActionInstance } from "@/types/action";
import { PersonInstance } from "@/types/person";
import { ConsultationInstance } from "@/types/consultation";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDataLoader } from "@/services/dataLoader";
import useRefreshOnFocus from "@/utils/refresh-on-focus";

const keyExtractor = (item: ActionInstance | ConsultationInstance) => item._id;

const limitSteps = 100;

type ActionsListProps =
  | MaterialTopTabScreenProps<ActionsScreenSubTabParams, "TODAY" | "PASSED" | "INCOMINGDAYS">
  | MaterialTopTabScreenProps<ActionsScreenTopTabParams, "FAIT" | "ANNULEE">;

export default function ActionsList({ navigation, route }: ActionsListProps) {
  const filters = useAtomValue(actionsFiltersState);

  const { status, timeframe } = route.params;
  const [limit, setLimit] = useState(limitSteps);

  const actionsByStatusAndTimeframe = useActionsByStatusAndTimeframeSelector(status, limit, timeframe, filters) as Array<
    ActionInstance | ConsultationInstance
  >;
  const total = useTotalActionsByStatusSelector(status, timeframe, filters);

  const hasMore = useMemo(() => limit < total, [limit, total]);

  const { refresh, isLoading } = useDataLoader();
  useRefreshOnFocus();

  const FlatListFooterComponent = useMemo(() => {
    if (hasMore) return <Button caption="Montrer plus d'actions" onPress={() => setLimit((l) => l + limitSteps)} testID="show-more-actions" />;
    return ListNoMoreActions;
  }, [hasMore]);

  const onPseudoPress = useCallback(
    (person: PersonInstance) => {
      Sentry.setContext("person", { _id: person._id });
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>().navigate("PERSON_STACK", { person });
    },
    [navigation]
  );

  const onActionPress = useCallback(
    (action: ActionInstance) => {
      Sentry.setContext("action", { _id: action._id });
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>().push("ACTION_STACK", { action });
    },
    [navigation]
  );

  const onConsultationPress = useCallback(
    (consultationDB: ConsultationInstance, personDB: PersonInstance) => {
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>().push("CONSULTATION_STACK", { personDB, consultationDB });
    },
    [navigation]
  );

  const renderItem = ({ item }: { item: ActionInstance | ConsultationInstance }) => {
    if (item.isConsultation) {
      return (
        <ConsultationRow
          consultation={item as ConsultationInstance}
          onConsultationPress={onConsultationPress}
          onPseudoPress={onPseudoPress}
          withBadge
          showPseudo
          testID="consultation"
        />
      );
    }
    return <ActionRow action={item as ActionInstance} onPseudoPress={onPseudoPress} onActionPress={onActionPress} testID="action" />;
  };

  return (
    <View
      className="flex-1 h-full"
      style={{
        minHeight: Dimensions.get("window").height - (status === TODO ? 330 : 230),
      }}
    >
      <FlashListStyled
        refreshing={isLoading}
        onRefresh={refresh}
        data={actionsByStatusAndTimeframe}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        onEndReachedThreshold={0.3}
        ListFooterComponent={FlatListFooterComponent}
      />
    </View>
  );
}

const ListEmptyComponent = () => {
  const { isLoading } = useDataLoader();
  if (isLoading) return <Spinner />;
  return <ListEmptyActions />;
};
