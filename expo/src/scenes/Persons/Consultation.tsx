import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, ScrollView, View } from "react-native";
import { useAtomValue, useSetAtom } from "jotai";
import { v4 as uuidv4 } from "uuid";
import ScrollContainer from "../../components/ScrollContainer";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import InputLabelled from "../../components/InputLabelled";
import Button from "../../components/Button";
import API from "../../services/api";
import DateAndTimeInput from "../../components/DateAndTimeInput";
import DocumentsManager from "../../components/DocumentsManager";
import Spacer from "../../components/Spacer";
import Label from "../../components/Label";
import ActionStatusSelect from "../../components/Selects/ActionStatusSelect";
import {
  consultationsFieldsIncludingCustomFieldsSelector,
  consultationsState,
  encryptedFields,
  prepareConsultationForEncryption,
} from "../../recoil/consultations";
import ConsultationTypeSelect from "../../components/Selects/ConsultationTypeSelect";
import CustomFieldInput from "../../components/CustomFieldInput";
import { currentTeamState, organisationState, userState } from "../../recoil/auth";
import { CANCEL, DONE, TODO } from "../../recoil/actions";
import CheckboxLabelled from "../../components/CheckboxLabelled";
import ButtonsContainer from "../../components/ButtonsContainer";
import ButtonDelete from "../../components/ButtonDelete";
import InputFromSearchList from "../../components/InputFromSearchList";
import CommentRow from "../Comments/CommentRow";
import SubList from "../../components/SubList";
import NewCommentInput from "../Comments/NewCommentInput";
import { refreshTriggerState } from "../../components/Loader";
import isEqual from "react-fast-compare";
import { isEmptyValue } from "../../utils";
import { alertCreateComment } from "../../utils/alert-create-comment";
import { createNativeStackNavigator, NativeStackScreenProps } from "@react-navigation/native-stack";
import { ConsultationStackParams, RootStackParamList } from "@/types/navigation";
import { ConsultationInstance } from "@/types/consultation";
import PersonsSearch from "./PersonsSearch";
import NewPersonForm from "./NewPersonForm";
import { PersonInstance, PersonPopulated } from "@/types/person";
import { itemsGroupedByPersonSelector } from "../../recoil/selectors";
import { CommentInstance } from "@/types/comment";
import { Document, Folder } from "@/types/document";
import { TeamInstance } from "@/types/team";

const cleanValue = (value: any) => {
  if (typeof value === "string") return (value || "").trim();
  return value;
};
type DocumentOrFolder = Document | Folder;
type Props = NativeStackScreenProps<RootStackParamList, "CONSULTATION">;
type ConsultationWithoutId = Omit<ConsultationInstance, "_id">;

const ConsultationStack = createNativeStackNavigator<ConsultationStackParams>();

const castToConsultation = (
  consult: Partial<ConsultationInstance> = {},
  organisation: { consultations: any[]; _id: string },
  personId: string | undefined,
  userId: string
): ConsultationWithoutId => {
  const toReturn: ConsultationWithoutId = {};
  const consultationTypeCustomFields = consult?.type
    ? organisation.consultations.find((c) => c?.name === consult?.type)?.fields
    : organisation.consultations[0]?.fields;
  const encryptedFieldsIncludingCustom = [...(consultationTypeCustomFields?.map((f: any) => f.name) || []), ...encryptedFields];
  for (const field of encryptedFieldsIncludingCustom) {
    toReturn[field] = cleanValue(consult[field]);
  }
  return {
    ...toReturn,
    name: consult.name || "",
    type: consult.type || "",
    status: consult.status || TODO,
    dueAt: consult.dueAt || null,
    person: consult.person || personId,
    completedAt: consult.completedAt || null,
    onlyVisibleBy: consult.onlyVisibleBy || [],
    user: consult.user || userId,
    teams: consult.teams || ([] as ConsultationInstance["teams"]),
    history: consult.history || ([] as ConsultationInstance["history"]),
    documents: consult.documents || ([] as ConsultationInstance["documents"]),
    organisation: consult.organisation || organisation._id,
  };
};

