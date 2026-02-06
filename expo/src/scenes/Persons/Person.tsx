import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform } from "react-native";
import * as Sentry from "@sentry/react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { useAtom, useAtomValue } from "jotai";
import PersonSummary from "./PersonSummary";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import FoldersNavigator from "./FoldersNavigator";
import Tabs from "../../components/Tabs";
import colors from "../../utils/colors";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import {
  allowedPersonFieldsInHistorySelector,
  personsState,
  usePreparePersonForEncryption,
  flattenedCustomFieldsPersonsSelector,
} from "../../recoil/persons";
import { actionsState, prepareActionForEncryption } from "../../recoil/actions";
import { commentsState, prepareCommentForEncryption } from "../../recoil/comments";
import { relsPersonPlaceState } from "../../recoil/relPersonPlace";
import { userState } from "../../recoil/auth";
import API from "../../services/api";
import { rencontresState } from "../../recoil/rencontres";
import { passagesState } from "../../recoil/passages";
import { consultationsState } from "../../recoil/consultations";
import { treatmentsState } from "../../recoil/treatments";
import { medicalFileState } from "../../recoil/medicalFiles";
import { refreshTriggerState } from "../../components/Loader";
import { groupsState, prepareGroupForEncryption } from "../../recoil/groups";
import isEqual from "react-fast-compare";
import { isEmptyValue } from "../../utils";
import { alertCreateComment } from "../../utils/alert-create-comment";
import { createNativeStackNavigator, NativeStackScreenProps } from "@react-navigation/native-stack";
import { PersonInstance } from "@/types/person";
import PersonsOutOfActiveListReason from "./PersonsOutOfActiveListReason";
import { PersonStackParams, RootStackParamList } from "@/types/navigation";
import { hideEditButtonAtom } from "@/utils/hide-edit-button";

const PersonStack = createNativeStackNavigator<PersonStackParams>();

type PersonScreenParams = NativeStackScreenProps<RootStackParamList, "PERSON_STACK">;

export default function PersonStackNavigator({ navigation, route }: PersonScreenParams) {
  const person = route.params.person;
  return (
    <PersonStack.Navigator screenOptions={{ headerShown: false }}>
      <PersonStack.Screen name="PERSON">
        {(props) => (
          <Person
            navigation={navigation}
            route={route}
            onRemoveFromActiveList={() => props.navigation.push("PERSON_OUT_OF_ACTIVE_LIST_REASON")}
            onAddActionRequest={() => navigation.navigate("ACTION_NEW_STACK", { person })}
          />
        )}
      </PersonStack.Screen>
      <PersonStack.Screen name="PERSON_OUT_OF_ACTIVE_LIST_REASON">
        {(props) => <PersonsOutOfActiveListReason onBack={() => props.navigation.goBack()} person={person} />}
      </PersonStack.Screen>
    </PersonStack.Navigator>
  );
}

const TabNavigator = createMaterialTopTabNavigator();

const cleanValue = (value: string | number | boolean | null | undefined) => {
  if (typeof value === "string") return (value || "").trim();
  return value;
};

type PersonProps = NativeStackScreenProps<RootStackParamList, "PERSON_STACK"> & {
  onRemoveFromActiveList: () => void;
  onAddActionRequest: () => void;
};

