import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components/native";
import { useAtomValue, useSetAtom } from "jotai";
import { v4 as uuidv4 } from "uuid";
import ScrollContainer from "../../components/ScrollContainer";
import Button from "../../components/Button";
import InputLabelled from "../../components/InputLabelled";
import ButtonsContainer from "../../components/ButtonsContainer";
import SubList from "../../components/SubList";
import DateAndTimeInput, { PossibleDate } from "../../components/DateAndTimeInput";
import GenderSelect from "../../components/Selects/GenderSelect";
import colors from "../../utils/colors";
import { currentTeamState, organisationState, userState } from "../../recoil/auth";
import { consultationsState } from "../../recoil/consultations";
import { treatmentsState } from "../../recoil/treatments";
import { customFieldsMedicalFileSelector, medicalFileState, prepareMedicalFileForEncryption } from "../../recoil/medicalFiles";
import API from "../../services/api";
import HealthInsuranceMultiCheckBox from "../../components/Selects/HealthInsuranceMultiCheckBox";
import CustomFieldInput from "../../components/CustomFieldInput";
import ConsultationRow from "../../components/ConsultationRow";
import TreatmentRow from "../../components/TreatmentRow";
import DocumentsManager from "../../components/DocumentsManager";
import { MyText } from "../../components/MyText";
import { flattenedCustomFieldsPersonsSelector } from "../../recoil/persons";
import CommentRow from "../Comments/CommentRow";
import NewCommentInput from "../Comments/NewCommentInput";
import { Alert } from "react-native";
import { itemsGroupedByPersonSelector } from "../../recoil/selectors";
import isEqual from "react-fast-compare";
import { isEmptyValue } from "../../utils";
import { alertCreateComment } from "../../utils/alert-create-comment";
import { RootStackParamList } from "@/types/navigation";
import { PersonInstance } from "@/types/person";
import { dayjsInstance } from "@/services/dateDayjs";
import { Document, DocumentWithLinkedItem, Folder, FolderWithLinkedItem } from "@/types/document";
import { MedicalFileInstance } from "@/types/medicalFile";
import { ConsultationInstance } from "@/types/consultation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TreatmentInstance } from "@/types/treatment";
import { useEditButtonStatusOnFocused } from "@/utils/hide-edit-button";

type MedicalFileProps = NativeStackScreenProps<RootStackParamList, "PERSON_STACK"> & {
  backgroundColor: string;
  onChange: (newPersonState: Partial<PersonInstance>, forceUpdate?: boolean) => void;
  onUpdatePerson: () => Promise<boolean>;
  onEdit: () => void;
  person: Omit<PersonInstance, "_id">;
  personDB: PersonInstance;
  isUpdateDisabled: boolean;
  editable: boolean;
  updating: boolean;
};

