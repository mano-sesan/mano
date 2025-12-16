import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, View } from "react-native";
import * as Sentry from "@sentry/react-native";
import { useAtomValue, useSetAtom } from "jotai";
import ScrollContainer from "../../components/ScrollContainer";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import InputLabelled from "../../components/InputLabelled";
import Button from "../../components/Button";
import InputFromSearchList from "../../components/InputFromSearchList";
import DateAndTimeInput from "../../components/DateAndTimeInput";
import ActionStatusSelect from "../../components/Selects/ActionStatusSelect";
import Label from "../../components/Label";
import Tags from "../../components/Tags";
import { MyText } from "../../components/MyText";
import { DONE, prepareActionForEncryption, TODO } from "../../recoil/actions";
import { currentTeamState, organisationState, userState } from "../../recoil/auth";
import API from "../../services/api";
import ActionCategoriesModalSelect from "../../components/ActionCategoriesModalSelect";
import CheckboxLabelled from "../../components/CheckboxLabelled";
import { groupsState } from "../../recoil/groups";
import { useNavigation } from "@react-navigation/native";
import { refreshTriggerState } from "../../components/Loader";
import RecurrenceComponent from "../../components/Recurrence";
import { dayjsInstance } from "../../services/dateDayjs";
import { getOccurrences } from "../../utils/recurrence";
import { PersonInstance } from "@/types/person";
import { type Recurrence } from "@/types/recurrence";
import { ActionInstance, ActionStatus, PossibleDate } from "@/types/action";
import { ActionNewStackParams, RootStackParamList } from "@/types/navigation";
import PersonsSearch from "../Persons/PersonsSearch";
import { createNativeStackNavigator, NativeStackScreenProps } from "@react-navigation/native-stack";
import NewPersonForm from "../Persons/NewPersonForm";

const ActionNewStack = createNativeStackNavigator<ActionNewStackParams>();
type NewActionScreenProps = NativeStackScreenProps<RootStackParamList, "ACTION_NEW_STACK">;

export default function ActionNewScreen({ route, navigation }: NewActionScreenProps) {
  const person = route.params?.person;
  const [actionPersons, setActionPersons] = useState(() => (person ? [person] : []));

  const canChangePerson = !person;

  return (
    <ActionNewStack.Navigator>
      <ActionNewStack.Screen name="ACTION_NEW">
        {(stackProps) => (
          <NewActionForm
            onBack={() => navigation.goBack()}
            onActionCreated={(action) => {
              if (action) {
                navigation.replace("ACTION", { action });
              } else {
                navigation.goBack();
              }
            }}
            actionPersons={actionPersons}
            setActionPersons={setActionPersons}
            canChangePerson={canChangePerson}
            onSearchPerson={() => {
              if (canChangePerson) {
                stackProps.navigation.navigate("PERSONS_SEARCH");
              }
            }}
          />
        )}
      </ActionNewStack.Screen>
      <ActionNewStack.Screen name="PERSONS_SEARCH" options={{ title: "Rechercher une personne" }}>
        {(stackProps) => (
          <PersonsSearch
            onBack={() => stackProps.navigation.goBack()}
            onCreatePersonRequest={() => stackProps.navigation.navigate("PERSON_NEW")}
            onPersonSelected={(person) => {
              setActionPersons((actionPersons) => [...actionPersons.filter((p) => p._id !== person._id), person]);
              stackProps.navigation.goBack();
            }}
          />
        )}
      </ActionNewStack.Screen>
      <ActionNewStack.Screen name="PERSON_NEW" options={{ title: "Nouvelle personne" }}>
        {(stackProps) => (
          <NewPersonForm
            onBack={() => stackProps.navigation.goBack()}
            onPersonCreated={(person) => {
              stackProps.navigation.goBack();
              setActionPersons((actionPersons) => [...actionPersons.filter((p) => p._id !== person._id), person]);
            }}
          />
        )}
      </ActionNewStack.Screen>
    </ActionNewStack.Navigator>
  );
}

type NewActionFormProps = {
  onBack: () => void;
  onActionCreated: (action: ActionInstance) => void;
  actionPersons: PersonInstance[];
  setActionPersons: (actionPersons: PersonInstance[]) => void;
  onSearchPerson?: () => void;
  canChangePerson: boolean;
};

