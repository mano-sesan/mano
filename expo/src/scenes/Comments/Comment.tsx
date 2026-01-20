import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";
import ScrollContainer from "../../components/ScrollContainer";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import InputLabelled from "../../components/InputLabelled";
import Button from "../../components/Button";
import ButtonsContainer from "../../components/ButtonsContainer";
import ButtonDelete from "../../components/ButtonDelete";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { commentsState, prepareCommentForEncryption } from "../../recoil/comments";
import { currentTeamState, organisationState, userState } from "../../recoil/auth";
import API from "../../services/api";
import CheckboxLabelled from "../../components/CheckboxLabelled";
import { groupsState } from "../../recoil/groups";
import DateAndTimeInput from "../../components/DateAndTimeInput";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { dayjsInstance } from "@/services/dateDayjs";
import { refreshTriggerState } from "@/components/Loader";
import { Dayjs } from "dayjs";

type CommentProps = NativeStackScreenProps<RootStackParamList, "COMMENT">;
// NOTE: this component is only used to create a new comment from a person row. No CRUD, only creation.

const Comment = ({ navigation, route }: CommentProps) => {
  const currentTeam = useAtomValue(currentTeamState);
  const user = useAtomValue(userState);
  const organisation = useAtomValue(organisationState)!;
  const setRefreshTrigger = useSetAtom(refreshTriggerState);
  const groups = useAtomValue(groupsState);
  const isNewComment = true;
  const [comment, setComment] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [date, setDate] = useState(dayjsInstance());
  const [group, setGroup] = useState(false);
  const [updating, setUpdating] = useState(false);

  const isUpdateDisabled = useMemo(() => {
    if (!comment) return true;
    if (!date) return true;
    return false;
  }, [comment, date]);

  const onCreateComment = async () => {
    setUpdating(true);
    const response = await API.post({
      path: "/comment",
      body: prepareCommentForEncryption({
        comment: comment.trim(),
        person: route.params?.person?._id,
        user: user?._id,
        team: currentTeam?._id,
        urgent,
      }),
    });

    if (response.error) {
      setUpdating(false);
      Alert.alert(response.error);
      return false;
    }
    if (response.ok) {
      setUpdating(false);
      Alert.alert("Commentaire ajouté", undefined, [{ text: "OK", onPress: onBack }]);
    }
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
    return response;
  };

  const onBack = () => {
    backRequestHandledRef.current = true;
    navigation.goBack();
  };

  const onGoBackRequested = () => {
    if (isUpdateDisabled) {
      onBack();
      return;
    }
    Alert.alert("Voulez-vous enregistrer ce commentaire ?", undefined, [
      {
        text: "Enregistrer",
        onPress: onCreateComment,
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
  };

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

  const canToggleGroupCheck = !!organisation.groupsEnabled && groups.find((group) => group.persons.includes(route.params?.person?._id));

  return (
    <SceneContainer>
      <ScreenTitle title={`${route?.params?.commentTitle} - Commentaire`} onBack={onGoBackRequested} testID="comment" />
      <ScrollContainer>
        <View>
          <InputLabelled label="Commentaire" onChangeText={setComment} value={comment} placeholder="Description" multiline />
          <CheckboxLabelled
            _id="urgent"
            label="Commentaire prioritaire (ce commentaire sera mis en avant par rapport aux autres)"
            alone
            onPress={() => setUrgent((u) => !u)}
            value={urgent}
          />
          {!isNewComment && (
            <DateAndTimeInput label="Créé le / Concerne le" setDate={(a) => setDate(a as Dayjs)} date={date} showTime showDay withTime />
          )}
          {!!canToggleGroupCheck && (
            <CheckboxLabelled
              _id="group"
              label="Commentaire familial (ce commentaire sera visible pour toute la famille)"
              alone
              onPress={() => setGroup((g) => !g)}
              value={group}
            />
          )}
          <ButtonsContainer>
            <Button caption={"Créer"} onPress={onCreateComment} disabled={isUpdateDisabled} loading={updating} />
          </ButtonsContainer>
        </View>
      </ScrollContainer>
    </SceneContainer>
  );
};

export default Comment;
