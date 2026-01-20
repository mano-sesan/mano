import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import * as Sentry from "@sentry/react-native";
import React, { useCallback, useMemo } from "react";
import { actionsState, TODO } from "../../recoil/actions";
import { currentTeamState } from "../../recoil/auth";
import { commentsState, prepareCommentForEncryption } from "../../recoil/comments";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import { refreshTriggerState } from "../../components/Loader";
import { SectionListStyled } from "../../components/Lists";
import ActionRow from "../../components/ActionRow";
import CommentRow from "../Comments/CommentRow";
import styled from "styled-components/native";
import { MyText } from "../../components/MyText";
import { ListEmptyUrgent, ListEmptyUrgentAction, ListEmptyUrgentComment } from "../../components/ListEmptyContainer";
import { actionsObjectSelector, itemsGroupedByPersonSelector } from "../../recoil/selectors";
import API from "../../services/api";
import { Alert, DefaultSectionT, SectionListData } from "react-native";
import { RootStackParamList, TabsParamsList } from "@/types/navigation";
import { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { PersonInstance, PersonPopulated } from "@/types/person";
import { ActionInstance } from "@/types/action";
import { CommentInstance } from "@/types/comment";

type UrgentAction = ActionInstance & { isAction: true; isComment: false };
interface UrgentComment extends Omit<CommentInstance, "person" | "action"> {
  isComment: true;
  isAction: false;
  actionPopulated?: ActionInstance;
  personPopulated?: PersonPopulated;
}

export const urgentItemsSelector = atom<{ actionsFiltered: UrgentAction[]; commentsFiltered: UrgentComment[] }>((get) => {
  const currentTeam = get(currentTeamState);
  const persons = get(itemsGroupedByPersonSelector) as Record<string, PersonPopulated>;
  const actions = get(actionsState);
  const actionsObject = get(actionsObjectSelector) as Record<string, ActionInstance>;
  const comments = get(commentsState);
  const actionsFiltered: UrgentAction[] = [];
  for (const action of actions) {
    if (Array.isArray(action.teams) ? action.teams.includes(currentTeam?._id!) : action.team === currentTeam?._id!) {
      if (action.status === TODO && action.urgent) {
        actionsFiltered.push({ ...action, isAction: true, isComment: false });
      }
    }
  }
  const commentsFiltered: UrgentComment[] = [];
  for (const comment of comments) {
    if (!comment.urgent) continue;
    if (comment.team !== currentTeam?._id) continue;
    if (!comment.action && !comment.person) continue;
    if (comment.person) {
      commentsFiltered.push({
        ...comment,
        isComment: true,
        isAction: false,
        type: "person",
        personPopulated: persons[comment.person]!,
        actionPopulated: undefined,
      });
    }
    if (comment.action) {
      const id = comment.action;
      const action = actionsObject[id];
      commentsFiltered.push({
        ...comment,
        isComment: true,
        isAction: false,
        type: "action",
        actionPopulated: action!,
        personPopulated: persons[action?.person!]!,
      });
    }
  }

  return { actionsFiltered, commentsFiltered };
});

type NotificationsProps = NativeStackScreenProps<TabsParamsList, "PRIORITÉS">;
const Notifications = ({ navigation }: NotificationsProps) => {
  const { actionsFiltered, commentsFiltered } = useAtomValue(urgentItemsSelector);
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const setComments = useSetAtom(commentsState);

  const onRefresh = useCallback(async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  }, [setRefreshTrigger]);

  const sections = useMemo(
    () => [
      {
        title: "Actions urgentes",
        data: actionsFiltered,
      },
      {
        title: "Commentaires urgents",
        data: commentsFiltered,
      },
    ],
    [actionsFiltered, commentsFiltered]
  );

  const onPseudoPress = useCallback(
    (person: PersonInstance) => {
      Sentry.setContext("person", { _id: person._id });
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>().push("PERSON_STACK", { person });
    },
    [navigation]
  );

  const onActionPress = useCallback(
    (action: ActionInstance) => {
      Sentry.setContext("action", { _id: action._id });
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>().push("ACTION_STACK", {
        action,
      });
    },
    [navigation]
  );

  const renderItem = ({ item }: { item: UrgentAction | UrgentComment }) => {
    if (item.isAction) {
      const action = item as UrgentAction;
      return <ActionRow action={{ ...action, urgent: false }} onPseudoPress={onPseudoPress} onActionPress={onActionPress} />;
    }
    if (item.isComment) {
      const comment = item as UrgentComment;
      const commentedItem = comment.type === "action" ? comment.actionPopulated : comment.personPopulated;
      return (
        <CommentRow
          key={comment._id}
          comment={comment}
          itemName={`${comment.type === "action" ? "Action" : "Personne suivie"} : ${commentedItem?.name}`}
          onItemNamePress={() => (comment.type === "action" ? onActionPress(comment.actionPopulated!) : onPseudoPress(comment.personPopulated!))}
          canToggleUrgentCheck
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
    }
    return null;
  };

  const renderEmptySection = ({
    section,
  }: {
    section: SectionListData<UrgentAction, DefaultSectionT> | SectionListData<UrgentComment, DefaultSectionT>;
  }) => {
    if (!section.data.length) {
      if (section.title === "Actions urgentes") return <ListEmptyUrgentAction />;
      return <ListEmptyUrgentComment />;
    }
    return null;
  };

  return (
    <SceneContainer>
      <ScreenTitle title="Priorités" />
      <SectionListStyled
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        // @ts-expect-error Type 'UrgentComment' is not assignable to type 'UrgentAction'.
        sections={sections}
        initialNumToRender={5}
        renderItem={renderItem}
        renderSectionHeader={SectionHeader}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyUrgent}
        renderSectionFooter={renderEmptySection}
      />
    </SceneContainer>
  );
};

const keyExtractor = (item: UrgentAction | UrgentComment) => item._id;
const SectionHeader = ({ section: { title } }: { section: SectionListData<UrgentAction, DefaultSectionT> }) => (
  <SectionHeaderStyled heavy>{title}</SectionHeaderStyled>
);
const SectionHeaderStyled = styled(MyText)`
  height: 40px;
  line-height: 40px;
  font-size: 25px;
  padding-left: 5%;
  background-color: #fff;
`;

export default Notifications;
