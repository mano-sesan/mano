import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Alert, Animated, Keyboard, KeyboardAvoidingView, TouchableOpacity, View } from "react-native";
import * as Sentry from "@sentry/react-native";
import isEqual from "react-fast-compare";
import styled from "styled-components/native";
import ScrollContainer from "../../components/ScrollContainer";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import InputLabelled from "../../components/InputLabelled";
import Button from "../../components/Button";
import ButtonsContainer from "../../components/ButtonsContainer";
import ButtonDelete from "../../components/ButtonDelete";
import InputFromSearchList from "../../components/InputFromSearchList";
import DateAndTimeInput from "../../components/DateAndTimeInput";
import CommentRow from "../Comments/CommentRow";
import ActionStatusSelect from "../../components/Selects/ActionStatusSelect";
import UserName from "../../components/UserName";
import Spacer from "../../components/Spacer";
import NewCommentInput from "../../scenes/Comments/NewCommentInput";
import ActionCategoriesModalSelect from "../../components/ActionCategoriesModalSelect";
import Label from "../../components/Label";
import Tags from "../../components/Tags";
import { MyText } from "../../components/MyText";
import { actionsState, DONE, CANCEL, TODO, prepareActionForEncryption, allowedActionFieldsInHistory } from "../../recoil/actions";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { commentsState, prepareCommentForEncryption } from "../../recoil/comments";
import API from "../../services/api";
import { currentTeamState, organisationState, userState } from "../../recoil/auth";
import { capture } from "../../services/sentry";
import CheckboxLabelled from "../../components/CheckboxLabelled";
import { groupsState } from "../../recoil/groups";
import { useFocusEffect } from "@react-navigation/native";
import { itemsGroupedByPersonSelector } from "../../recoil/selectors";
import { refreshTriggerState } from "../../components/Loader";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import DocumentsManager from "../../components/DocumentsManager";
import { isEmptyValue } from "../../utils";
import { alertCreateComment } from "../../utils/alert-create-comment";

const Tab = createMaterialTopTabNavigator();

const castToAction = (action) => {
  if (!action) action = {};
  return {
    name: action.name?.trim() || "",
    description: action.description?.trim()?.split("\\n").join("\u000A") || "",
    person: action.person || null,
    categories: action.categories || [],
    user: action.user || null,
    status: action.status || TODO,
    dueAt: action.dueAt || null,
    withTime: action.withTime || false,
    urgent: action.urgent || false,
    group: action.group || false,
    completedAt: action.completedAt || null,
    entityKey: action.entityKey || "",
    teams: action.teams || (action.team ? [action.team] : undefined),
    history: action.history || [],
    documents: action.documents || [],
  };
};