const MedicalFile = ({
  navigation,
  person,
  personDB,
  onUpdatePerson,
  updating,
  editable,
  onEdit,
  isUpdateDisabled,
  backgroundColor,
  onChange,
}: MedicalFileProps) => {
  const organisation = useAtomValue(organisationState)!;
  const currentTeam = useAtomValue(currentTeamState)!;
  const user = useAtomValue(userState)!;
  useEditButtonStatusOnFocused("show");
  const customFieldsMedicalFile = useAtomValue(customFieldsMedicalFileSelector)!;
  const flattenedCustomFieldsPersons = useAtomValue(flattenedCustomFieldsPersonsSelector);

  const allConsultations = useAtomValue(consultationsState);
  const allTreatments = useAtomValue(treatmentsState);
  const setAllMedicalFiles = useSetAtom(medicalFileState);

  const consultations = useMemo(
    () =>
      (allConsultations || [])
        .filter((c) => c.person === personDB?._id)
        .sort((p1, p2) => ((p1.completedAt || p1.dueAt) > (p2.completedAt || p2.dueAt) ? -1 : 1)),
    [allConsultations, personDB?._id],
  );

  const treatments = useMemo(() => (allTreatments || []).filter((t) => t.person === personDB?._id), [allTreatments, personDB?._id]);

  const populatedPersons = useAtomValue(itemsGroupedByPersonSelector);
  const populatedPerson = useMemo(() => populatedPersons[personDB?._id] || {}, [populatedPersons, personDB?._id]);

  const medicalFileDB = populatedPerson.medicalFile;
  const [medicalFile, setMedicalFile] = useState(populatedPerson.medicalFile);
  const [writingComment, setWritingComment] = useState("");

  useEffect(() => {
    if (!medicalFileDB) {
      (async () => {
        const response = await API.post({
          path: "/medical-file",
          body: prepareMedicalFileForEncryption(customFieldsMedicalFile)({ person: personDB?._id, documents: [], organisation: organisation._id }),
        });
        if (!response.ok) return;
        setAllMedicalFiles((medicalFiles) => [...medicalFiles, response.decryptedData]);
        setMedicalFile(response.decryptedData);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicalFileDB]);

  const backRequestHandledRef = useRef(false);
  const handleBeforeRemove = (e: any) => {
    if (backRequestHandledRef.current === true) return;
    e.preventDefault();
    onGoBackRequested();
  };
  const onBack = () => {
    backRequestHandledRef.current = true;
    navigation.goBack();
  };
  useEffect(() => {
    const beforeRemoveListenerUnsbscribe = navigation.addListener("beforeRemove", handleBeforeRemove);
    return () => {
      beforeRemoveListenerUnsbscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allMedicalComments = useMemo(() => {
    const treatmentsComments =
      treatments
        ?.map((treatment) => treatment.comments?.map((doc) => ({ ...doc, type: "treatment", treatment })))
        .filter(Boolean)
        .flat() || [];
    const consultationsComments =
      consultations
        ?.filter((consultation) => {
          if (!consultation?.onlyVisibleBy?.length) return true;
          return consultation.onlyVisibleBy.includes(user._id);
        })
        .map((consultation) => consultation.comments?.map((doc) => ({ ...doc, type: "consultation", consultation })))
        .filter(Boolean)
        .flat() || [];
    const otherComments = medicalFile?.comments || [];
    return [...treatmentsComments, ...consultationsComments, ...otherComments].sort((a, b) =>
      dayjsInstance(b.date || b.createdAt).diff(dayjsInstance(a.date || a.createdAt)),
    );
  }, [consultations, medicalFile, treatments, user]);

  const defaultDocuments = organisation.defaultMedicalFolders!.map((folder) => ({
    ...folder,
    movable: false,
    linkedItem: {
      _id: person._id,
      type: "person",
    },
  }));
  const defaultDocumentsIds = defaultDocuments.map((d) => d._id);

  const allMedicalDocuments = useMemo(() => {
    if (!medicalFile) return [];
    const treatmentsDocs: Array<DocumentWithLinkedItem | FolderWithLinkedItem> = [
      {
        _id: "treatment",
        name: "Traitements",
        position: 1,
        parentId: "root",
        type: "folder",
        linkedItem: {
          _id: medicalFile._id,
          type: "medical-file",
        },
        movable: false,
        createdAt: new Date(),
        createdBy: "we do not care",
      },
    ];
    for (const treatment of treatments) {
      for (const document of (treatment.documents || []) as Array<Document>) {
        const docWithLinkedItem: DocumentWithLinkedItem = {
          ...document,
          type: document.type ?? "document", // it will always be a document in treatments - folders are only saved in medicalFile
          linkedItem: {
            _id: treatment._id,
            type: "treatment",
          },
          parentId: document.parentId ?? "treatment",
        };
        treatmentsDocs.push(docWithLinkedItem);
      }
    }

    const consultationsDocs: Array<DocumentWithLinkedItem | FolderWithLinkedItem> = [
      {
        _id: "consultation",
        name: "Consultations",
        position: 0,
        parentId: "root",
        type: "folder",
        linkedItem: {
          _id: medicalFile._id,
          type: "medical-file",
        },
        movable: false,
        createdAt: new Date(),
        createdBy: "we do not care",
      },
    ];
    for (const consultation of consultations) {
      if (consultation?.onlyVisibleBy?.length) {
        if (!consultation.onlyVisibleBy.includes(user._id)) continue;
      }
      for (const document of (consultation.documents || []) as Array<Document>) {
        const docWithLinkedItem: DocumentWithLinkedItem = {
          ...document,
          type: document.type ?? "document", // it will always be a document in consultations - folders are only saved in medicalFile
          linkedItem: {
            _id: consultation._id,
            type: "consultation",
          },
          parentId: document.parentId ?? "consultation",
        };
        consultationsDocs.push(docWithLinkedItem);
      }
    }

    const otherDocs = [];

    for (const document of medicalFile?.documents || []) {
      const docWithLinkedItem = {
        ...document,
        type: document.type ?? "document", // or 'folder'
        linkedItem: {
          _id: medicalFile._id,
          type: "medical-file",
        },
        parentId: document.parentId ?? "root",
      };
      otherDocs.push(docWithLinkedItem);
    }

    return [
      ...treatmentsDocs,
      ...consultationsDocs,
      ...otherDocs.filter((d) => !defaultDocumentsIds.includes(d._id)),
      ...(defaultDocuments || []),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [consultations, defaultDocuments, medicalFile, treatments, user._id, defaultDocumentsIds]);

  const newCommentRef = useRef(null);

  const isMedicalFileUpdateDisabled = useMemo(() => {
    if (JSON.stringify(medicalFileDB) !== JSON.stringify(medicalFile)) return false;
    return true;
  }, [medicalFileDB, medicalFile]);

  const onGoBackRequested = async () => {
    if (writingComment.length) {
      const goToNextStep = await alertCreateComment();
      if (!goToNextStep) return;
    }
    if (isMedicalFileUpdateDisabled) return onBack();
    Alert.alert("Voulez-vous enregistrer ?", undefined, [
      {
        text: "Enregistrer",
        onPress: async () => {
          const success = await onUpdateRequest();
          if (success) onBack();
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

  const onUpdateRequest = async (latestMedicalFile?: Partial<MedicalFileInstance>): Promise<boolean> => {
    if (!latestMedicalFile) latestMedicalFile = medicalFile;

    const historyEntry = {
      date: new Date(),
      user: user._id,
      data: {} as Record<string, { oldValue: any; newValue: any }>,
    };
    for (const key in latestMedicalFile) {
      if (!customFieldsMedicalFile.map((field) => field.name).includes(key)) continue;
      if (!isEqual(latestMedicalFile[key], medicalFileDB![key])) {
        if (isEmptyValue(latestMedicalFile[key]) && isEmptyValue(medicalFileDB![key])) continue;
        historyEntry.data[key] = { oldValue: medicalFileDB![key], newValue: latestMedicalFile[key] };
      }
    }
    if (!!Object.keys(historyEntry.data).length) latestMedicalFile!.history = [...(medicalFileDB!.history || []), historyEntry];

    const response = await API.put({
      path: `/medical-file/${medicalFileDB!._id}`,
      body: prepareMedicalFileForEncryption(customFieldsMedicalFile)({ ...medicalFileDB, ...latestMedicalFile }),
    });
    if (!response.ok) return false;
    setAllMedicalFiles((medicalFiles) =>
      medicalFiles.map((m) => {
        if (m._id === medicalFileDB!._id) return response.decryptedData;
        return m;
      }),
    );
    setMedicalFile(response.decryptedData);
    const personResponse = await onUpdatePerson();
    if (!personResponse) return false;
    return true;
  };

  const onGoToConsultation = (consultationDB?: ConsultationInstance) => navigation.push("CONSULTATION_STACK", { personDB, consultationDB });
  const onGoToTreatment = (treatmentDB?: TreatmentInstance) => navigation.navigate("TREATMENT", { personDB, treatmentDB });

  const onAddDocument = async (doc: Document) => {
    const body = prepareMedicalFileForEncryption(customFieldsMedicalFile)({
      ...medicalFile,
      documents: [...(medicalFile!.documents || []), doc],
    });
    const medicalFileResponse = await API.put({ path: `/medical-file/${medicalFile!._id}`, body });

    if (medicalFileResponse.ok) {
      setAllMedicalFiles((medicalFiles) =>
        medicalFiles.map((m) => {
          if (m._id === medicalFileDB!._id) return medicalFileResponse.decryptedData;
          return m;
        }),
      );
      setMedicalFile(medicalFileResponse.decryptedData);
    }
  };

  const onUpdateDocument = async (doc: Document) => {
    const body = prepareMedicalFileForEncryption(customFieldsMedicalFile)({
      ...medicalFile,
      documents: medicalFile!.documents.map((d) => (d.type === "document" && d?.file?.filename === doc.file.filename ? doc : d)),
    });
    const medicalFileResponse = await API.put({ path: `/medical-file/${medicalFile!._id}`, body });

    if (medicalFileResponse.ok) {
      setAllMedicalFiles((medicalFiles) =>
        medicalFiles.map((m) => {
          if (m._id === medicalFileDB!._id) return medicalFileResponse.decryptedData;
          return m;
        }),
      );
      setMedicalFile(medicalFileResponse.decryptedData);
    }
  };

  const onDelete = async (doc: Document | Folder) => {
    const body = prepareMedicalFileForEncryption(customFieldsMedicalFile)({
      ...medicalFile,
      documents: medicalFile!.documents.filter((d) => d.type === "document" && d?.file?.filename !== (doc as Document).file.filename),
    });
    const medicalFileResponse = await API.put({ path: `/medical-file/${medicalFile!._id}`, body });

    if (medicalFileResponse.ok) {
      setAllMedicalFiles((medicalFiles) =>
        medicalFiles.map((m) => {
          if (m._id === medicalFileDB!._id) return medicalFileResponse.decryptedData;
          return m;
        }),
      );
      setMedicalFile(medicalFileResponse.decryptedData);
    }
  };

  return (
    <ScrollContainer noRadius keyboardShouldPersistTaps="handled" backgroundColor={backgroundColor || colors.app.color} testID="person-summary">
      <BackButton onPress={onGoBackRequested}>
        <MyText color={colors.app.color}>{"<"} Retour vers la personne</MyText>
      </BackButton>
      <InputLabelled
        label="Nom prénom ou Pseudonyme"
        onChangeText={(name) => onChange({ name })}
        value={person.name}
        placeholder="Monsieur X"
        editable={editable}
      />
      <GenderSelect onSelect={(gender) => onChange({ gender })} value={person.gender} editable={editable} />
      {editable ? (
        <DateAndTimeInput
          label="Date de naissance"
          // @ts-expect-error This comparison appears to be unintentional because the types 'Date' and 'string' have no overlap
          setDate={(birthdate: PossibleDate) => onChange({ birthdate })}
          date={person.birthdate}
          editable={editable}
          showYear
        />
      ) : (
        <InputLabelled label="Âge" value={populatedPerson.formattedBirthDate} placeholder="JJ-MM-AAAA" editable={false} />
      )}
      {/* These custom fields are displayed by default, because they where displayed before they became custom fields */}
      {Boolean(flattenedCustomFieldsPersons.find((e) => e.name === "healthInsurances")) && (
        <HealthInsuranceMultiCheckBox
          values={person.healthInsurances}
          onChange={(healthInsurances) => onChange({ healthInsurances })}
          editable={editable}
        />
      )}
      {Boolean(flattenedCustomFieldsPersons.find((e) => e.name === "structureMedical")) && (
        <InputLabelled
          label="Structure de suivi médical"
          onChangeText={(structureMedical) => onChange({ structureMedical })}
          value={person.structureMedical || (editable ? null : "-- Non renseignée --")}
          placeholder="Renseignez la structure médicale le cas échéant"
          editable={editable}
        />
      )}
      {customFieldsMedicalFile
        .filter((f) => f)
        .filter((f) => f.enabled || f.enabledTeams?.includes(currentTeam._id))
        .map((field) => {
          const { label, name } = field;
          console.log("label", label, name);
          return (
            <CustomFieldInput
              key={name}
              label={label}
              field={field}
              value={medicalFile?.[name]}
              handleChange={(newValue) => setMedicalFile((file) => ({ ...file!, [name]: newValue }))}
              editable={editable}
            />
          );
        })}

      <ButtonsContainer>
        <Button
          caption={editable ? "Mettre à jour" : "Modifier"}
          onPress={() => (editable ? onUpdateRequest() : onEdit())}
          disabled={editable ? isUpdateDisabled && isMedicalFileUpdateDisabled : false}
          loading={updating}
        />
      </ButtonsContainer>
      <SubList
        label="Commentaires"
        key={medicalFileDB?._id ?? "" + allMedicalComments.length}
        data={allMedicalComments}
        renderItem={(comment) => (
          <CommentRow
            key={comment._id}
            comment={comment}
            itemName={
              ["consultation", "treatment"].includes(comment.type) ? `${comment.type === "consultation" ? "Consultation" : "Traitement"}` : undefined
            }
            onItemNamePress={
              ["consultation", "treatment"].includes(comment.type)
                ? () => (comment.type === "consultation" ? onGoToConsultation(comment.consultation) : onGoToTreatment(comment.treatment))
                : undefined
            }
            onDelete={
              comment.type === "medical-file"
                ? async () => {
                    const medicalFileToSave: MedicalFileInstance = {
                      ...medicalFile!,
                      comments: medicalFile!.comments.filter((c) => c._id !== comment._id),
                    };
                    setMedicalFile(medicalFileToSave); // optimistic UI
                    // need to pass `medicalFileToSave` if we want last comment to be taken into account
                    // https://react.dev/reference/react/useState#ive-updated-the-state-but-logging-gives-me-the-old-value
                    const success = await onUpdateRequest(medicalFileToSave);
                    return success;
                  }
                : undefined
            }
            onUpdate={
              comment.type === "medical-file"
                ? async (commentUpdated) => {
                    const medicalFileToSave = {
                      ...medicalFile!,
                      comments: medicalFile!.comments.map((c) => (c._id === comment._id ? commentUpdated : c)),
                    };
                    setMedicalFile(medicalFileToSave); // optimistic UI
                    // need to pass `medicalFileToSave` if we want last comment to be taken into account
                    // https://react.dev/reference/react/useState#ive-updated-the-state-but-logging-gives-me-the-old-value
                    const success = await onUpdateRequest(medicalFileToSave);
                    return success;
                  }
                : undefined
            }
          />
        )}
        ifEmpty="Pas encore de commentaire"
      >
        <NewCommentInput
          forwardRef={newCommentRef}
          onCommentWrite={setWritingComment}
          onCreate={async (newComment) => {
            const newComments = [{ ...newComment, type: "medical-file", _id: uuidv4() }, ...(medicalFile!.comments || [])];
            const medicalFileToSave = { ...medicalFile!, comments: newComments };
            setMedicalFile(medicalFileToSave); // optimistic UI
            // need to pass comments as parameters if we want last comment to be taken into account
            // https://react.dev/reference/react/useState#ive-updated-the-state-but-logging-gives-me-the-old-value
            return await onUpdateRequest(medicalFileToSave);
          }}
        />
      </SubList>
      <SubList
        label="Traitements"
        onAdd={() => onGoToTreatment()}
        data={treatments}
        renderItem={(treatment) => <TreatmentRow treatment={treatment} key={treatment._id} onTreatmentPress={onGoToTreatment} />}
        ifEmpty="Pas encore de traitement"
      />
      <SubList
        label="Consultations"
        onAdd={() => onGoToConsultation()}
        testID="person-consultations-list"
        data={consultations}
        renderItem={(consultation) => (
          <ConsultationRow consultation={consultation} key={consultation._id} onConsultationPress={onGoToConsultation} showStatus />
        )}
        ifEmpty="Pas encore de consultation"
      />
      <SubList
        disableVoirPlus={true}
        label="Documents médicaux"
        data={allMedicalDocuments}
        customCount={allMedicalDocuments.filter((d) => d.type === "document").length}
        renderItem={() => null}
        ifEmpty="Pas encore de document médical"
      >
        <DocumentsManager
          defaultParent="root"
          documents={allMedicalDocuments}
          personDB={personDB}
          onUpdateDocument={onUpdateDocument}
          onAddDocument={onAddDocument}
          onDelete={onDelete}
        />
      </SubList>
    </ScrollContainer>
  );
};

const BackButton = styled.TouchableOpacity`
  margin-right: auto;
  margin-bottom: 25px;
`;

export default MedicalFile;
