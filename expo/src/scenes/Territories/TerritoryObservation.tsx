import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { v4 as UUID } from "uuid";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import Button from "../../components/Button";
import ButtonsContainer from "../../components/ButtonsContainer";
import ButtonDelete from "../../components/ButtonDelete";
import styled from "styled-components/native";
import { MyText } from "../../components/MyText";
import CustomFieldInput from "../../components/CustomFieldInput";
import { useAtomValue } from "jotai";
import {
  customFieldsObsSelector,
  groupedCustomFieldsObsSelector,
  prepareObsForEncryption,
  territoryObservationsState,
} from "../../atoms/territoryObservations";
import { currentTeamState, organisationState, userState } from "../../atoms/auth";
import API from "../../services/api";
import DateAndTimeInput from "../../components/DateAndTimeInput";
import { prepareRencontreForEncryption, rencontresState } from "../../atoms/rencontres";
import { itemsGroupedByPersonSelector } from "../../atoms/selectors";
import { PersonName } from "../Persons/PersonRow";
import { dayjsInstance } from "../../services/dateDayjs";
import { createNativeStackNavigator, NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { TerritoryObservationInstance } from "@/types/territoryObs";
import { UUIDV4 } from "@/types/uuid";
import { RencontreInstance } from "@/types/rencontre";
import TerritoryObservationRencontre from "./TerritoryObservationRencontre";
import PersonsSearch from "../Persons/PersonsSearch";
import PersonNew from "../Persons/PersonNew";
import { PersonInstance } from "@/types/person";
import DocumentsManager from "../../components/DocumentsManager";
import Label from "../../components/Label";
import { useDataLoader } from "@/services/dataLoader";

type ObsStackParams = {
  TERRITORY_OBSERVATION: undefined;
  TERRITORY_OBSERVATION_RENCONTRE: undefined;
  PERSONS_SEARCH: undefined;
  PERSON_NEW: undefined;
};
const ObsStack = createNativeStackNavigator<ObsStackParams>();

type TerritoryObservationProps = NativeStackScreenProps<RootStackParamList, "TERRITORY_OBSERVATION_STACK">;

export default function TerritoryObservationStackNavigator(props: TerritoryObservationProps) {
  const rencontres = useAtomValue(rencontresState);
  const personsObject = useAtomValue(itemsGroupedByPersonSelector);
  const [rencontresForObs, setRencontresForObs] = useState<Array<RencontreInstance>>(() => {
    const obsId = props.route.params?.obs?._id;
    if (!obsId) return [];
    return rencontres?.filter((r) => r.observation === obsId) || [];
  });
  const user = useAtomValue(userState)!;
  const currentTeam = useAtomValue(currentTeamState)!;

  const [rencontrePersons, setRencontrePersons] = useState<Array<PersonInstance>>(() => {
    if (!rencontresForObs.length) return [];
    return rencontresForObs.filter((r) => r.person).map((r) => personsObject[r.person!]);
  });

  const [rencontre, setRencontre] = useState(() => {
    return (
      rencontresForObs.find((r) => r.person === rencontrePersons?.[0]?._id) ||
      ({
        _id: UUID(),
        date: new Date().toISOString(),
        user: user._id,
        comment: "",
        team: currentTeam._id,
        person: undefined,
      } as RencontreInstance)
    );
  });

  return (
    <ObsStack.Navigator screenOptions={{ headerShown: false }}>
      <ObsStack.Screen name="TERRITORY_OBSERVATION">
        {(stackProps) => (
          <TerritoryObservation
            rencontre={rencontre}
            rencontrePersons={rencontrePersons}
            setRencontrePersons={setRencontrePersons}
            rencontresForObs={rencontresForObs}
            setRencontresForObs={setRencontresForObs}
            onAddRencontre={() => stackProps.navigation.push("TERRITORY_OBSERVATION_RENCONTRE")}
            {...props}
          />
        )}
      </ObsStack.Screen>
      <ObsStack.Screen name="TERRITORY_OBSERVATION_RENCONTRE">
        {(stackProps) => (
          <TerritoryObservationRencontre
            onBack={() => stackProps.navigation.goBack()}
            onSearchPerson={() => stackProps.navigation.push("PERSONS_SEARCH")}
            rencontrePersons={rencontrePersons}
            setRencontrePersons={setRencontrePersons}
            rencontre={rencontre}
            setRencontre={setRencontre}
          />
        )}
      </ObsStack.Screen>
      <ObsStack.Screen name="PERSONS_SEARCH" options={{ title: "Rechercher une personne" }}>
        {(stackProps) => (
          <PersonsSearch
            onBack={() => stackProps.navigation.goBack()}
            onCreatePersonRequest={() => stackProps.navigation.navigate("PERSON_NEW")}
            onPersonSelected={(person) => {
              stackProps.navigation.goBack();
              setRencontrePersons((rencontrePersons) => [...rencontrePersons, person]);
            }}
          />
        )}
      </ObsStack.Screen>
      <ObsStack.Screen name="PERSON_NEW" options={{ title: "Nouvelle personne" }}>
        {(stackProps) => (
          <PersonNew
            onBack={() => stackProps.navigation.goBack()}
            onPersonCreated={(person) => {
              stackProps.navigation.goBack();
              setRencontrePersons((rencontrePersons) => [...rencontrePersons, person]);
            }}
          />
        )}
      </ObsStack.Screen>
    </ObsStack.Navigator>
  );
}

const TerritoryObservation = ({
  route,
  navigation,
  rencontre,
  setRencontresForObs,
  setRencontrePersons,
  rencontrePersons,
  rencontresForObs,
  onAddRencontre,
}: TerritoryObservationProps & {
  rencontre: RencontreInstance;
  setRencontrePersons: React.Dispatch<React.SetStateAction<Array<PersonInstance>>>;
  onAddRencontre: () => void;
  rencontresForObs: Array<RencontreInstance>;
  setRencontresForObs: React.Dispatch<React.SetStateAction<Array<RencontreInstance>>>;
  rencontrePersons: Array<PersonInstance>;
}) => {
  const user = useAtomValue(userState)!;
  const currentTeam = useAtomValue(currentTeamState)!;
  const organisation = useAtomValue(organisationState)!;
  const customFieldsObs = useAtomValue(customFieldsObsSelector);
  const groupedCustomFieldsObs = useAtomValue(groupedCustomFieldsObsSelector);
  const fieldsGroupNames = groupedCustomFieldsObs.map((f) => f.name).filter((f) => f);
  const { refresh } = useDataLoader();
  const allTerritoryOservations = useAtomValue(territoryObservationsState);
  const [obsDB, setObsDB] = useState(
    () => allTerritoryOservations.find((obs) => obs._id === route.params?.obs?._id) || ({} as TerritoryObservationInstance)
  );

  const castToTerritoryObservation = useCallback(
    (territoryObservation: Partial<TerritoryObservationInstance> = {}) => {
      const toReturn: Omit<TerritoryObservationInstance, "_id"> = {};
      for (const field of customFieldsObs) {
        toReturn[field.name] = cleanValue(territoryObservation[field.name]);
      }
      return {
        ...toReturn,
        observedAt: territoryObservation.observedAt || (territoryObservation.createdAt! as Date) || new Date(),
        createdAt: territoryObservation.createdAt,
        updatedAt: territoryObservation.updatedAt,
        user: territoryObservation.user || "",
        entityKey: territoryObservation.entityKey || "",
        documents: territoryObservation.documents || [],
      };
    },
    [customFieldsObs]
  );

  const [activeTab, setActiveTab] = useState(fieldsGroupNames[0]);
  const [updating, setUpdating] = useState(false);
  const [editable, setEditable] = useState(route?.params?.editable || false);
  const [obs, setObs] = useState(castToTerritoryObservation(route.params.obs));
  const [date, setDate] = useState(obs.observedAt || obs.createdAt || new Date());
  const onChange = (newProps: Partial<TerritoryObservationInstance>) => setObs((o) => ({ ...o, ...newProps }));

  const onBack = () => {
    backRequestHandledRef.current = true;
    navigation.goBack();
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

  const onEdit = () => setEditable((e) => !e);

  const onSaveObservation = async () => {
    setUpdating(true);
    if (obsDB?._id) return onUpdateTerritoryObservation();
    return onCreateTerritoryObservation();
  };

  const saveRencontres = async (obsId: UUIDV4) => {
    if (obsId) {
      const newRencontres: Array<RencontreInstance> = [];
      for (const person of rencontrePersons) {
        if (rencontresForObs.find((r) => r.observation === obsId && r.person === person._id)) continue;
        const response = await API.post({
          path: "/rencontre",
          body: prepareRencontreForEncryption({ ...rencontre, person: person._id, observation: obsId }),
          entityType: "rencontre",
        });
        if (response.error) {
          Alert.alert(response.error);
          continue;
        }
        newRencontres.push(response.decryptedData as RencontreInstance);
      }
      await refresh();
      setRencontresForObs((rencontresForObs) => [...rencontresForObs, ...newRencontres]);
    }
  };

  const onCreateTerritoryObservation = async () => {
    setUpdating(true);
    const response = await API.post({
      path: "/territory-observation",
      body: prepareObsForEncryption(customFieldsObs)(
        Object.assign({}, castToTerritoryObservation({ ...obs, observedAt: date || new Date() }), {
          territory: route.params.territory._id,
          user: user._id,
          team: currentTeam._id,
          organisation: organisation._id,
        })
      ),
      entityType: "territory-observation",
    });
    if (response.code || response.error) {
      setUpdating(false);
      Alert.alert(response.error!);
      return false;
    }

    await refresh();
    setObs(castToTerritoryObservation(response.decryptedData as TerritoryObservationInstance));
    setObsDB(response.decryptedData as TerritoryObservationInstance);
    await saveRencontres((response.decryptedData as TerritoryObservationInstance)._id);
    Alert.alert("Nouvelle observation créée !");
    setUpdating(false);
    setEditable(false);
    return onBack();
  };

  const onUpdateTerritoryObservation = async () => {
    setUpdating(true);
    const response = await API.put({
      path: `/territory-observation/${obsDB._id}`,
      body: prepareObsForEncryption(customFieldsObs)(
        Object.assign({}, castToTerritoryObservation({ ...obs, observedAt: date }), {
          _id: obsDB._id,
          territory: route.params.territory._id,
          user: user._id,
          team: currentTeam._id,
          organisation: organisation._id,
        })
      ),
      entityType: "territory-observation",
      entityId: obsDB._id,
    });
    if (response.error) {
      setUpdating(false);
      Alert.alert(response.error);
      return false;
    }
    await refresh();
    setObs(castToTerritoryObservation(response.decryptedData as TerritoryObservationInstance));
    setObsDB(response.decryptedData as TerritoryObservationInstance);
    Alert.alert("Observation mise à jour !");
    await saveRencontres((response.decryptedData as TerritoryObservationInstance)._id);
    setUpdating(false);
    setEditable(false);
    return true;
  };

  const onDeleteRequest = () => {
    Alert.alert("Voulez-vous vraiment supprimer ce territoire ?", "Cette opération est irréversible.", [
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

  const [deleting, setDeleting] = useState(false);
  const onDelete = async () => {
    setDeleting(true);
    const response = await API.delete({ path: `/territory-observation/${obsDB._id}`, entityType: "territory-observation", entityId: obsDB._id });
    setDeleting(false);
    if (response.error) return Alert.alert(response.error);
    if (response.ok) {
      await refresh();
      Alert.alert("Observation supprimée !");
      onBack();
    }
  };

  const isUpdateDisabled = useMemo(() => {
    const newTerritoryObservation = {
      ...obsDB,
      ...castToTerritoryObservation(obs),
      observedAt: date,
    };
    if (rencontrePersons.length !== rencontresForObs.length) return false;
    if (JSON.stringify(castToTerritoryObservation(obsDB)) !== JSON.stringify(castToTerritoryObservation(newTerritoryObservation))) {
      return false;
    }
    return true;
  }, [obsDB, castToTerritoryObservation, obs, date, rencontrePersons.length, rencontresForObs.length]);

  const onGoBackRequested = () => {
    if (isUpdateDisabled) return onBack();
    Alert.alert("Voulez-vous enregistrer cette observation ?", undefined, [
      {
        text: "Enregistrer",
        onPress: async () => {
          const ok = await onSaveObservation();
          if (ok) onBack();
        },
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
  const scrollViewRef = useRef(null);

  const currentGroup = groupedCustomFieldsObs.find((group) => group.name === activeTab)!;

  return (
    <SceneContainer>
      <ScreenTitle
        title={`${route?.params?.territory?.name} - Observation`}
        onBack={onGoBackRequested}
        onEdit={!editable ? onEdit : undefined}
        onSave={!editable || isUpdateDisabled ? undefined : onSaveObservation}
        saving={updating}
        testID="observation"
      />

      <ScrollView horizontal className="flex-grow-0 gap-4 flex-shrink-0 px-2 bg-white border-b border-b-gray-300">
        {fieldsGroupNames.map((name) => {
          return (
            <TouchableOpacity key={name} onPress={() => setActiveTab(name)}>
              <View className={`p-4 bg-white ${name === activeTab ? "border-b-green-700 border-b-4" : ""}`}>
                <Text>{fieldsGroupNames.length > 1 ? name : "Informations"}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity key="rencontres" onPress={() => setActiveTab("rencontres")}>
          <View className={`p-4 bg-white ${activeTab === "rencontres" ? "border-b-green-700 border-b-4" : ""}`}>
            <Text>Rencontres</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity key="documents" onPress={() => setActiveTab("documents")}>
          <View className={`p-4 bg-white ${activeTab === "documents" ? "border-b-green-700 border-b-4" : ""}`}>
            <Text>
              Documents
              {obs.documents?.filter((d) => d.type !== "folder")?.length ? ` (${obs.documents.filter((d) => d.type !== "folder").length})` : ""}
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
      <KeyboardAvoidingView behavior="padding" className="flex-1 bg-white">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="bg-white p-4"
          ref={scrollViewRef}
          testID="observation"
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <View className="mt-3">
            {editable ? (
              <DateAndTimeInput
                label="Observation faite le"
                // @ts-expect-error Argument of type 'PossibleDate' is not assignable to parameter of type 'SetStateAction<Date>'
                setDate={(a) => setDate(a)}
                date={date}
                showTime
                showDay
                withTime
              />
            ) : (
              <CreatedAt>{dayjsInstance(date).format("dddd DD MMM HH:mm")}</CreatedAt>
            )}
            {activeTab === "rencontres" ? (
              <View key="rencontres" className="mb-4">
                {!rencontrePersons.length ? (
                  <View className="pb-6">
                    <Text className="font-semibold">Aucune rencontre enregistrée pour le moment.</Text>
                    <Text className="mt-1 text-gray-700">
                      Vous pouvez cliquer sur le bouton pour ajouter des rencontres qui seront associées à l'observation et donc au territoire
                      (n'oubliez pas de sauvegarder l'observation à la fin)
                    </Text>
                  </View>
                ) : null}
                <View className="mb-2">
                  <Button caption={"Ajouter une rencontre"} onPress={onAddRencontre} disabled={false} loading={false} />
                </View>
                {rencontrePersons.length ? <Text className="text-lg font-bold">Personnes rencontrées</Text> : null}
                {rencontrePersons.map((person) => {
                  const personRencontre = rencontresForObs.find((r) => r.person === person._id);
                  const isSaved = !!personRencontre?._id;
                  return (
                    <TouchableOpacity
                      key={person._id}
                      className="bg-gray-100 rounded p-4 my-2"
                      disabled={!isSaved}
                      onPress={() => {
                        if (isSaved) {
                          navigation.navigate("RENCONTRE", { rencontre: personRencontre, person });
                        }
                      }}
                    >
                      <View className="flex flex-row items-center">
                        <View className="grow shrink">
                          <PersonName person={person} />
                          {isSaved && personRencontre.comment ? (
                            <Text className="text-gray-500 text-xs mt-1" numberOfLines={2}>
                              {personRencontre.comment}
                            </Text>
                          ) : isSaved ? (
                            <Text className="text-gray-400 text-xs mt-1 italic">Appuyer pour ajouter un commentaire</Text>
                          ) : null}
                        </View>
                        {!isSaved ? (
                          <View className="shrink-0 !w-16 items-center flex">
                            <TouchableOpacity
                              className="bg-red-700 px-2 py-1 rounded"
                              onPress={() => {
                                setRencontrePersons((rencontrePersons) => rencontrePersons.filter((p) => p._id !== person._id));
                              }}
                            >
                              <Text className="text-white font-bold">Retirer</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <Text className="text-gray-400 text-lg ml-2">›</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : activeTab === "documents" ? (
              <View key="documents" className="mb-4">
                <Label label="Document(s)" />
                <DocumentsManager
                  personId={undefined}
                  defaultParent="observations"
                  editable={editable}
                  uploadPath={`/territory/${route.params.territory._id}/document`}
                  onAddDocument={(doc: any) => onChange({ documents: [...(obs.documents || []), doc] })}
                  onDelete={(doc: any) =>
                    onChange({
                      documents: (obs.documents || []).filter((d: any) => d.type === "folder" || d.file?.filename !== doc.file?.filename),
                    })
                  }
                  onUpdateDocument={(doc: any) =>
                    onChange({
                      documents: (obs.documents || []).map((d: any) => (d.type === "document" && d.file?.filename === doc.file?.filename ? doc : d)),
                    })
                  }
                  documents={obs.documents}
                />
              </View>
            ) : (
              <View key={currentGroup.name}>
                {currentGroup.fields
                  .filter((f) => f)
                  .filter((f) => f.enabled || (f.enabledTeams || []).includes(currentTeam._id))
                  .map((field) => {
                    const { label, name } = field;
                    return (
                      <CustomFieldInput
                        key={label}
                        label={label}
                        field={field}
                        // @ts-expect-error No index signature with a parameter of type 'string' was found on type '{ observedAt: Date; createdAt: string | Date | undefined; user: string; entityKey: string; }'
                        value={obs[name]}
                        handleChange={(newValue) => onChange({ [name]: newValue })}
                        editable={editable}
                      />
                    );
                  })}
              </View>
            )}
            <ButtonsContainer>
              {obsDB?._id ? (
                <>
                  <ButtonDelete onPress={onDeleteRequest} deleting={deleting} />
                  <Button
                    caption={editable ? "Mettre à jour" : "Modifier"}
                    onPress={editable ? onSaveObservation : onEdit}
                    disabled={editable ? isUpdateDisabled : false}
                    loading={updating}
                  />
                </>
              ) : (
                <Button caption="Enregistrer" onPress={onSaveObservation} disabled={isUpdateDisabled} loading={updating} />
              )}
            </ButtonsContainer>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SceneContainer>
  );
};

const CreatedAt = styled(MyText)`
  font-style: italic;
  margin-top: -10px;
  margin-bottom: 20px;
  margin-left: auto;
`;

const cleanValue = (value: any) => {
  if (typeof value === "string") return (value || "").trim();
  return value;
};