const ActionInformation = ({
  action,
  persons,
  editable,
  setEditable,
  setAction,
  onSearchPerson,
  updating,
  isUpdateDisabled,
  onUpdateRequest,
  onDeleteRequest,
  canToggleGroupCheck,
  canDelete,
  canSetUrgent,
}) => {
  const { name, dueAt, withTime, description, categories, status, urgent, group, completedAt } = action;

  return (
    <ScrollContainer noRadius>
      {!!action.user && <UserName metaCaption="Action ajoutée par" id={action.user?._id || action.user} />}
      {!editable && urgent ? <Urgent bold>❗ Action prioritaire</Urgent> : null}
      <InputLabelled
        label="Nom de l'action"
        onChangeText={(name) => setAction((a) => ({ ...a, name }))}
        value={name}
        placeholder="Nom de l'action"
        editable={editable}
        testID="action-name"
      />
      {persons.length < 2 ? (
        <InputFromSearchList
          label="Personne concernée"
          value={persons[0]?.name || "-- Aucune --"}
          onSearchRequest={onSearchPerson}
          editable={editable}
        />
      ) : (
        <>
          <Label label="Personne(s) concerné(es)" />
          <Tags
            data={persons}
            onChange={(persons) => setAction((a) => ({ ...a, persons }))}
            onAddRequest={onSearchPerson}
            renderTag={(person) => <MyText>{person?.name}</MyText>}
          />
        </>
      )}
      <ActionStatusSelect
        onSelect={(status) => setAction((a) => ({ ...a, status }))}
        onSelectAndSave={(status) => {
          setAction((a) => ({ ...a, status }));
        }}
        value={status}
        editable={editable}
      />
      <DateAndTimeInput
        label="À faire le"
        setDate={(dueAt) => setAction((a) => ({ ...a, dueAt }))}
        date={dueAt}
        showTime
        showDay
        withTime={withTime}
        setWithTime={(withTime) => setAction((a) => ({ ...a, withTime }))}
        editable={editable}
      />
      {status !== TODO ? (
        <DateAndTimeInput
          label={status === DONE ? "Faite le" : "Annulée le"}
          setDate={(completedAt) => setAction((a) => ({ ...a, completedAt: completedAt }))}
          date={completedAt || new Date().toISOString()}
          showTime
          showDay
          withTime={withTime}
          setWithTime={(withTime) => setAction((a) => ({ ...a, withTime }))}
          editable={editable}
        />
      ) : null}
      <InputLabelled
        label="Description"
        onChangeText={(description) => setAction((a) => ({ ...a, description }))}
        value={description}
        placeholder="Description"
        multiline
        editable={editable}
      />
      <ActionCategoriesModalSelect onChange={(categories) => setAction((a) => ({ ...a, categories }))} values={categories} editable={editable} />
      {editable && canSetUrgent ? (
        <CheckboxLabelled
          label="Action prioritaire (cette action sera mise en avant par rapport aux autres)"
          alone
          onPress={() => setAction((a) => ({ ...a, urgent: !a.urgent }))}
          value={urgent}
        />
      ) : null}
      {editable && !!canToggleGroupCheck ? (
        <CheckboxLabelled
          label="Action familiale (cette action sera à effectuer pour toute la famille)"
          alone
          onPress={() => setAction((a) => ({ ...a, group: !a.group }))}
          value={group}
        />
      ) : null}

      {!editable && <Spacer />}
      <ButtonsContainer>
        {canDelete && <ButtonDelete onPress={onDeleteRequest} />}
        <Button
          caption={editable ? "Mettre à jour" : "Modifier"}
          onPress={editable ? onUpdateRequest : () => setEditable(true)}
          disabled={editable ? isUpdateDisabled : false}
          loading={updating}
        />
      </ButtonsContainer>
    </ScrollContainer>
  );
};

const ActionComments = ({ actionDB, actionComments, comments, setComments, canComment, newCommentRef, setWritingComment }) => {
  return (
    <ScrollContainer noRadius>
      {!!canComment && (
        <View className="flex-shrink-0 my-2.5">
          <NewCommentInput
            forwardRef={newCommentRef}
            canToggleUrgentCheck
            onCommentWrite={setWritingComment}
            onCreate={async (newComment) => {
              const body = {
                ...newComment,
                action: actionDB?._id,
              };
              const response = await API.post({ path: "/comment", body: prepareCommentForEncryption(body) });
              if (!response.ok) {
                Alert.alert(response.error || response.code);
                return;
              }
              Keyboard.dismiss();
              setComments((comments) => [response.decryptedData, ...comments]);
            }}
          />
        </View>
      )}
      {actionComments.length ? (
        actionComments.map((comment) => (
          <CommentRow
            key={comment._id}
            comment={comment}
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
                    commentUpdated.action = actionDB?._id;
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
                  }
                : null
            }
          />
        ))
      ) : (
        <EmptyContainer>
          <Empty>Pas encore de commentaire</Empty>
        </EmptyContainer>
      )}
    </ScrollContainer>
  );
};

