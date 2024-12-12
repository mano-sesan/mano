import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Alert, Text, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import ScrollContainer from '../../components/ScrollContainer';
import SceneContainer from '../../components/SceneContainer';
import ScreenTitle from '../../components/ScreenTitle';
import InputLabelled from '../../components/InputLabelled';
import Button from '../../components/Button';
import InputFromSearchList from '../../components/InputFromSearchList';
import DateAndTimeInput from '../../components/DateAndTimeInput';
import ActionStatusSelect from '../../components/Selects/ActionStatusSelect';
import Label from '../../components/Label';
import Tags from '../../components/Tags';
import { MyText } from '../../components/MyText';
import { prepareActionForEncryption, TODO } from '../../recoil/actions';
import { currentTeamState, organisationState, userState } from '../../recoil/auth';
import API from '../../services/api';
import ActionCategoriesModalSelect from '../../components/ActionCategoriesModalSelect';
import CheckboxLabelled from '../../components/CheckboxLabelled';
import { groupsState } from '../../recoil/groups';
import { useFocusEffect } from '@react-navigation/native';
import { refreshTriggerState } from '../../components/Loader';
import Recurrence from '../../components/Recurrence';
import { dayjsInstance } from '../../services/dateDayjs';
import { getOccurrences } from '../../utils/recurrence';