const Person = ({ route, navigation, onRemoveFromActiveList, onAddActionRequest }: PersonProps) => {
  const flattenedCustomFieldsPersons = useAtomValue(flattenedCustomFieldsPersonsSelector);
  const allowedFieldsInHistory = useAtomValue(allowedPersonFieldsInHistorySelector);
  const preparePersonForEncryption = usePreparePersonForEncryption();
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const [persons, setPersons] = useAtom(personsState);
  const actions = useAtomValue(actionsState);
  const groups = useAtomValue(groupsState);
  const comments = useAtomValue(commentsState);
  const passages = useAtomValue(passagesState) as Array<{ _id: string; person: string; createdAt: Date }>;
  const rencontres = useAtomValue(rencontresState) as Array<{ _id: string; person: string; createdAt: Date }>;
  const consultations = useAtomValue(consultationsState);
  const treatments = useAtomValue(treatmentsState);
  const medicalFiles = useAtomValue(medicalFileState);
  const hideEditButton = useAtomValue(hideEditButtonAtom);
  const relsPersonPlace = useAtomValue(relsPersonPlaceState) as Array<{ _id: string; person: string; place: string; createdAt: Date }>;
  const user = useAtomValue(userState)!;

  const personDB = useMemo(() => persons.find((p) => p._id === route.params?.person?._id)!, [persons, route.params?.person?._id]);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused && refreshTrigger.status !== true) {
      requestIdleCallback(() => {
        setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const castToPerson = useCallback(
    (person: Partial<PersonInstance>) => {
      const toReturn: Omit<PersonInstance, "_id"> = {};
      for (const field of flattenedCustomFieldsPersons || []) {
        toReturn[field.name as keyof PersonInstance] = cleanValue(person[field.name]);
      }
      return {
        ...toReturn,
        name: person.name,
        otherNames: person.otherNames,
        birthdate: person.birthdate,
        alertness: person.alertness,
        wanderingAt: person.wanderingAt,
        followedSince: person.followedSince,
        createdAt: person.createdAt,
        gender: person.gender,
        phone: person.phone?.trim(),
        email: person.email?.trim(),
        description: person.description?.trim(),
        vulnerabilities: person.vulnerabilities,
        consumptions: person.consumptions,
        assignedTeams: person.assignedTeams,
        entityKey: person.entityKey,
        outOfActiveList: person.outOfActiveList,
        outOfActiveListReasons: person.outOfActiveListReasons,
        documents: person.documents,
        history: person.history,
      };
    },
    [flattenedCustomFieldsPersons],
  );

  const [person, setPerson] = useState(castToPerson(personDB));
  const [writingComment, setWritingComment] = useState("");
  const [editable, setEditable] = useState(route?.params?.editable || false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const backRequestHandledRef = useRef(false);
  useEffect(() => {
    const handleBeforeRemove = (e: any) => {
      if (backRequestHandledRef.current) return;
      e.preventDefault();
      onGoBackRequested();
    };
    const beforeRemoveListenerUnsbscribe = navigation.addListener("beforeRemove", handleBeforeRemove);
    return () => {
      beforeRemoveListenerUnsbscribe();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, route?.params?.person]);

  useFocusEffect(
    useCallback(() => {
      setPerson(castToPerson(personDB));
    }, [personDB, castToPerson]),
  );

  const onEdit = () => setEditable((e) => !e);

  const onChange = (newPersonState: Partial<PersonInstance>, forceUpdate = false) => {
    setPerson((p) => ({ ...p, ...newPersonState }));
    if (forceUpdate) onUpdatePerson(false, newPersonState);
  };

  const onUpdatePerson = async (alert = true, stateToMerge: Partial<PersonInstance> = {}): Promise<boolean> => {
    const personToUpdate = Object.assign({}, castToPerson(person), stateToMerge, {
      _id: personDB._id,
    });
    const oldPerson = persons.find((a) => a._id === personDB._id)!;
    const existingPerson = persons.find((p) => personDB._id !== p._id && p.name === personToUpdate.name);
    if (existingPerson) {
      Alert.alert("Une personne existe déjà à ce nom");
      return false;
    }

    setUpdating(true);

    const historyEntry = {
      date: new Date(),
      user: user._id,
      data: {} as Record<string, { oldValue: any; newValue: any }>,
    };
    for (const key in personToUpdate) {
      if (!allowedFieldsInHistory.includes(key)) continue;
      if (!isEqual(personToUpdate[key], oldPerson[key])) {
        if (isEmptyValue(personToUpdate[key]) && isEmptyValue(oldPerson[key])) continue;
        historyEntry.data[key] = { oldValue: oldPerson[key], newValue: personToUpdate[key] };
      }
    }
    if (!!Object.keys(historyEntry.data).length) personToUpdate.history = [...(oldPerson.history || []), historyEntry];

    const response = await API.put({
      path: `/person/${personDB._id}`,
      body: preparePersonForEncryption(personToUpdate),
    });
    if (response.error) {
      Alert.alert(response.error);
      setUpdating(false);
      return false;
    }
    const newPerson = response.decryptedData;
    setPersons((persons) =>
      persons.map((p) => {
        if (p._id === personDB._id) return newPerson;
        return p;
      }),
    );
    setPerson(castToPerson(newPerson));
    if (alert) Alert.alert("Personne mise à jour !");
    setUpdating(false);
    setEditable(false);
    return true;
  };

  const onDelete = async () => {
    setDeleting(true);
    const personId = personDB._id;
    if (
      !user.healthcareProfessional &&
      (!!medicalFiles.find((c) => c.person === personId) ||
        !!treatments.find((c) => c.person === personId) ||
        !!consultations.find((c) => c.person === personId))
    ) {
      const keepGoing = await new Promise((res) => {
        Alert.alert(
          "Voulez-vous continuer la suppression ?",
          // eslint-disable-next-line max-len
          "Des données médicales sont associées à cette personne. Si vous la supprimez, ces données seront également effacées. Vous n’avez pas accès à ces données médicales car vous n’êtes pas un·e professionnel·le de santé. Voulez-vous supprimer cette personne et toutes ses données ?",
          [
            { text: "Annuler", style: "cancel", onPress: () => res(false) },
            { text: "Continuer", style: "destructive", onPress: () => res(true) },
          ],
        );
      });
      if (!keepGoing) {
        setDeleting(false);
        return false;
      }
    }

    const body: {
      groupToUpdate?: string;
      groupIdToDelete?: string;
      actionsToTransfer: any[]; // FIXME
      commentsToTransfer: any[]; // FIXME
      actionIdsToDelete: string[];
      commentIdsToDelete: string[];
      passageIdsToDelete: string[];
      rencontreIdsToDelete: string[];
      consultationIdsToDelete: string[];
      treatmentIdsToDelete: string[];
      medicalFileIdsToDelete: string[];
      relsPersonPlaceIdsToDelete: string[];
    } = {
      // groupToUpdate: undefined,
      // groupIdToDelete: undefined,
      actionsToTransfer: [],
      commentsToTransfer: [],
      actionIdsToDelete: [],
      commentIdsToDelete: [],
      passageIdsToDelete: [],
      rencontreIdsToDelete: [],
      consultationIdsToDelete: [],
      treatmentIdsToDelete: [],
      medicalFileIdsToDelete: [],
      relsPersonPlaceIdsToDelete: [],
    };

    const group = groups.find((g) => g.persons.includes(personId));
    if (group) {
      const updatedGroup = {
        ...group,
        persons: group.persons.filter((p) => p !== personDB._id),
        relations: group.relations.filter((r) => !r.persons.includes(personDB._id)),
      };
      const personTransferId = group.persons.find((p) => p !== personDB._id);
      if (updatedGroup.relations.length === 0) {
        body.groupIdToDelete = group._id;
      } else {
        body.groupToUpdate = await API.encryptItem(prepareGroupForEncryption(updatedGroup));
      }

      if (personTransferId) {
        body.actionsToTransfer = await Promise.all(
          actions
            .filter((a) => a.person === personDB._id && a.group === true)
            .map((action) => {
              return prepareActionForEncryption({
                ...action,
                person: personTransferId,
                user: action.user || user._id,
              });
            })
            .map(API.encryptItem),
        );

        body.commentsToTransfer = await Promise.all(
          comments
            .filter((c) => c.person === personDB._id && c.group === true)
            .map((comment) => prepareCommentForEncryption({ ...comment, person: personTransferId }))
            .map(API.encryptItem),
        );
      }
    }
    const actionIdsToDelete = actions.filter((a) => !a.group && a.person === personDB._id).map((a) => a._id);
    const commentIdsToDelete = comments
      .filter((c) => {
        if (c.group) return false;
        if (actionIdsToDelete.includes(c.action!)) return true;
        if (c.person === personDB._id) return true;
        return false;
      })
      .map((c) => c._id);
    body.actionIdsToDelete = actionIdsToDelete;
    body.commentIdsToDelete = commentIdsToDelete;
    body.relsPersonPlaceIdsToDelete = relsPersonPlace.filter((rel) => rel.person === personDB._id).map((rel) => rel._id);
    body.passageIdsToDelete = passages.filter((c) => c.person === personDB._id).map((c) => c._id);
    body.rencontreIdsToDelete = rencontres.filter((c) => c.person === personDB._id).map((c) => c._id);
    body.consultationIdsToDelete = consultations.filter((c) => c.person === personDB._id).map((c) => c._id);
    body.treatmentIdsToDelete = treatments.filter((c) => c.person === personDB._id).map((c) => c._id);
    body.medicalFileIdsToDelete = medicalFiles.filter((c) => c.person === personDB._id).map((c) => c._id);

    const personRes = await API.delete({ path: `/person/${personDB._id}`, body });
    if (personRes?.ok) {
      Alert.alert("Personne supprimée !");
      setPersons((persons) => persons.filter((p) => p._id !== personDB._id));
      setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
    }
    return true;
  };

  const isUpdateDisabled = useMemo(() => {
    if (deleting) return true;
    const newPerson = {
      ...personDB,
      ...castToPerson(person),
    };
    if (JSON.stringify(castToPerson(personDB)) !== JSON.stringify(castToPerson(newPerson))) return false;
    return true;
  }, [personDB, castToPerson, person, deleting]);

  const onBack = () => {
    backRequestHandledRef.current = true;
    Sentry.setContext("person", {});
    navigation.goBack();
  };

  const onGoBackRequested = async () => {
    if (writingComment.length) {
      const goToNextStep = await alertCreateComment();
      if (!goToNextStep) return;
    }
    if (isUpdateDisabled) return onBack();
    Alert.alert("Voulez-vous enregistrer les mises-à-jour sur cette personne ?", undefined, [
      {
        text: "Enregistrer",
        onPress: () => onUpdatePerson(false),
      },
      {
        text: "Ne pas enregistrer",
        style: "destructive",
        onPress: onBack,
      },
      {
        text: "Annuler",
        style: "cancel",
      },
    ]);
  };

  const showFoldersTab = useMemo(() => ["admin", "normal"].includes(user.role), [user.role]);

  return (
    <>
      <SceneContainer backgroundColor={!person?.outOfActiveList ? colors.app.color : colors.app.colorBackgroundDarkGrey} testID="person">
        <ScreenTitle
          title={person.name!}
          onBack={onGoBackRequested}
          onEdit={hideEditButton ? undefined : !editable ? onEdit : undefined}
          onSave={!editable || isUpdateDisabled ? undefined : onUpdatePerson}
          saving={updating}
          backgroundColor={!person?.outOfActiveList ? colors.app.color : colors.app.colorBackgroundDarkGrey}
          testID="person"
        />

        {showFoldersTab ? (
          <TabNavigator.Navigator
            tabBar={(props) => (
              <Tabs numberOfTabs={2} {...props} backgroundColor={!person?.outOfActiveList ? colors.app.color : colors.app.colorBackgroundDarkGrey} />
            )}
            removeClippedSubviews={Platform.OS === "android"}
            screenOptions={{ swipeEnabled: true, lazy: true }}
          >
            <TabNavigator.Screen name="Summary" options={{ tabBarLabel: "Résumé" }}>
              {() => (
                <KeyboardAvoidingView behavior="padding" className="flex-1 bg-white" keyboardVerticalOffset={160}>
                  <PersonSummary
                    navigation={navigation}
                    route={route}
                    person={person}
                    personDB={personDB}
                    backgroundColor={!person?.outOfActiveList ? colors.app.color : colors.app.colorBackgroundDarkGrey}
                    onChange={onChange}
                    onUpdatePerson={onUpdatePerson}
                    onCommentWrite={setWritingComment}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onBack={onBack}
                    isUpdateDisabled={isUpdateDisabled}
                    updating={updating}
                    editable={editable}
                    onRemoveFromActiveList={onRemoveFromActiveList}
                    onAddActionRequest={onAddActionRequest}
                  />
                </KeyboardAvoidingView>
              )}
            </TabNavigator.Screen>
            <TabNavigator.Screen name="Folders" options={{ tabBarLabel: "Dossiers" }}>
              {() => (
                <KeyboardAvoidingView behavior="padding" className="flex-1 bg-white" keyboardVerticalOffset={160}>
                  <FoldersNavigator
                    navigation={navigation}
                    route={route}
                    person={person}
                    personDB={personDB}
                    backgroundColor={!person?.outOfActiveList ? colors.app.color : colors.app.colorBackgroundDarkGrey}
                    onChange={onChange}
                    onUpdatePerson={onUpdatePerson}
                    onEdit={onEdit}
                    isUpdateDisabled={isUpdateDisabled}
                    editable={editable}
                    updating={updating}
                  />
                </KeyboardAvoidingView>
              )}
            </TabNavigator.Screen>
          </TabNavigator.Navigator>
        ) : (
          <KeyboardAvoidingView behavior="padding" className="flex-1 bg-white">
            <PersonSummary
              navigation={navigation}
              route={route}
              person={person}
              personDB={personDB}
              backgroundColor={!person?.outOfActiveList ? colors.app.color : colors.app.colorBackgroundDarkGrey}
              onChange={onChange}
              onUpdatePerson={onUpdatePerson}
              onCommentWrite={setWritingComment}
              onEdit={onEdit}
              onDelete={onDelete}
              onBack={onBack}
              isUpdateDisabled={isUpdateDisabled}
              updating={updating}
              editable={editable}
              onRemoveFromActiveList={onRemoveFromActiveList}
              onAddActionRequest={onAddActionRequest}
            />
          </KeyboardAvoidingView>
        )}
      </SceneContainer>
    </>
  );
};
