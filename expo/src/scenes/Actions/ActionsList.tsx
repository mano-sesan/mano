import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as Sentry from "@sentry/react-native";
import { useAtom, useAtomValue } from "jotai";
import { useActionSheet } from "@expo/react-native-action-sheet";
import ActionRow from "../../components/ActionRow";
import Spinner from "../../components/Spinner";
import { ListEmptyActions, ListNoMoreActions } from "../../components/ListEmptyContainer";
import FloatAddButton from "../../components/FloatAddButton";
import { FlashListStyled } from "../../components/Lists";
import { actionsFiltersState, TODO } from "../../recoil/actions";
import { useActionsByStatusAndTimeframeSelector, useTotalActionsByStatusSelector } from "../../recoil/selectors";
import { useIsFocused } from "@react-navigation/native";
import { refreshTriggerState, loadingState } from "../../components/Loader";
import Button from "../../components/Button";
import ConsultationRow from "../../components/ConsultationRow";
import { organisationState, userState } from "../../recoil/auth";
import { Dimensions, View } from "react-native";
import { dayjsInstance } from "../../services/dateDayjs";
import { flattenedServicesSelector } from "../../recoil/reports";
import { ActionsScreenSubTabParams, ActionsScreenTopTabParams } from "@/types/navigation";
import { MaterialTopTabScreenProps } from "@react-navigation/material-top-tabs";
import { ActionInstance } from "@/types/action";
import { PersonInstance } from "@/types/person";

const keyExtractor = (action: ActionInstance) => action._id;

const limitSteps = 100;

type ActionsListProps =
  | MaterialTopTabScreenProps<ActionsScreenSubTabParams, "TODAY" | "PASSED" | "INCOMINGDAYS">
  | MaterialTopTabScreenProps<ActionsScreenTopTabParams, "FAIT" | "ANNULEE">;

export default function ActionsList({ navigation, route }: ActionsListProps) {
  const { showActionSheetWithOptions } = useActionSheet();
  const flattenedServices = useAtomValue(flattenedServicesSelector);
  const organisation = useAtomValue(organisationState)!;
  const filters = useAtomValue(actionsFiltersState);
  const loading = useAtomValue(loadingState);
  const user = useAtomValue(userState)!;

  const { status, timeframe } = route.params;
  const [limit, setLimit] = useState(limitSteps);
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);

  const actionsByStatusAndTimeframe = useActionsByStatusAndTimeframeSelector(status, limit, timeframe, filters);
  const total = useTotalActionsByStatusSelector(status, timeframe, filters);

  const hasMore = useMemo(() => limit < total, [limit, total]);

  const onRefresh = useCallback(async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  }, [setRefreshTrigger]);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused && refreshTrigger.status !== true) onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const onPressFloatingButton = async () => {
    const isConsultationButtonEnabled = user.healthcareProfessional;
    const isServiceButtonEnabled = organisation.receptionEnabled && Boolean(flattenedServices?.length);
    if (!isConsultationButtonEnabled && !isServiceButtonEnabled) {
      navigation.navigate("NewActionForm", { fromRoute: "ActionsList" });
      return;
    }

    const options = ["Ajouter une action"];
    if (isConsultationButtonEnabled) options.push("Ajouter une consultation");
    if (isServiceButtonEnabled) options.push("Ajouter un service");
    options.push("Annuler");
    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
      },
      async (buttonIndex) => {
        if (options[buttonIndex!] === "Ajouter une action") {
          navigation.getParent()?.navigate("ACTION_NEW");
        }
        if (isConsultationButtonEnabled && options[buttonIndex!] === "Ajouter une consultation") {
          navigation.getParent()?.navigate("CONSULTATION", { fromRoute: "ActionsList" });
        }
        if (isServiceButtonEnabled && options[buttonIndex!] === "Ajouter un service") {
          navigation.getParent()?.navigate("SERVICES", { date: dayjsInstance().format("YYYY-MM-DD") });
        }
      }
    );
  };

  const FlatListFooterComponent = useMemo(() => {
    if (hasMore) return <Button caption="Montrer plus d'actions" onPress={() => setLimit((l) => l + limitSteps)} testID="show-more-actions" />;
    return ListNoMoreActions;
  }, [hasMore]);

  const ListEmptyComponent = useMemo(() => (loading ? Spinner : ListEmptyActions), [loading]);

  const onPseudoPress = useCallback(
    (person: PersonInstance) => {
      Sentry.setContext("person", { _id: person._id });
      navigation.getParent()?.navigate("PERSON", { person });
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

  const onConsultationPress = useCallback(
    (consultationDB, personDB) => {
      navigation.navigate("Consultation", { personDB, consultationDB, fromRoute: "ActionsList" });
    },
    [navigation]
  );

  const renderItem = ({ item }) => {
    // if (item.type === 'title') return <SectionHeaderStyled heavy>{item.title}</SectionHeaderStyled>;
    if (item.type === "title") return null;
    if (item.isConsultation) {
      return <ConsultationRow consultation={item} onConsultationPress={onConsultationPress} onPseudoPress={onPseudoPress} withBadge showPseudo />;
    }
    return <ActionRow action={item} onPseudoPress={onPseudoPress} onActionPress={onActionPress} />;
  };

  const getItemType = (item) => item.type || "action";

  return (
    <View
      className="flex-1 h-full"
      style={{
        minHeight: Dimensions.get("window").height - (status === TODO ? 330 : 230),
      }}
    >
      <FlashListStyled
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        data={actionsByStatusAndTimeframe}
        estimatedItemSize={126}
        getItemType={getItemType}
        initialNumToRender={5}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        onEndReachedThreshold={0.3}
        ListFooterComponent={FlatListFooterComponent}
      />
      <FloatAddButton onPress={onPressFloatingButton} />
    </View>
  );
}