const NewActionForm = ({ route, navigation }) => {
  const setRefreshTrigger = useSetRecoilState(refreshTriggerState);
  const currentTeam = useRecoilValue(currentTeamState);
  const organisation = useRecoilValue(organisationState);
  const groups = useRecoilValue(groupsState);
  const user = useRecoilValue(userState);
  const [name, setName] = useState('');
  const [dueAt, setDueAt] = useState(null);
  const [withTime, setWithTime] = useState(false);
  const [description, setDescription] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [recurrenceData, setRecurrenceData] = useState({});
  const [group, setGroup] = useState(false);

  const [actionPersons, setActionPersons] = useState(() => (route.params?.person ? [route.params?.person] : []));
  const [categories, setCategories] = useState([]);
  const forCurrentPerson = useRef(!!route.params?.person).current;
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState(TODO);

  const backRequestHandledRef = useRef(null);
  useEffect(() => {
    const handleBeforeRemove = (e) => {
      if (backRequestHandledRef.current) return;
      e.preventDefault();
      onGoBackRequested();
    };
    const beforeRemoveListenerUnsbscribe = navigation.addListener('beforeRemove', handleBeforeRemove);
    return () => {
      beforeRemoveListenerUnsbscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const newPerson = route?.params?.person;
      if (newPerson) {
        setActionPersons((actionPersons) => [...actionPersons.filter((p) => p._id !== newPerson._id), newPerson]);
      }
    }, [route?.params?.person])
  );

  const onSearchPerson = () => navigation.push('PersonsSearch', { fromRoute: 'NewActionForm' });

  const onCreateActionRequest = () => {
    const hasRecurrence = isRecurrent && recurrenceData?.timeUnit;
    const recurrenceDataWithDates = {
      ...recurrenceData,
      startDate: dayjsInstance(dueAt).startOf('day').toDate(),
      endDate: dayjsInstance(recurrenceData.endDate).startOf('day').toDate(),
    };
    const occurrences = hasRecurrence ? getOccurrences(recurrenceDataWithDates) : [];
    if (occurrences.length > 1) {
      const total = occurrences.length * (Array.isArray(actionPersons) ? actionPersons.length : 1);
      const text =
        'En sauvegardant, du fait de la récurrence et du nombre de personnes, vous allez créer ' + total + ' actions. Voulez-vous continuer ?';
      Alert.alert('Sauvegarde de multiple actions', text, [
        {
          text: 'Continuer',
          onPress: onCreateAction,
        },
        {
          text: 'Annuler',
          style: 'cancel',
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
      startDate: dayjsInstance(dueAt).startOf('day').toDate(),
      endDate: dayjsInstance(recurrenceData.endDate).startOf('day').toDate(),
    };
    const occurrences = hasRecurrence ? getOccurrences(recurrenceDataWithDates) : [];

    // Creation de la récurrence si nécessaire. Attention on doit créer une récurrence par personnes,
    // pour pouvoir modifier une action pour une personne sans impacter les autres.
    const recurrencesIds = [];
    if (hasRecurrence) {
      // eslint-disable-next-line no-unused-vars
      for (const _personId of Array.isArray(actionPersons) ? actionPersons : [actionPersons]) {
        const recurrenceResponse = await API.post({
          path: '/recurrence',
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

    const actions = (Array.isArray(actionPersons) ? actionPersons : [actionPersons]).flatMap((person, index) => {
      if (hasRecurrence) {
        return occurrences.map((occurrence) =>
          prepareActionForEncryption({
            name,
            person: person._id,
            teams: [currentTeam._id],
            description,
            withTime,
            urgent,
            group,
            status,
            categories,
            user: user._id,
            completedAt: status !== TODO ? new Date().toISOString() : null,
            recurrence: recurrencesIds[index],
            dueAt: !withTime
              ? occurrence
              : dayjsInstance(occurrence).set('hour', dayjsInstance(dueAt).hour()).set('minute', dayjsInstance(dueAt).minute()).toDate(),
          })
        );
      } else {
        return prepareActionForEncryption({
          name,
          person: person._id,
          teams: [currentTeam._id],
          description,
          dueAt,
          withTime,
          urgent,
          group,
          status,
          categories,
          user: user._id,
          completedAt: status !== TODO ? new Date().toISOString() : null,
        });
      }
    });

    const response = await API.post({
      path: '/action/multiple',
      body: await Promise.all(actions.map(API.encryptItem)),
    });

    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
    setPosting(false);
    if (!response.ok) {
      if (response.status !== 401) Alert.alert(response.error || response.code);
      return;
    }

    // because when we go back from Action to ActionsList, we don't want the Back popup to be triggered
    backRequestHandledRef.current = true;

    // Quand il y a récurrence, on redirige juste vers la liste des actions
    if (hasRecurrence) {
      navigation.replace('ActionsList');
      return;
    }

    const actionToRedirect = response.decryptedData[0];
    Sentry.setContext('action', { _id: actionToRedirect._id });
    navigation.replace('Action', {
      actions: response.decryptedData,
      action: actionToRedirect,
      editable: false,
    });
    setTimeout(() => setPosting(false), 250);
  };

  const onBack = () => {
    backRequestHandledRef.current = true;
    navigation.goBack();
  };

  const canGoBack = useMemo(() => {
    if (!name.length && (forCurrentPerson || !actionPersons.length) && !dueAt) return true;
    return false;
  }, [name, forCurrentPerson, actionPersons, dueAt]);

  const isReadyToSave = useMemo(() => {
    if (!name?.trim()?.length && !categories?.length) return false;
    if (!actionPersons.length) return false;
    if (!dueAt) return false;
    return true;
  }, [name, categories, dueAt, actionPersons]);

  const onGoBackRequested = () => {
    if (canGoBack) return onBack();
    if (isReadyToSave) {
      Alert.alert('Voulez-vous enregistrer cette action ?', null, [
        {
          text: 'Enregistrer',
          onPress: onCreateActionRequest,
        },
        {
          text: 'Ne pas enregistrer',
          onPress: onBack,
          style: 'destructive',
        },
        {
          text: 'Annuler',
          style: 'cancel',
        },
      ]);
      return;
    }
    Alert.alert('Voulez-vous abandonner la création de cette action ?', null, [
      {
        text: 'Continuer la création',
      },
      {
        text: 'Abandonner',
        onPress: onBack,
        style: 'destructive',
      },
    ]);
  };

  const isOnePerson = actionPersons?.length === 1;
  const person = !isOnePerson ? null : actionPersons?.[0];
  const canToggleGroupCheck = !!organisation.groupsEnabled && !!person && groups.find((group) => group.persons.includes(person._id));

  return (
    <SceneContainer>
      <ScreenTitle title="Nouvelle action" onBack={onGoBackRequested} testID="new-action" />
      <ScrollContainer keyboardShouldPersistTaps="handled" testID="new-action-form">
        <View>
          <InputLabelled label="Nom de l’action" onChangeText={setName} value={name} placeholder="Rdv chez le dentiste" testID="new-action-name" />
          {forCurrentPerson ? (
            <InputFromSearchList
              label="Personne concernée"
              value={actionPersons[0]?.name || '-- Aucune --'}
              onSearchRequest={onSearchPerson}
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
          <ActionStatusSelect onSelect={setStatus} value={status} editable testID="new-action-status" />
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
          <InputLabelled label="Description" onChangeText={setDescription} value={description} placeholder="Description" multiline editable />
          <ActionCategoriesModalSelect withMostUsed onChange={setCategories} values={categories} editable />
          <CheckboxLabelled
            label="Action prioritaire (cette action sera mise en avant par rapport aux autres)"
            alone
            onPress={() => setUrgent(!urgent)}
            value={urgent}
          />
          <CheckboxLabelled
            label="Répéter cette action"
            alone
            onPress={() => {
              if (!dueAt) {
                Alert.alert('Veuillez sélectionner une date avant de planifier une récurrence');
              } else {
                setIsRecurrent(!isRecurrent);
              }
            }}
            value={isRecurrent}
          />

          {Boolean(isRecurrent) && (
            <Recurrence startDate={dueAt} initialValues={recurrenceData} onChange={(recurrenceData) => setRecurrenceData(recurrenceData)} />
          )}
          {!!canToggleGroupCheck && (
            <CheckboxLabelled
              label="Action familiale (cette action sera à effectuer pour toute la famille)"
              alone
              onPress={() => setGroup(!group)}
              value={group}
            />
          )}
          <Button caption="Créer" disabled={!isReadyToSave} onPress={onCreateActionRequest} loading={posting} testID="new-action-create" />
        </View>
      </ScrollContainer>
    </SceneContainer>
  );
};

export default NewActionForm;
