import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as Sentry from "@sentry/react-native";
import { useAtom, useAtomValue } from "jotai";
import { connectActionSheet } from "@expo/react-native-action-sheet";
import ActionRow from "../../components/ActionRow";
import Spinner from "../../components/Spinner";
import { ListEmptyActions, ListNoMoreActions } from "../../components/ListEmptyContainer";
import FloatAddButton from "../../components/FloatAddButton";
import { FlashListStyled } from "../../components/Lists";
import { actionsFiltersState, TODO } from "../../recoil/actions";
import { useActionsByStatusAndTimeframeSelector, useTotalActionsByStatusSelector } from "../../recoil/selectors";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { refreshTriggerState, loadingState } from "../../components/Loader";
import Button from "../../components/Button";
import ConsultationRow from "../../components/ConsultationRow";
import { organisationState, userState } from "../../recoil/auth";
import { Dimensions, View } from "react-native";
import { dayjsInstance } from "../../services/dateDayjs";
import { flattenedServicesSelector } from "../../recoil/reports";

const keyExtractor = (action) => action._id;

const limitSteps = 100;

const ActionsList = ({ showActionSheetWithOptions }) => {
  const flattenedServices = useAtomValue(flattenedServicesSelector);
  const organisation = useAtomValue(organisationState);
  const filters = useAtomValue(actionsFiltersState);
  const navigation = useNavigation();
  const loading = useAtomValue(loadingState);
  const user = useAtomValue(userState);
  const route = useRoute();

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
        if (options[buttonIndex] === "Ajouter une action") {
          navigation.push("NewActionForm", { fromRoute: "ActionsList" });
        }
        if (isConsultationButtonEnabled && options[buttonIndex] === "Ajouter une consultation") {
          navigation.push("Consultation", { fromRoute: "ActionsList" });
        }
        if (isServiceButtonEnabled && options[buttonIndex] === "Ajouter un service") {
          navigation.navigate("Services", { date: dayjsInstance().format("YYYY-MM-DD") });
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
};

export default connectActionSheet(ActionsList);