const Action = ({ navigation, route }) => {
  const actions = useAtomValue(actionsState);
  const setRefreshTrigger = useSetAtom(refreshTriggerState);
  const user = useAtomValue(userState);
  const organisation = useAtomValue(organisationState);
  const allPersonsObject = useAtomValue(itemsGroupedByPersonSelector);
  const groups = useAtomValue(groupsState);
  const [comments, setComments] = useAtom(commentsState);
  const currentTeam = useAtomValue(currentTeamState);

  const actionDB = useMemo(() => {
    let existingAction = actions.find((a) => a._id === route.params?.action?._id);
    if (!existingAction) existingAction = route.params?.action;
    return Object.assign({}, castToAction(existingAction), { _id: existingAction._id });
  }, [actions, route.params?.action]);

  const [action, setAction] = useState(() => castToAction(actionDB));

  useEffect(() => {
    setAction(castToAction(actionDB));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionDB?.updatedAt]);

  const [multipleActions] = useState(() => route?.params?.actions);
  const isMultipleActions = multipleActions?.length > 1;
  const canComment = !isMultipleActions && ["admin", "normal"].includes(user.role);

  const persons = useMemo(() => {
    if (isMultipleActions) {
      return multipleActions?.map((a) => allPersonsObject[a.person]);
    } else if (action.person) {
      return [allPersonsObject[action.person]];
    }
    return [];
  }, [isMultipleActions, multipleActions, allPersonsObject, action?.person]);

  const [updating, setUpdating] = useState(false);
  const [writingComment, setWritingComment] = useState("");
  const [editable, setEditable] = useState(route?.params?.editable || false);

  useEffect(() => {
    if (route?.params?.duplicate) {
      Alert.alert(
        "L'action est dupliquée, vous pouvez la modifier !",
        "Les commentaires de l'action aussi sont dupliqués. L'action originale est annulée"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isUpdateDisabled = useMemo(() => {
    // On ne compare pas les documents et l'historique qui sont gérés par ailleurs
    const newAction = { ...actionDB, ...castToAction(action) };
    const { documents: documentsA, history: historyA, ...actionDBWithoutDocs } = actionDB;
    const { documents: documentsB, history: historyB, ...newActionWithoutDocs } = newAction;
    if (JSON.stringify(actionDBWithoutDocs) !== JSON.stringify(newActionWithoutDocs)) return false;
    return true;
  }, [actionDB, action]);

  const backRequestHandledRef = useRef(false);
  const onBack = async () => {
    backRequestHandledRef.current = true;
    Sentry.setContext("action", {});
    navigation.goBack();
    setUpdating(false);
  };

  const onGoBackRequested = async () => {
    if (!action.dueAt) {
      Alert.alert("Vous devez rentrer une date d'échéance");
      setUpdating(false);
      setUpdating(false);
    }

    if (writingComment.length) {
      const goToNextStep = await alertCreateComment();
      if (!goToNextStep) return;
    }
    if (isUpdateDisabled) {
      onBack();
      return true;
    }
    Alert.alert("Voulez-vous enregistrer cette action ?", null, [
      {
        text: "Enregistrer",
        onPress: onUpdateRequest,
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

  const onSearchPerson = () => navigation.push("PersonsSearch", { ...route.params, fromRoute: "Action" }, { merge: true });

  const handleBeforeRemove = (e) => {
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
  }, [route?.params?.person]);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.person) {
        setAction((a) => ({ ...a, person: route.params.person?._id }));
      }
    }, [route?.params?.person])
  );

  const onRefresh = async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  };

  const updateAction = async (action) => {
    if (!action.name.trim()?.length && !action.categories.length) {
      Alert.alert("L'action doit avoir au moins un nom ou une catégorie");
      setUpdating(false);
      return false;
    }
    if (!action.dueAt) {
      Alert.alert("Vous devez rentrer une date d'échéance");
      setUpdating(false);
      return false;
    }
    const oldAction = actions.find((a) => a._id === action._id);
    const statusChanged = action.status && oldAction.status !== action.status;
    try {
      if (statusChanged) {
        if ([DONE, CANCEL].includes(action.status)) {
          action.completedAt = action.completedAt || new Date().toISOString();
        } else {
          action.completedAt = null;
        }
      }
      delete action.team;

      const historyEntry = {
        date: new Date(),
        user: user._id,
        data: {},
      };
      for (const key in action) {
        if (!allowedActionFieldsInHistory.map((field) => field.name).includes(key)) continue;
        if (!isEqual(action[key], oldAction[key])) {
          if (isEmptyValue(action[key]) && isEmptyValue(oldAction[key])) continue;
          historyEntry.data[key] = { oldValue: oldAction[key], newValue: action[key] };
        }
      }
      if (!!Object.keys(historyEntry.data).length) action.history = [...(action.history || []), historyEntry];

      const response = await API.put({
        path: `/action/${oldAction._id}`,
        body: prepareActionForEncryption(action),
      });
      if (!response?.ok) return response;
      onRefresh();
      return response;
    } catch (error) {
      capture(error, { extra: { message: "error in updating action" } });
      return { ok: false, error: error.message };
    }
  };

  const onUpdateRequest = async () => {
    setUpdating(true);
    if (isMultipleActions) {
      for (const a of multipleActions) {
        const response = await updateAction(
          Object.assign({}, castToAction(action), {
            _id: a._id,
            person: a.person,
            teams: Array.isArray(a.teams) && a.teams.length ? a.teams : [a.team],
          })
        );
        if (!response.ok) {
          Alert.alert(response.error);
          setUpdating(false);
          return;
        }
      }
      Alert.alert("Actions mises à jour !", null, [{ text: "OK", onPress: onBack }]);
      return;
    }
    const actionCancelled = actionDB.status !== CANCEL && action.status === CANCEL;
    const response = await updateAction(
      Object.assign({}, castToAction(action), {
        _id: actionDB._id,
        teams: Array.isArray(actionDB.teams) && actionDB.teams.length ? actionDB.teams : [actionDB.team],
      })
    );
    setUpdating(false);
    if (!response.ok) {
      if (response.error) {
        Alert.alert(response.error);
      }
      return;
    }
    onRefresh();
    if (actionCancelled) {
      Alert.alert("Cette action est annulée, voulez-vous la dupliquer ?", "Avec une date ultérieure par exemple", [
        { text: "Oui", onPress: onDuplicate },
        { text: "Non merci !", onPress: onBack, style: "cancel" },
      ]);
      return;
    }
    Alert.alert("Action mise à jour !", null, [{ text: "OK", onPress: onBack }]);
  };

  useEffect(() => {
    if (!editable) {
      if (action.status !== actionDB.status) onUpdateRequest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, action.status, isMultipleActions]);

  const onDuplicate = async () => {
    setUpdating(true);
    const { name, person, dueAt, withTime, description, categories, urgent } = action;
    const response = await API.post({
      path: "/action",
      body: prepareActionForEncryption({
        name,
        person,
        teams: [currentTeam._id],
        user: user._id,
        dueAt,
        withTime,
        status: TODO,
        description,
        categories,
        urgent,
      }),
    });
    if (!response.ok) {
      Alert.alert("Impossible de dupliquer !");
      return;
    }
    onRefresh();

    for (let c of comments.filter((c) => c.action === actionDB._id)) {
      const body = {
        comment: c.comment,
        action: response.decryptedData._id,
        user: c.user || user._id,
        team: c.team || currentTeam._id,
        organisation: c.organisation,
      };
      const res = await API.post({ path: "/comment", body: prepareCommentForEncryption(body) });
      if (res.ok) {
        setComments((comments) => [res.decryptedData, ...comments]);
      }
    }
    Sentry.setContext("action", { _id: response.decryptedData._id });
    backRequestHandledRef.current = true;
    navigation.replace("Action", {
      action: response.decryptedData,
      fromRoute: "ActionsList",
      editable: true,
      duplicate: true,
    });
  };

  const onDeleteRequest = () => {
    Alert.alert("Voulez-vous vraiment supprimer cette action ?", "Cette opération est irréversible.", [
      {
        text: "Supprimer",
        style: "destructive",
        onPress: onDelete,
      },
      {
        text: "Annuler",
        style: "cancel",
      },
    ]);
  };

  const deleteAction = async (id) => {
    const res = await API.delete({
      path: `/action/${id}`,
      body: {
        commentIdsToDelete: comments.filter((c) => c.action === id).map((c) => c._id),
      },
    });
    if (res.ok) onRefresh();
    return res;
  };

  const onDelete = async () => {
    let response;
    if (isMultipleActions) {
      for (const a of multipleActions) {
        response = await deleteAction(a._id);
      }
    } else {
      response = await deleteAction(actionDB._id);
    }
    if (response.error) return Alert.alert(response.error);
    if (response.ok) {
      Alert.alert(isMultipleActions ? "Actions supprimées !" : "Action supprimée !");
      onBack();
    }
  };

  const descriptionRef = useRef(null);
  const newCommentRef = useRef(null);

  const isOnePerson = persons.length === 1;
  const person = !isOnePerson ? null : persons?.[0];
  const canToggleGroupCheck = !!organisation.groupsEnabled && !!person && groups.find((group) => group.persons.includes(person._id));

  const { name, categories, group } = action;

  const displayActionName = name.trim() || categories.join(", ") || "Action";

  // Move actionComments calculation to a useMemo hook at the component level
  const actionComments = useMemo(() => comments.filter((c) => c.action === actionDB?._id), [comments, actionDB?._id]);

  const canDelete = ["admin", "normal"].includes(user.role);
  const canSetUrgent = ["admin", "normal"].includes(user.role);

  return (
    <SceneContainer>
      <ScreenTitle
        title={
          persons?.length && persons.length === 1
            ? `${!!organisation.groupsEnabled && !!group ? "👪 " : ""}${displayActionName} - ${persons[0]?.name}`
            : displayActionName
        }
        onBack={onGoBackRequested}
        onEdit={!editable ? () => setEditable(true) : null}
        onSave={!editable || isUpdateDisabled ? null : onUpdateRequest}
        saving={updating}
        testID="action"
      />
      <KeyboardAvoidingView behavior="padding" className="flex-1 bg-white">
        {canComment ? (
          <Tab.Navigator
            // we NEED this custom tab bar because there is a bug in the underline of the default tab bar
            // https://github.com/react-navigation/react-navigation/issues/12052
            tabBar={MyTabBar}
            screenOptions={{
              tabBarItemStyle: {
                flexShrink: 1,
                borderColor: "transparent",
                borderWidth: 1,
              },
              tabBarLabelStyle: {
                textTransform: "none",
              },
              tabBarContentContainerStyle: {
                flex: 1,
                borderColor: "red",
                borderWidth: 3,
              },
            }}
          >
            <Tab.Screen
              name="ActionInformations"
              options={{
                tabBarLabel: "Informations",
              }}
              children={() => (
                <ActionInformation
                  action={action}
                  actionDB={actionDB}
                  persons={persons}
                  editable={editable}
                  setEditable={setEditable}
                  setAction={setAction}
                  organisation={organisation}
                  groups={groups}
                  onSearchPerson={onSearchPerson}
                  descriptionRef={descriptionRef}
                  updating={updating}
                  isUpdateDisabled={isUpdateDisabled}
                  onUpdateRequest={onUpdateRequest}
                  onDeleteRequest={onDeleteRequest}
                  canToggleGroupCheck={canToggleGroupCheck}
                  canDelete={canDelete}
                  canSetUrgent={canSetUrgent}
                />
              )}
            />
            <Tab.Screen
              name="ActionCommentaires"
              options={{
                tabBarLabel: `Commentaires${actionComments.length ? ` (${actionComments.length})` : ""}`,
              }}
              children={() => (
                <ActionComments
                  actionDB={actionDB}
                  actionComments={actionComments}
                  comments={comments}
                  setComments={setComments}
                  canComment={canComment}
                  newCommentRef={newCommentRef}
                  setWritingComment={setWritingComment}
                />
              )}
            />
            <Tab.Screen
              name="ActionDocuments"
              options={{
                tabBarLabel: `Documents${action.documents.length ? ` (${action.documents.length})` : ""}`,
              }}
              children={() => (
                <ScrollContainer noRadius>
                  <DocumentsManager
                    defaultParent="root"
                    personDB={person}
                    onAddDocument={(doc) => {
                      const newActionDb = { ...actionDB, documents: [...(actionDB.documents || []), doc] };
                      setAction(castToAction(newActionDb));
                      updateAction(newActionDb);
                    }}
                    onDelete={(doc) => {
                      const newActionDb = { ...actionDB, documents: actionDB.documents.filter((d) => d.file.filename !== doc.file.filename) };
                      setAction(castToAction(newActionDb));
                      updateAction(newActionDb);
                    }}
                    onUpdateDocument={(doc) => {
                      const newActionDb = {
                        ...actionDB,
                        documents: actionDB.documents.map((d) => (d.file.filename === doc.file.filename ? doc : d)),
                      };
                      setAction(castToAction(newActionDb));
                      updateAction(newActionDb);
                    }}
                    documents={actionDB.documents}
                  />
                </ScrollContainer>
              )}
            />
          </Tab.Navigator>
        ) : (
          <ActionInformation
            action={action}
            actionDB={actionDB}
            persons={persons}
            editable={editable}
            setEditable={setEditable}
            setAction={setAction}
            organisation={organisation}
            groups={groups}
            onSearchPerson={onSearchPerson}
            descriptionRef={descriptionRef}
            updating={updating}
            isUpdateDisabled={isUpdateDisabled}
            onUpdateRequest={onUpdateRequest}
            onDeleteRequest={onDeleteRequest}
            canToggleGroupCheck={canToggleGroupCheck}
            canDelete={canDelete}
            canSetUrgent={canSetUrgent}
          />
        )}
      </KeyboardAvoidingView>
    </SceneContainer>
  );
};

function MyTabBar({ state, descriptors, navigation, position }) {
  return (
    <View className="flex-row bg-white border-b border-gray-200">
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel !== undefined ? options.tabBarLabel : options.title !== undefined ? options.title : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
        };

        const inputRange = state.routes.map((_, i) => i);
        const opacity = position.interpolate({
          inputRange,
          outputRange: inputRange.map((i) => (i === index ? 1 : 0.5)),
        });

        return (
          <TouchableOpacity
            key={index}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            className="flex-1 justify-center items-center py-2"
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              // textDecoration: isFocused ? 'underline' : 'none',
              borderBottomWidth: isFocused ? 2 : 0,
            }}
          >
            <Animated.Text
              // eslint-disable-next-line react-native/no-inline-styles
              style={{
                color: isFocused ? "#000" : "#000",
                fontWeight: isFocused ? "bold" : "normal",
                opacity,
              }}
            >
              {label}
            </Animated.Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const Urgent = styled(MyText)`
  font-weight: bold;
  font-size: 17px;
  padding: 2px 5px;
  margin: 0 auto 20px;
  color: red;
`;

const EmptyContainer = styled.View`
  height: 50px;
  justify-content: center;
  align-items: center;
`;

const Empty = styled(MyText)`
  align-self: center;
  font-style: italic;
`;

export default Action;
