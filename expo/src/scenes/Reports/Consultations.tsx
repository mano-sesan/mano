import React, { useCallback, useMemo } from "react";
import * as Sentry from "@sentry/react-native";
import { useAtom, useAtomValue } from "jotai";
import SceneContainer from "../../components/SceneContainer";
import Spinner from "../../components/Spinner";
import { ListEmptyConsultations, ListNoMoreConsultations } from "../../components/ListEmptyContainer";
import { FlashListStyled } from "../../components/Lists";
import { refreshTriggerState, loadingState } from "../../components/Loader";
import { useConsultationsForReport } from "./selectors";
import ScreenTitle from "../../components/ScreenTitle";
import { CANCEL, DONE } from "../../recoil/actions";
import { currentTeamState } from "../../recoil/auth";
import { getPeriodTitle } from "./utils";
import ConsultationRow from "../../components/ConsultationRow";
import FloatAddButton from "../../components/FloatAddButton";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { ConsultationInstance } from "@/types/consultation";
import { PersonInstance } from "@/types/person";

const keyExtractor = (consultation: ConsultationInstance) => consultation._id;

type Props = NativeStackScreenProps<RootStackParamList, "CONSULTATIONS_FOR_REPORT">;
const Consultations = ({ route, navigation }: Props) => {
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const currentTeam = useAtomValue(currentTeamState)!;
  const { status, date } = route.params;

  const onCreateConsultation = useCallback(() => navigation.push("CONSULTATION_STACK"), [navigation]);

  const { consultationsCreated, consultationsCompleted, consultationsCanceled } = useConsultationsForReport(date);

  const consultationsToShow = useMemo(() => {
    if (!status) return consultationsCreated;
    if (status === DONE) return consultationsCompleted;
    if (status === CANCEL) return consultationsCanceled;
    return [];
  }, [status, consultationsCreated, consultationsCompleted, consultationsCanceled]);

  const onRefresh = useCallback(async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  }, [setRefreshTrigger]);

  const onPseudoPress = useCallback(
    (person: PersonInstance) => {
      Sentry.setContext("person", { _id: person._id });
      navigation.push("PERSON_STACK", { person });
    },
    [navigation]
  );

  const onConsultationPress = useCallback(
    (consultationDB: ConsultationInstance, personDB: PersonInstance) => {
      navigation.push("CONSULTATION_STACK", { personDB, consultationDB });
    },
    [navigation]
  );

  const renderItem = ({ item: consultation }: { item: ConsultationInstance }) => {
    return (
      <ConsultationRow consultation={consultation} onConsultationPress={onConsultationPress} onPseudoPress={onPseudoPress} withBadge showPseudo />
    );
  };

  return (
    <SceneContainer testID="consultations-list-for-report" backgroundColor="#fff">
      <ScreenTitle
        title={`Consultations ${status === DONE ? "faites" : status === CANCEL ? "annulées" : "créées"}\n${getPeriodTitle(
          date,
          currentTeam?.nightSession
        )}`}
        onBack={navigation.goBack}
      />
      <FlashListStyled
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        data={consultationsToShow}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        onEndReachedThreshold={0.3}
        ListFooterComponent={consultationsToShow.length > 0 ? ListNoMoreConsultations : null}
      />
      <FloatAddButton onPress={onCreateConsultation} />
    </SceneContainer>
  );
};

const ListEmptyComponent = () => {
  const loading = useAtomValue(loadingState);
  if (loading) return <Spinner />;
  return <ListEmptyConsultations />;
};
export default Consultations;