const ConsultationScreen = (props: Props) => {
  const allConsultations = useAtomValue(consultationsState);
  const organisation = useAtomValue(organisationState)!;
  const user = useAtomValue(userState)!;
  const allPersonsObject = useAtomValue(itemsGroupedByPersonSelector) as Record<string, PersonPopulated>;

  const consultationDB = useMemo(() => {
    if (props.route?.params?.consultationDB?._id) {
      return allConsultations.find((c) => c._id === props.route?.params?.consultationDB?._id);
    } else {
      return {
        user: user._id,
        person: props.route?.params?.personDB?._id,
      } as ConsultationInstance;
    }
  }, [allConsultations, props.route?.params?.consultationDB?._id, user._id, props.route?.params?.personDB?._id]);

  const [consultation, setConsultation] = useState(() =>
    castToConsultation(consultationDB, organisation, props.route?.params?.personDB?._id, user._id)
  );

  // Get person from consultation.person ID (can be different from route.params.personDB after person search)
  const person = useMemo(() => {
    if (consultation.person) {
      return allPersonsObject[consultation.person];
    }
    return props.route?.params?.personDB;
  }, [consultation.person, allPersonsObject, props.route?.params?.personDB]);

  useEffect(() => {
    setConsultation(castToConsultation(consultationDB, organisation, props.route?.params?.personDB?._id, user._id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationDB?.updatedAt]);

  useEffect(() => {
    if (props.route?.params?.duplicate) {
      Alert.alert(
        "La consultation est dupliquée, vous pouvez la modifier !",
        "Les commentaires de la consultation aussi sont dupliqués. La consultation originale est annulée."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ConsultationStack.Navigator>
      <ConsultationStack.Screen name="CONSULTATION">
        {(stackProps) => (
          <ConsultationForm
            {...props}
            consultationDB={consultationDB!}
            consultation={consultation}
            setConsultation={setConsultation}
            person={person}
            onSearchPerson={() => stackProps.navigation.push("PERSONS_SEARCH")}
          />
        )}
      </ConsultationStack.Screen>
      <ConsultationStack.Screen name="PERSONS_SEARCH" options={{ title: "Rechercher une personne" }}>
        {(stackProps) => (
          <PersonsSearch
            onBack={() => stackProps.navigation.goBack()}
            onCreatePersonRequest={() => stackProps.navigation.navigate("PERSON_NEW")}
            onPersonSelected={(selectedPerson) => {
              stackProps.navigation.goBack();
              setConsultation((c) => ({ ...c, person: selectedPerson._id }));
            }}
          />
        )}
      </ConsultationStack.Screen>
      <ConsultationStack.Screen name="PERSON_NEW" options={{ title: "Nouvelle personne" }}>
        {(stackProps) => (
          <NewPersonForm
            onBack={() => stackProps.navigation.goBack()}
            onPersonCreated={(createdPerson) => {
              stackProps.navigation.goBack();
              setConsultation((c) => ({ ...c, person: createdPerson._id }));
            }}
          />
        )}
      </ConsultationStack.Screen>
    </ConsultationStack.Navigator>
  );
};

type ConsultationFormProps = Props & {
  consultationDB: ConsultationInstance;
  consultation: ConsultationWithoutId;
  setConsultation: React.Dispatch<React.SetStateAction<ConsultationWithoutId>>;
  person: PersonInstance | undefined;
  onSearchPerson: () => void;
};

const ConsultationForm = ({ navigation, route, consultationDB, consultation, setConsultation, person, onSearchPerson }: ConsultationFormProps) => {
  const setAllConsultations = useSetAtom(consultationsState);
  const organisation = useAtomValue(organisationState)!;
  const user = useAtomValue(userState)!;
  const currentTeam = useAtomValue(currentTeamState)!;
  const consultationsFieldsIncludingCustomFields = useAtomValue(consultationsFieldsIncludingCustomFieldsSelector)!;
  const setRefreshTrigger = useSetAtom(refreshTriggerState);

  const isNew = !consultationDB?._id;
  const [writingComment, setWritingComment] = useState("");

  const [posting, setPosting] = useState(false);
  const [editable, setEditable] = useState(!!isNew);
  const [deleting, setDeleting] = useState(false);

  const onChange = (keyValue: Partial<ConsultationInstance>) => setConsultation((c) => ({ ...c, ...keyValue }));

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

  useEffect(() => {
    if (!editable) {
      if (consultation.status !== consultationDB.status) onSaveConsultationRequest();
      if (JSON.stringify(consultation.onlyVisibleBy) !== JSON.stringify(consultationDB.onlyVisibleBy)) {
        onSaveConsultationRequest({ goBackOnSave: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, consultation.status, consultation.onlyVisibleBy]);

  const onDuplicate = async () => {
    const response = await API.post({
      path: "/consultation",
      body: prepareConsultationForEncryption(organisation.consultations)({
        ...consultation,
        _id: undefined,
        status: TODO,
        user: user._id,
        teams: [currentTeam._id],
        comments: (consultation.comments || []).map((c: CommentInstance) => ({ ...c, _id: uuidv4() })),
        documents: (consultation.documents || []).map((d: DocumentOrFolder) => ({ ...d, _id: d._id + "__" + uuidv4() })),
        completedAt: null,
        history: [],
      }),
    });
    if (!response.ok) {
      Alert.alert("Impossible de dupliquer !");
      return;
    }
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
    backRequestHandledRef.current = true;
    navigation.replace("CONSULTATION", {
      personDB: person,
      consultationDB: response.decryptedData,
      editable: true,
      duplicate: true,
    });
  };

  const onSaveConsultationRequest = useCallback(
    async ({
      goBackOnSave = true,
      consultationToSave,
    }: { goBackOnSave?: boolean; consultationToSave?: Partial<ConsultationInstance> } = {}): Promise<boolean> => {
      if (!consultationToSave) consultationToSave = consultation;
      if (!consultationToSave.status) {
        Alert.alert("Veuillez indiquer un statut");
        return false;
      }
      if (!consultationToSave.dueAt) {
        Alert.alert("Veuillez indiquer une date");
        return false;
      }
      if (!consultationToSave.type) {
        Alert.alert("Veuillez indiquer un type");
        return false;
      }
      if (!consultationToSave.person) {
        Alert.alert("Veuillez ajouter une personne");
        return false;
      }
      Keyboard.dismiss();
      setPosting(true);
      if ([DONE, CANCEL].includes(consultationToSave.status)) {
        if (!consultationToSave.completedAt) consultationToSave.completedAt = new Date();
      } else {
        consultationToSave.completedAt = null;
      }

      if (!isNew) {
        const historyEntry = {
          date: new Date(),
          user: user._id,
          data: {} as Record<string, { oldValue: any; newValue: any }>,
        };
        for (const key in consultationToSave) {
          if (!consultationsFieldsIncludingCustomFields.map((field) => field.name).includes(key)) continue;
          if (!isEqual(consultationToSave[key], consultationDB[key])) {
            if (isEmptyValue(consultationToSave[key]) && isEmptyValue(consultationDB[key])) continue;
            historyEntry.data[key] = { oldValue: consultationDB[key], newValue: consultationToSave[key] };
          }
        }
        if (!!Object.keys(historyEntry.data).length) consultationToSave.history = [...(consultationDB.history || []), historyEntry];
      }

      const body = prepareConsultationForEncryption(organisation.consultations)({
        ...consultationToSave,
        teams: isNew ? [currentTeam._id] : consultationToSave.teams,
        _id: consultationDB?._id,
      });

      const consultationResponse = isNew
        ? await API.post({ path: "/consultation", body })
        : await API.put({ path: `/consultation/${consultationDB._id}`, body });
      if (!consultationResponse.ok) return false;

      setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });

      const consultationCancelled = consultationToSave.status === CANCEL && consultationDB.status !== CANCEL;
      if (!isNew && consultationCancelled) {
        Alert.alert("Cette consultation est annulée, voulez-vous la dupliquer ?", "Avec une date ultérieure par exemple", [
          { text: "Oui", onPress: onDuplicate },
          {
            text: "Non merci !",
            onPress: () => {
              if (goBackOnSave) {
                onBack();
              } else {
                setPosting(false);
                setConsultation(castToConsultation(consultationResponse.decryptedData, organisation, person?._id, user._id));
                return true;
              }
            },
            style: "cancel",
          },
        ]);
        return true;
      }

      if (goBackOnSave) {
        onBack();
      } else {
        setPosting(false);
        setConsultation(castToConsultation(consultationResponse.decryptedData, organisation, person?._id, user._id));
      }
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [consultation]
  );

  const onDeleteRequest = () => {
    Alert.alert("Voulez-vous vraiment supprimer cette consultation ?", "Cette opération est irréversible.", [
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

  const onDelete = async () => {
    setDeleting(true);
    const response = await API.delete({ path: `/consultation/${consultationDB._id}` });
    if (!response.ok) {
      Alert.alert(response.error);
      return;
    }
    setAllConsultations((all) => all.filter((t) => t._id !== consultationDB._id));
    Alert.alert("Consultation supprimée !");
    onBack();
  };

  const isDisabled = useMemo(() => {
    const consultationDBCast = castToConsultation(consultationDB, organisation, person?._id, user._id);
    const consultationCast = castToConsultation(consultation, organisation, person?._id, user._id);
    if (JSON.stringify(consultationDBCast) === JSON.stringify(consultationCast)) return true;
    return false;
  }, [consultationDB, consultation, organisation, person?._id, user._id]);

  const onBack = () => {
    backRequestHandledRef.current = true;
    navigation.goBack();
    setTimeout(() => setPosting(false), 250);
    setTimeout(() => setDeleting(false), 250);
  };

  const onGoBackRequested = async () => {
    if (writingComment.length) {
      const goToNextStep = await alertCreateComment();
      if (!goToNextStep) return;
    }
    if (isDisabled) return onBack();
    Alert.alert("Voulez-vous enregistrer cette consultation ?", undefined, [
      {
        text: "Enregistrer",
        onPress: async () => {
          await onSaveConsultationRequest();
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

  const scrollViewRef = useRef<ScrollView>(null);
  const newCommentRef = useRef<View>(null);

  const canEditAllFields = useMemo(() => {
    return ["normal", "admin"].includes(user.role);
  }, [user.role]);

  const canDelete = canEditAllFields;

  return (
    <SceneContainer testID="consultation-form">
      <ScreenTitle
        title={`${isNew ? `Nouvelle consultation${person?.name ? " pour" : ""}` : `Modifier la consultation ${consultation?.name} de`} ${
          person?.name || ""
        }`}
        onBack={onGoBackRequested}
        onEdit={!editable ? () => setEditable(true) : undefined}
        onSave={!editable || isDisabled ? undefined : () => onSaveConsultationRequest()}
        saving={posting}
        testID="consultation"
      />
      <KeyboardAvoidingView behavior="padding" className="flex-1 bg-white">
        <ScrollContainer ref={scrollViewRef} keyboardShouldPersistTaps="handled">
          <View>
            {!!isNew && !route?.params?.personDB && (
              <InputFromSearchList label="Personne concernée" value={person?.name || "-- Aucune --"} onSearchRequest={onSearchPerson} />
            )}
            <InputLabelled
              label="Nom (facultatif)"
              value={consultation.name}
              onChangeText={(name) => onChange({ name })}
              placeholder="Nom de la consultation (facultatif)"
              testID="consultation-name"
              editable={editable}
            />
            <ConsultationTypeSelect editable={editable} value={consultation.type} onSelect={(type) => onChange({ type })} />
            {canEditAllFields &&
              organisation.consultations
                .find((e) => e.name === consultation.type)
                ?.fields.filter((f) => f)
                .filter((f) => f.enabled || f.enabledTeams?.includes(currentTeam._id))
                .map((field) => {
                  const { label, name } = field;
                  return (
                    <CustomFieldInput
                      key={label}
                      label={label}
                      field={field}
                      value={consultation[name]}
                      handleChange={(newValue) => onChange({ [name]: newValue })}
                      editable={editable}
                    />
                  );
                })}
            {canEditAllFields && (
              <>
                <Label label="Document(s)" />
                <DocumentsManager
                  defaultParent="consultation"
                  personDB={person}
                  onAddDocument={(doc: DocumentOrFolder) => onChange({ documents: [...(consultation.documents || []), doc] })}
                  onDelete={(doc: Document) =>
                    onChange({
                      documents: consultation.documents.filter((d: DocumentOrFolder) => d.type === "folder" || d.file.filename !== doc.file.filename),
                    })
                  }
                  onUpdateDocument={(doc: Document) =>
                    onChange({
                      documents: consultation.documents.map((d: DocumentOrFolder) =>
                        d.type === "document" && d.file?.filename === doc.file?.filename ? doc : d
                      ),
                    })
                  }
                  documents={consultationDB.documents}
                />
              </>
            )}
            <Spacer />
            <ActionStatusSelect
              value={consultation.status}
              onSelect={(status) => onChange({ status })}
              onSelectAndSave={(status) => {
                if (!status) onChange({ status: TODO });
                else onChange({ status });
              }}
              editable={editable}
              testID="consultation-status"
            />
            <DateAndTimeInput
              label="À faire le"
              date={consultation.dueAt}
              setDate={(dueAt) => onChange({ dueAt })}
              editable={editable}
              showDay
              showTime
              withTime
            />
            {consultation.status !== TODO ? (
              <DateAndTimeInput
                label={consultation.status === DONE ? "Faite le" : "Annulée le"}
                setDate={(completedAt) => onChange({ completedAt })}
                date={consultation.completedAt || new Date().toISOString()}
                showTime
                showDay
                withTime
                editable={editable}
              />
            ) : null}
            {canEditAllFields && consultationDB?.user === user._id ? (
              <CheckboxLabelled
                _id="only-visible-by-me"
                label="Seulement visible par moi"
                alone
                onPress={() => {
                  onChange({ onlyVisibleBy: consultation.onlyVisibleBy?.includes(user._id) ? [] : [user._id] });
                }}
                value={consultation.onlyVisibleBy?.includes(user._id)}
              />
            ) : null}
            <ButtonsContainer>
              {!isNew && canDelete && <ButtonDelete onPress={onDeleteRequest} deleting={deleting} />}
              <Button
                caption={isNew ? "Créer" : editable ? "Mettre à jour" : "Modifier"}
                disabled={editable ? isDisabled : false}
                onPress={editable ? () => onSaveConsultationRequest() : () => setEditable(true)}
                loading={posting}
                testID="consultation-create"
              />
            </ButtonsContainer>
            {canEditAllFields && (
              <>
                <SubList label="Constantes">
                  <React.Fragment key={`${consultationDB?._id}${editable}`}>
                    {[
                      { name: "constantes-poids", label: "Poids (kg)" },
                      { name: "constantes-frequence-cardiaque", label: "Taille (cm)" },
                      { name: "constantes-taille", label: "Fréquence cardiaque (bpm)" },
                      { name: "constantes-saturation-o2", label: "Fréq. respiratoire (mvts/min)" },
                      { name: "constantes-temperature", label: "Saturation en oxygène (%)" },
                      { name: "constantes-glycemie-capillaire", label: "Glycémie capillaire (g/L)" },
                      { name: "constantes-frequence-respiratoire", label: "Température (°C)" },
                      { name: "constantes-tension-arterielle-systolique", label: "Tension artérielle systolique (mmHg)" },
                      { name: "constantes-tension-arterielle-diastolique", label: "Tension artérielle diastolique (mmHg)" },
                    ].map((constante) => {
                      return (
                        <InputLabelled
                          key={constante.name}
                          label={constante.label}
                          value={consultation[constante.name]}
                          onChangeText={(value) => onChange({ [constante.name]: value })}
                          placeholder="50"
                          keyboardType="number-pad"
                          testID={constante.name}
                          editable={editable}
                        />
                      );
                    })}
                  </React.Fragment>
                </SubList>
                <SubList
                  label="Commentaires"
                  key={consultationDB?._id}
                  data={consultation.comments}
                  renderItem={(comment) => (
                    <CommentRow
                      key={comment._id}
                      comment={comment}
                      onDelete={async () => {
                        const consultationToSave = {
                          ...consultation,
                          comments: consultation.comments.filter((c: CommentInstance) => c._id !== comment._id),
                        };
                        setConsultation(consultationToSave); // optimistic UI
                        if (!isNew) {
                          // need to pass `consultationToSave` if we want last comment to be taken into account
                          // https://react.dev/reference/react/useState#ive-updated-the-state-but-logging-gives-me-the-old-value
                          return onSaveConsultationRequest({ goBackOnSave: false, consultationToSave });
                        }
                        return true;
                      }}
                      onUpdate={async (commentUpdated) => {
                        const consultationToSave = {
                          ...consultation,
                          comments: consultation.comments.map((c: CommentInstance) => (c._id === comment._id ? commentUpdated : c)),
                        };
                        setConsultation(consultationToSave); // optimistic UI
                        if (!isNew) {
                          // need to pass `consultationToSave` if we want last comment to be taken into account
                          // https://react.dev/reference/react/useState#ive-updated-the-state-but-logging-gives-me-the-old-value
                          return onSaveConsultationRequest({ goBackOnSave: false, consultationToSave });
                        }
                        return true;
                      }}
                    />
                  )}
                  ifEmpty="Pas encore de commentaire"
                >
                  <NewCommentInput
                    forwardRef={newCommentRef}
                    onCommentWrite={setWritingComment}
                    onCreate={async (newComment) => {
                      const consultationToSave = {
                        ...consultation,
                        comments: [{ ...newComment, type: "consultation", _id: uuidv4() }, ...(consultation.comments || [])],
                      };
                      setConsultation(consultationToSave); // optimistic UI
                      if (!isNew) {
                        // need to pass `consultationToSave` if we want last comment to be taken into account
                        // https://react.dev/reference/react/useState#ive-updated-the-state-but-logging-gives-me-the-old-value
                        return await onSaveConsultationRequest({ goBackOnSave: false, consultationToSave });
                      }
                      return true;
                    }}
                  />
                </SubList>
              </>
            )}
          </View>
        </ScrollContainer>
      </KeyboardAvoidingView>
    </SceneContainer>
  );
};

export default ConsultationScreen;
