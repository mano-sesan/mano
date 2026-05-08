import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Alert } from "react-native";
import { useAtomValue, useSetAtom } from "jotai";
import API from "../../services/api";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import Button from "../../components/Button";
import Search from "../../components/Search";
import { FlashListStyled } from "../../components/Lists";
import { ListEmptyCollaboration } from "../../components/ListEmptyContainer";
import Row from "../../components/Row";
import Spacer from "../../components/Spacer";
import { currentTeamState, organisationState, userState } from "../../atoms/auth";
import { getPeriodTitle } from "./utils";
import { prepareReportForEncryption } from "../../atoms/reports";
import { currentTeamReportsSelector } from "./selectors";
import { useDataLoader } from "@/services/dataLoader";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { OrganisationInstance } from "@/types/organisation";

type Props = NativeStackScreenProps<RootStackParamList, "COLLABORATIONS">;
const Collaborations = ({ route, navigation }: Props) => {
  const user = useAtomValue(userState)!;
  const [collaboration, setCollaboration] = useState("");
  const [posting, setPosting] = useState(false);
  const { refresh } = useDataLoader();
  const currentTeam = useAtomValue(currentTeamState)!;
  const teamsReports = useAtomValue(currentTeamReportsSelector);

  const day = route.params?.day;
  const reportDB = useMemo(() => teamsReports.find((r) => r.date === day), [teamsReports, day]);

  const organisation = useAtomValue(organisationState)!;
  const setOrganisation = useSetAtom(organisationState);

  const collaborations = useMemo(() => organisation.collaborations!, [organisation]);
  const data = useMemo(() => {
    if (!collaboration) return collaborations;
    return collaborations.filter((c) => c.toLocaleLowerCase().includes(collaboration.toLocaleLowerCase()));
  }, [collaboration, collaborations]);

  const backRequestHandledRef = useRef(false);
  const handleBeforeRemove = (e: any) => {
    if (backRequestHandledRef.current === true) return;
    e.preventDefault();
    onGoBackRequested();
  };

  useEffect(() => {
    const beforeRemoveListenerUnsbscribe = navigation.addListener("beforeRemove", handleBeforeRemove);
    return () => {
      beforeRemoveListenerUnsbscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreateCollaboration = useCallback(async () => {
    setPosting(true);
    const newCollaborations = [...new Set([...collaborations, collaboration])];
    const response = await API.put({
      path: `/organisation/${organisation._id}/collaborations`,
      body: { collaborations: newCollaborations },
      entityType: "organisation",
      entityId: organisation._id,
    });
    if (!response.ok) {
      setPosting(false);
      if (response.error) {
        Alert.alert(response.error);
      }
      return;
    }
    if (response.ok) {
      setOrganisation(response.data as OrganisationInstance);
      onSubmit(collaboration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collaboration, collaborations, organisation._id, setOrganisation]);

  const onSubmit = async (newCollaboration: string) => {
    setPosting(true);
    const collaborations = [...new Set([...(reportDB?.collaborations || []), newCollaboration])];
    const response = reportDB?._id
      ? await API.put({
          path: `/report/${reportDB?._id}`,
          body: prepareReportForEncryption({ ...reportDB, collaborations, updatedBy: user._id }),
          entityType: "report",
          entityId: reportDB?._id,
        })
      : await API.post({
          path: "/report",
          body: prepareReportForEncryption({ team: currentTeam._id, date: day, collaborations, updatedBy: user._id }),
          entityType: "report",
        });
    if (!response.ok) {
      if (response.error) {
        Alert.alert(response.error);
      }
      return;
    }
    if (response.ok) {
      await refresh();
      onBack();
    }
  };

  const onBack = () => {
    backRequestHandledRef.current = true;
    navigation.goBack();
    setTimeout(() => setPosting(false), 250);
  };

  const isReadyToSave = useMemo(() => {
    if (!collaboration || !collaboration.length || !collaboration.trim().length) return false;
    return true;
  }, [collaboration]);

  const onGoBackRequested = () => {
    if (!isReadyToSave) return onBack();

    if (isReadyToSave) {
      Alert.alert("Voulez-vous enregistrer cette co-intervention ?", undefined, [
        {
          text: "Enregistrer",
          onPress: onCreateCollaboration,
        },
        {
          text: "Ne pas enregistrer",
          onPress: onBack,
          style: "destructive",
        },
        {
          text: "Annuler",
          style: "cancel",
        },
      ]);
      return;
    }
    Alert.alert("Voulez-vous abandonner la création de cette co-intervention ?", undefined, [
      {
        text: "Continuer la création",
      },
      {
        text: "Abandonner",
        onPress: onBack,
        style: "destructive",
      },
    ]);
  };
  const keyExtractor = (c: string) => c;
  const renderRow = ({ item: collaboration }: { item: string }) => <Row onPress={() => onSubmit(collaboration)} caption={collaboration} />;
  const ListHeaderComponent = useMemo(
    () => (
      <>
        <Button caption="Créer" disabled={!isReadyToSave} onPress={onCreateCollaboration} loading={posting} />
        <Spacer height={15} />
      </>
    ),
    [isReadyToSave, onCreateCollaboration, posting]
  );

  return (
    <SceneContainer>
      <ScreenTitle title={`Co-intervention - ${getPeriodTitle(day, currentTeam?.nightSession)}`} onBack={onGoBackRequested} />
      <Search placeholder="Rechercher une co-intervention..." onChange={setCollaboration} />
      <FlashListStyled
        data={data}
        ListHeaderComponent={ListHeaderComponent}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        ListEmptyComponent={collaboration.length ? ListEmptyCollaboration(collaboration) : null}
      />
    </SceneContainer>
  );
};

export default Collaborations;
