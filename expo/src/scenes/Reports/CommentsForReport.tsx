import { useAtomValue } from "jotai";
import * as Sentry from "@sentry/react-native";
import React, { useCallback } from "react";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import { useDataLoader } from "@/services/dataLoader";
import { FlashListStyled } from "../../components/Lists";
import CommentRow from "../Comments/CommentRow";
import { ListEmptyComments, ListNoMoreComments } from "../../components/ListEmptyContainer";
import { useCommentsForReport } from "./selectors";
import { getPeriodTitle } from "./utils";
import { currentTeamState, organisationState } from "../../atoms/auth";
import { prepareCommentForEncryption } from "../../atoms/comments";
import { Alert } from "react-native";
import API from "../../services/api";
import { groupsState } from "../../atoms/groups";
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
  const { refresh, isLoading } = useDataLoader();
  const currentTeam = useAtomValue(currentTeamState)!;
  const organisation = useAtomValue(organisationState)!;
  const groups = useAtomValue(groupsState);

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
          await refresh();
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
                  await refresh();
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
        refreshing={isLoading}
        onRefresh={refresh}
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