const NewActionForm = ({
  onSearchPerson,
  onBack: onBackProp,
  onActionCreated,
  actionPersons,
  setActionPersons,
  canChangePerson,
}: NewActionFormProps) => {
  const setRefreshTrigger = useSetAtom(refreshTriggerState);
  const currentTeam = useAtomValue(currentTeamState)!;
  const organisation = useAtomValue(organisationState)!;
  const groups = useAtomValue(groupsState)!;
  const user = useAtomValue(userState)!;
  const navigation = useNavigation();
  const [name, setName] = useState("");
  const [dueAt, setDueAt] = useState<PossibleDate | null>(null);
  const [withTime, setWithTime] = useState(false);
  const [completedAt, setCompletedAt] = useState<PossibleDate | null>(null);
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [recurrenceData, setRecurrenceData] = useState<Recurrence>({} as Recurrence);
  const [group, setGroup] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState<ActionStatus>(TODO);

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
  }, [navigation]);

  const onCreateActionRequest = () => {
    const hasRecurrence = isRecurrent && recurrenceData?.timeUnit;
    const recurrenceDataWithDates = {
      ...recurrenceData,
      startDate: dayjsInstance(dueAt).startOf("day").toDate(),
      endDate: dayjsInstance(recurrenceData.endDate).startOf("day").toDate(),
    };
    const occurrences = hasRecurrence ? getOccurrences(recurrenceDataWithDates) : [];
    if (occurrences.length > 1) {
      const total = occurrences.length * (Array.isArray(actionPersons) ? actionPersons.length : 1);
      const text =
        "En sauvegardant, du fait de la récurrence et du nombre de personnes, vous allez créer " + total + " actions. Voulez-vous continuer ?";
      Alert.alert("Sauvegarde de multiple actions", text, [
        {
          text: "Continuer",
          onPress: onCreateAction,
        },
        {
          text: "Annuler",
          style: "cancel",
        },
      ]);
    } else {
      onCreateAction();
    }
  };

  const onCreateAction = async () => {
    setPosting(true);

    const hasRecurrence = isRecurrent && recurrenceData?.timeUnit;
    const recurrenceDataWithDates = {
      ...recurrenceData,
      startDate: dayjsInstance(dueAt).startOf("day").toDate(),
      endDate: dayjsInstance(recurrenceData.endDate).startOf("day").toDate(),
    };
    const occurrences = hasRecurrence ? getOccurrences(recurrenceDataWithDates) : [];

    // Creation de la récurrence si nécessaire. Attention on doit créer une récurrence par personnes,
    // pour pouvoir modifier une action pour une personne sans impacter les autres.
    const recurrencesIds: string[] = [];
    if (hasRecurrence) {
      const numberOfPersons = Array.isArray(actionPersons) ? actionPersons.length : 1;
      for (let index = 0; index < numberOfPersons; index++) {
        const recurrenceResponse = await API.post({
          path: "/recurrence",
          body: recurrenceDataWithDates,
        });
        if (!recurrenceResponse.ok) {
          setPosting(false);
          Alert.alert(recurrenceResponse.error || recurrenceResponse.code);
          return;
        }
        recurrencesIds.push(recurrenceResponse.data._id);
      }
    }

    const actions = (Array.isArray(actionPersons) ? actionPersons : [actionPersons]).flatMap((_person, index) => {
      if (hasRecurrence) {
        return occurrences.map((occurrence) =>
          prepareActionForEncryption({
            name,
            person: _person._id,
            teams: [currentTeam._id],
            description,
            withTime,
            urgent,
            group,
            status,
            categories,
            user: user._id,
            completedAt: status !== TODO ? completedAt : null,
            recurrence: recurrencesIds[index],
            dueAt: !withTime
              ? occurrence
              : dayjsInstance(occurrence).set("hour", dayjsInstance(dueAt).hour()).set("minute", dayjsInstance(dueAt).minute()).toDate(),
          })
        );
      } else {
        return prepareActionForEncryption({
          name,
          person: _person._id,
          teams: [currentTeam._id],
          description,
          dueAt,
          withTime,
          urgent,
          group,
          status,
          categories,
          user: user._id,
          completedAt: status !== TODO ? completedAt : null,
        });
      }
    });

    const response = await API.post({
      path: "/action/multiple",
      body: await Promise.all(actions.map(API.encryptItem)),
    });

    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
    setPosting(false);
    if (!response.ok) {
      if (response.status !== 401) Alert.alert(response.error || response.code);
      return;
    }

    backRequestHandledRef.current = true;

    if (!hasRecurrence) {
      onBack();
    } else {
      const actionToRedirect = response.decryptedData[0];
      Sentry.setContext("action", { _id: actionToRedirect._id });
      onActionCreated(response.decryptedData[0]);
      setTimeout(() => setPosting(false), 250);
    }
  };

  const onBack = () => {
    backRequestHandledRef.current = true;
    onBackProp();
  };

  const isReadyToSave = useMemo(() => {
    if (!name?.trim()?.length && !categories?.length) return false;
    if (!actionPersons.length) return false;
    if (!dueAt) return false;
    return true;
  }, [name, categories, dueAt, actionPersons]);

  const onGoBackRequested = () => {
    if (!name.length && !dueAt) {
      if (!actionPersons.length) return onBack(); // pas encore de personne choisie, on peut revenir en arrière
      if (!canChangePerson) return onBack(); // une personne est déjà choisie, mais c'était celle par défaut, on peut quand même revenir en arrière
    }
    if (isReadyToSave) {
      Alert.alert("Voulez-vous enregistrer cette action ?", undefined, [
        {
          text: "Enregistrer",
          onPress: onCreateActionRequest,
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
    Alert.alert("Voulez-vous abandonner la création de cette action ?", undefined, [
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

  const isOnePerson = actionPersons?.length === 1;
  const person = !isOnePerson ? null : actionPersons?.[0];
  const canToggleGroupCheck = !!organisation.groupsEnabled && !!person && groups.find((group) => group.persons.includes(person._id));

  return (
    <SceneContainer>
      <ScreenTitle title="Nouvelle action" onBack={onGoBackRequested} testID="new-action" />
      <KeyboardAvoidingView behavior="padding" className="flex-1 bg-white">
        <ScrollContainer keyboardShouldPersistTaps="handled" testID="new-action-form">
          <View>
            <InputLabelled label="Nom de l'action" onChangeText={setName} value={name} placeholder="Rdv chez le dentiste" testID="new-action-name" />
            {!canChangePerson ? (
              <InputFromSearchList
                label="Personne concernée"
                value={actionPersons[0]?.name || "-- Aucune --"}
                onSearchRequest={onSearchPerson!}
                disabled
              />
            ) : (
              <>
                <Label label="Personne(s) concerné(es)" />
                <Tags
                  data={actionPersons}
                  onChange={setActionPersons}
                  editable
                  onAddRequest={onSearchPerson}
                  renderTag={(person) => <MyText>{person?.name}</MyText>}
                />
              </>
            )}
            <ActionStatusSelect onSelectAndSave={setStatus} onSelect={setStatus} value={status} editable testID="new-action-status" />
            <DateAndTimeInput
              label="À faire le"
              setDate={setDueAt}
              date={dueAt}
              showTime
              showDay
              withTime={withTime}
              setWithTime={setWithTime}
              testID="new-action-dueAt"
            />
            {status !== TODO ? (
              <DateAndTimeInput
                label={status === DONE ? "Faite le" : "Annulée le"}
                setDate={setCompletedAt}
                date={completedAt}
                showTime
                showDay
                withTime={withTime}
                setWithTime={setWithTime}
                testID="new-action-completedAt"
              />
            ) : null}
            <InputLabelled label="Description" onChangeText={setDescription} value={description} placeholder="Description" multiline editable />
            <ActionCategoriesModalSelect withMostUsed onChange={setCategories} values={categories} editable />
            <CheckboxLabelled
              _id="urgent"
              label="Action prioritaire (cette action sera mise en avant par rapport aux autres)"
              alone
              onPress={() => setUrgent(!urgent)}
              value={urgent}
            />
            <CheckboxLabelled
              _id="isRecurrent"
              label="Répéter cette action"
              alone
              onPress={() => {
                if (!dueAt) {
                  Alert.alert("Veuillez sélectionner une date avant de planifier une récurrence");
                } else {
                  setIsRecurrent(!isRecurrent);
                }
              }}
              value={isRecurrent}
            />

            {Boolean(isRecurrent) && (
              <RecurrenceComponent
                startDate={dayjsInstance(dueAt!).toDate()}
                initialValues={recurrenceData}
                onChange={(recurrenceData) => setRecurrenceData(recurrenceData)}
              />
            )}
            {!!canToggleGroupCheck && (
              <CheckboxLabelled
                _id="group"
                label="Action familiale (cette action sera à effectuer pour toute la famille)"
                alone
                onPress={() => setGroup(!group)}
                value={group ? true : false}
              />
            )}
            <Button caption="Créer" disabled={!isReadyToSave} onPress={onCreateActionRequest} loading={posting} testID="new-action-create" />
          </View>
        </ScrollContainer>
      </KeyboardAvoidingView>
    </SceneContainer>
  );
};
