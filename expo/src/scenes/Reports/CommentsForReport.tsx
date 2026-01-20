import { useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Sentry from "@sentry/react-native";
import React, { useCallback } from "react";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import { refreshTriggerState } from "../../components/Loader";
import { FlashListStyled } from "../../components/Lists";
import CommentRow from "../Comments/CommentRow";
import { ListEmptyComments, ListNoMoreComments } from "../../components/ListEmptyContainer";
import { useCommentsForReport } from "./selectors";
import { getPeriodTitle } from "./utils";
import { currentTeamState, organisationState } from "../../recoil/auth";
import { commentsState, prepareCommentForEncryption } from "../../recoil/comments";
import { Alert } from "react-native";
import API from "../../services/api";
import { groupsState } from "../../recoil/groups";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { CommentInstance } from "@/types/comment";
import { ActionInstance } from "@/types/action";
import { PersonInstance } from "@/types/person";

const keyExtractor = (item: CommentInstance) => item._id;

type Props = NativeStackScreenProps<RootStackParamList, "COMMENTS_FOR_REPORT">;
const CommentsForReport = ({ navigation, route }: Props) => {
  const date = route?.params?.date;
  const comments = useCommentsForReport(date);
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const currentTeam = useAtomValue(currentTeamState)!;
  const organisation = useAtomValue(organisationState)!;
  const groups = useAtomValue(groupsState);
  const setComments = useSetAtom(commentsState);

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

  const onActionPress = useCallback(
    (action: ActionInstance) => {
      Sentry.setContext("action", { _id: action._id });
      navigation.push("ACTION_STACK", { action });
    },
    [navigation]
  );

  const renderItem = ({ item: comment }: { item: (typeof comments)[number] }) => {
    const commentedItem = comment.type === "action" ? comment.actionPopulated : comment.personPopulated;

    return (
      <CommentRow
        key={comment._id}
        comment={comment}
        canToggleUrgentCheck
        canToggleGroupCheck={
          !!organisation.groupsEnabled &&
          !!comment.personPopulated?._id &&
          !!groups.find((group) => group.persons.includes(comment.personPopulated?._id))
        }
        itemName={
          comment.type === "action"
            ? `Action : ${commentedItem?.name} (pour ${comment.personPopulated?.name})`
            : `Personne suivie : ${commentedItem?.name}`
        }
        onItemNamePress={() => (comment.type === "action" ? onActionPress(comment.actionPopulated!) : onPseudoPress(comment.personPopulated!))}
        onDelete={async () => {
          const response = await API.delete({ path: `/comment/${comment._id}` });
          if (response.error) {
            Alert.alert(response.error);
            return false;
          }
          setComments((comments) => comments.filter((p) => p._id !== comment._id));
          return true;
        }}
        onUpdate={
          comment.team
            ? async (commentUpdated) => {
                if (comment.type === "action") commentUpdated.action = comment.actionPopulated?._id;
                if (comment.type === "person") commentUpdated.person = comment.personPopulated?._id;
                const response = await API.put({
                  path: `/comment/${comment._id}`,
                  body: prepareCommentForEncryption(commentUpdated),
                });
                if (response.error) {
                  Alert.alert(response.error);
                  return false;
                }
                if (response.ok) {
                  setComments((comments) =>
                    comments.map((c) => {
                      if (c._id === comment._id) return response.decryptedData;
                      return c;
                    })
                  );
                  return true;
                }
                return false;
              }
            : undefined
        }
      />
    );
  };

  return (
    <SceneContainer backgroundColor="#fff">
      <ScreenTitle title={`Commentaires \n${getPeriodTitle(date, currentTeam?.nightSession)}`} onBack={navigation.goBack} />
      <FlashListStyled
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        data={comments}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={ListEmptyComments}
        ListFooterComponent={comments.length ? ListNoMoreComments : null}
      />
    </SceneContainer>
  );
};

export default CommentsForReport;
