import dayjs from "dayjs";
import { Formik } from "formik";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button, Col, Modal, ModalBody, ModalHeader, Row } from "reactstrap";
import { useRecoilState, useRecoilValue } from "recoil";
import styled from "styled-components";
import ButtonCustom from "../../components/ButtonCustom";
import CustomFieldInput from "../../components/CustomFieldInput";
import { useDataLoader } from "../../services/dataLoader";
import SelectCustom from "../../components/SelectCustom";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";
import UserName from "../../components/UserName";
import Table from "../../components/table";
import { actionsState, prepareActionForEncryption } from "../../recoil/actions";
import { currentTeamState, organisationState, teamsState, userState } from "../../recoil/auth";
import { commentsState, prepareCommentForEncryption } from "../../recoil/comments";
import { consultationsState, prepareConsultationForEncryption } from "../../recoil/consultations";
import { groupsState, prepareGroupForEncryption } from "../../recoil/groups";
import { customFieldsMedicalFileSelector, medicalFileState, prepareMedicalFileForEncryption } from "../../recoil/medicalFiles";
import { passagesState, preparePassageForEncryption } from "../../recoil/passages";
import {
  allowedPersonFieldsInHistorySelector,
  personFieldsIncludingCustomFieldsSelector,
  personsState,
  usePreparePersonForEncryption,
} from "../../recoil/persons";
import { prepareRelPersonPlaceForEncryption, relsPersonPlaceState } from "../../recoil/relPersonPlace";
import { prepareRencontreForEncryption, rencontresState } from "../../recoil/rencontres";
import { prepareTreatmentForEncryption, treatmentsState } from "../../recoil/treatments";
import API, { tryFetchExpectOk } from "../../services/api";
import { formatAge } from "../../services/date";
import { encryptItem } from "../../services/encryption";
import { isEmptyValue } from "../../utils";

const getRawValue = (field, value) => {
  try {
    if (field.type === "text") return <span>{value}</span>;
    if (field.type === "textarea") return <span>{value}</span>;
    if (field.type === "number") return <span>{value}</span>;
    if (field.type === "date") return <span>{dayjs(value).format("DD/MM/YYYY")}</span>;
    if (field.type === "date-with-time") return <span>{dayjs(value).format("DD/MM/YYYY HH:mm")}</span>;
    if (field.type === "duration") return <span>{formatAge(value)}</span>;
    if (field.type === "yes-no") return <span>{value}</span>;
    if (field.type === "enum") return <span>{value}</span>;
    if (field.type === "multi-choice") return <span>{(value || []).join(", ")}</span>;
    if (field.type === "boolean") return <input type="checkbox" defaultChecked={value} />;
    // eslint-disable-next-line no-empty
  } catch (_e) {}
  return "";
};

const initMergeValue = (field, originPerson = {}, personToMergeAndDelete = {}) => {
  if (Array.isArray(originPerson[field.name])) {
    if (!originPerson[field.name]?.length) return personToMergeAndDelete[field.name];
    return originPerson[field.name];
  }
  return originPerson[field.name] || personToMergeAndDelete[field.name];
};

const MergeTwoPersons = ({ person }) => {
  const [open, setOpen] = useState(false);
  const [persons, setPersons] = useRecoilState(personsState);
  const teams = useRecoilValue(teamsState);
  const organisation = useRecoilValue(organisationState);
  const user = useRecoilValue(userState);
  const currentTeam = useRecoilValue(currentTeamState);
  const comments = useRecoilValue(commentsState);
  const actions = useRecoilValue(actionsState);
  const passages = useRecoilValue(passagesState);
  const rencontres = useRecoilValue(rencontresState);
  const groups = useRecoilValue(groupsState);
  const relsPersonPlace = useRecoilValue(relsPersonPlaceState);
  const consultations = useRecoilValue(consultationsState);
  const medicalFiles = useRecoilValue(medicalFileState);
  const treatments = useRecoilValue(treatmentsState);
  const customFieldsMedicalFile = useRecoilValue(customFieldsMedicalFileSelector);
  const { preparePersonForEncryption } = usePreparePersonForEncryption();

  const { refresh } = useDataLoader();

  const [originPerson, setOriginPerson] = useState(person);
  useEffect(() => {
    setOriginPerson(person);
  }, [person]);
  const [personToMergeAndDelete, setPersonToMergeAndDelete] = useState(null);

  const allFields = useRecoilValue(personFieldsIncludingCustomFieldsSelector);
  const allowedFieldsInHistory = useRecoilValue(allowedPersonFieldsInHistorySelector);

  const personsToMergeWith = useMemo(() => persons.filter((p) => p._id !== originPerson?._id), [persons, originPerson]);

  const originPersonMedicalFile = useMemo(() => medicalFiles.find((p) => p.person === originPerson?._id), [medicalFiles, originPerson]);
  const personToMergeMedicalFile = useMemo(
    () => medicalFiles.find((p) => p.person === personToMergeAndDelete?._id),
    [medicalFiles, personToMergeAndDelete]
  );

  const fields = useMemo(() => {
    if (!originPerson || !personToMergeAndDelete) return [];
    return [...new Set([...Object.keys(originPerson), ...Object.keys(personToMergeAndDelete)])]
      .filter((fieldName) => !["_id", "encryptedEntityKey", "entityKey", "createdAt", "updatedAt", "organisation", "documents"].includes(fieldName))
      .map((fieldName) => allFields.find((f) => f.name === fieldName))
      .filter(Boolean);
  }, [originPerson, personToMergeAndDelete, allFields]);

  const medicalFields = useMemo(() => {
    if (!originPerson || !personToMergeAndDelete) return [];
    return [...new Set([...Object.keys(originPersonMedicalFile || {}), ...Object.keys(personToMergeMedicalFile || {})])]
      .filter(
        (fieldName) =>
          !["_id", "encryptedEntityKey", "entityKey", "createdAt", "updatedAt", "organisation", "documents", "person"].includes(fieldName)
      )
      .map((fieldName) => customFieldsMedicalFile.find((f) => f.name === fieldName))
      .filter(Boolean);
  }, [originPerson, personToMergeAndDelete, originPersonMedicalFile, personToMergeMedicalFile, customFieldsMedicalFile]);

  const initMergedPerson = useMemo(() => {
    if (!originPerson || !personToMergeAndDelete) return null;
    const mergedPerson = {};
    for (let field of fields) {
      mergedPerson[field.name] = initMergeValue(field, originPerson, personToMergeAndDelete);
    }
    for (let medicalField of medicalFields) {
      mergedPerson[medicalField.name] = initMergeValue(medicalField, originPersonMedicalFile, personToMergeMedicalFile);
    }
    return {
      _id: originPerson._id,
      organisation: originPerson.organisation,
      createdAt: originPerson.createdAt,
      updatedAt: originPerson.updatedAt,
      entityKey: originPerson.entityKey,
      documents: [
        ...(originPerson.documents || []),
        ...(personToMergeAndDelete.documents || []).map((_docOrFolder) => {
          if (_docOrFolder.type === "folder") return _docOrFolder;
          const _doc = _docOrFolder;
          return {
            ..._doc,
            downloadPath: _doc.downloadPath ?? `/person/${personToMergeAndDelete._id}/document/${_doc.file.filename}`,
          };
        }),
      ],
      ...mergedPerson,
    };
  }, [originPerson, personToMergeAndDelete, fields, medicalFields, originPersonMedicalFile, personToMergeMedicalFile]);

  useEffect(() => {
    if (!originPerson || !personToMergeAndDelete) return;
    if (user.healthcareProfessional) return;

    // a non professional is not allowed to see medical data
    // so we need to check if there is some medical data to merge
    // if there is some choices to make regarding medical data,
    // then we forbid any no health professional to merge the persons
    for (const medicalField of medicalFields) {
      const originValue = originPersonMedicalFile?.[medicalField.name];
      const mergeValue = personToMergeMedicalFile?.[medicalField.name];
      if (!originValue?.length && !mergeValue?.length) continue;
      if (!originValue?.length && !!mergeValue?.length) continue;
      if (!!originValue?.length && !mergeValue?.length) continue;
      if (JSON.stringify(originValue) === JSON.stringify(mergeValue)) continue;
      alert(
        "Les champs médicaux ne sont pas identiques. Vous devez être un·e professionnel·le de santé pour fusionner des dossiers médicaux différents."
      );
      setPersonToMergeAndDelete(null);
      return;
    }
  }, [originPerson, personToMergeAndDelete, user, medicalFields, originPersonMedicalFile, personToMergeMedicalFile]);

  return (
    <>
      <ButtonCustom title="Fusionner avec un autre dossier" color="link" type="button" onClick={() => setOpen(true)} />
      <StyledModal isOpen={open} toggle={() => setOpen(false)} size="xl" centered>
        <ModalHeader toggle={() => setOpen(false)} color="danger">
          <Row style={{ justifyContent: "center", marginTop: 10 }}>
            <Col style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }} md={4}>
              Fusionner
            </Col>
            <Col md={6}>
              <SelectCustom
                options={personsToMergeWith}
                inputId="origin-person-with-select"
                classNamePrefix="origin-person-with-select"
                isClearable
                isSearchable
                onChange={setOriginPerson}
                value={originPerson}
                getOptionValue={(i) => i._id}
                getOptionLabel={(i) => i?.name || ""}
              />
            </Col>
            <Col md={2} />
          </Row>
          <Row style={{ justifyContent: "center", marginTop: 10 }}>
            <Col style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }} md={4}>
              avec
            </Col>
            <Col md={6}>
              <SelectCustom
                options={personsToMergeWith}
                inputId="person-to-merge-with-select"
                classNamePrefix="person-to-merge-with-select"
                isClearable
                isSearchable
                onChange={setPersonToMergeAndDelete}
                value={personToMergeAndDelete}
                getOptionValue={(i) => i._id}
                getOptionLabel={(i) => i?.name || ""}
              />
            </Col>
            <Col md={2} />
          </Row>
        </ModalHeader>
        <ModalBody>
          {!!initMergedPerson && (
            <Formik
              initialValues={initMergedPerson}
              enableReinitialize
              onSubmit={async (body, { setSubmitting }) => {
                if (!window.confirm("Cette opération est irréversible, êtes-vous sûr ?")) return;
                if (!body.followedSince) body.followedSince = originPerson.createdAt;
                body.entityKey = originPerson.entityKey;

                const historyEntry = {
                  date: new Date(),
                  user: user._id,
                  data: {
                    merge: { _id: personToMergeAndDelete._id, name: personToMergeAndDelete.name },
                  },
                };
                for (const key in body) {
                  if (!allowedFieldsInHistory.includes(key)) continue;
                  if (isEmptyValue(body[key]) && isEmptyValue(originPerson[key])) continue;
                  if (JSON.stringify(body[key]) !== JSON.stringify(initMergedPerson[key])) {
                    historyEntry.data[key] = { oldValue: initMergedPerson[key], newValue: body[key] };
                  }
                }

                if (Object.keys(historyEntry.data)?.length) body.history = [...(initMergedPerson.history || []), historyEntry];

                const mergedPerson = preparePersonForEncryption(body);

                const mergedActions = actions
                  .filter((a) => a.person === personToMergeAndDelete._id)
                  .map((action) =>
                    prepareActionForEncryption({
                      ...action,
                      person: originPerson._id,
                      user: action.user || user._id,
                      teams: action.teams?.length ? action.teams : [currentTeam?._id],
                    })
                  );

                const mergedComments = comments
                  .filter((c) => c.person === personToMergeAndDelete._id)
                  .map((comment) =>
                    prepareCommentForEncryption({
                      ...comment,
                      person: originPerson._id,
                      user: comment.user || user._id,
                      team: comment.team || currentTeam?._id,
                    })
                  );

                const mergedRelsPersonPlace = relsPersonPlace
                  .filter((rel) => rel.person === personToMergeAndDelete._id)
                  .map((relPersonPlace) =>
                    prepareRelPersonPlaceForEncryption({
                      ...relPersonPlace,
                      place: relPersonPlace.place,
                      person: originPerson._id,
                      user: relPersonPlace.user,
                    })
                  );

                const mergedPassages = passages
                  .filter((p) => p.person === personToMergeAndDelete._id)
                  .map((passage) => preparePassageForEncryption({ ...passage, person: originPerson._id }));

                const mergedRencontres = rencontres
                  .filter((r) => r.person === personToMergeAndDelete._id)
                  .map((rencontre) => prepareRencontreForEncryption({ ...rencontre, person: originPerson._id }));

                const existingGroups = groups.filter((r) => r.persons?.includes(personToMergeAndDelete._id) || r.persons?.includes(originPerson._id));
                const groupToDeleteId =
                  existingGroups.length === 2
                    ? existingGroups.find(
                        (group) => group.persons?.includes(personToMergeAndDelete._id) && !group.persons?.includes(originPerson._id)
                      )?._id
                    : undefined;
                const mergedGroup = existingGroups?.length
                  ? prepareGroupForEncryption(
                      existingGroups.reduce(
                        (newGroup, group) => {
                          const newPersons = group.persons.filter((personId) => personId !== personToMergeAndDelete._id);
                          const newRelations = group.relations
                            .filter((relation) => {
                              // on retire la relation entre les deux personnes à fusionner
                              if (relation.persons?.includes(personToMergeAndDelete._id) && relation.persons?.includes(originPerson._id))
                                return false;
                              // on garde toutes les autres relations...
                              // quitte à ce que les doublons existent et qu'ils soient triés manuellement par les utilisateurs
                              return true;
                            })
                            .map((relation) => {
                              if (!relation.persons?.includes(personToMergeAndDelete._id)) return relation;
                              return {
                                ...relation,
                                persons: relation.persons.map((personId) => (personId === personToMergeAndDelete._id ? originPerson._id : personId)),
                              };
                            });
                          return {
                            ...newGroup,
                            ...group,
                            persons: [...new Set([...newGroup.persons, ...newPersons])],
                            relations: [...newGroup.relations, ...newRelations],
                          };
                        },
                        {
                          persons: [],
                          relations: [],
                        }
                      )
                    )
                  : undefined;

                const mergedConsultations = consultations
                  .filter((consultation) => consultation.person === personToMergeAndDelete._id)
                  .map((consultation) =>
                    prepareConsultationForEncryption(organisation.consultations)({
                      team: currentTeam?._id, // previous consultations were not linked to a team
                      ...consultation,
                      person: originPerson._id,
                    })
                  );

                const mergedTreatments = treatments
                  .filter((t) => t.person === personToMergeAndDelete._id)
                  .map((treatment) => prepareTreatmentForEncryption({ ...treatment, person: originPerson._id, user: treatment.user || user._id }));

                const { mergedMedicalFile, medicalFileToDeleteId } = (() => {
                  if (originPersonMedicalFile) {
                    return {
                      mergedMedicalFile: prepareMedicalFileForEncryption(customFieldsMedicalFile)({
                        ...body,
                        _id: originPersonMedicalFile._id,
                        organisation: organisation._id,
                        person: originPerson._id,
                        documents: [
                          ...(originPersonMedicalFile.documents || []),
                          ...((personToMergeMedicalFile || {}).documents || []).map((_doc) => ({
                            ..._doc,
                            downloadPath: _doc.downloadPath ?? `/person/${personToMergeAndDelete._id}/document/${_doc.file.filename}`,
                          })),
                        ],
                      }),
                      medicalFileToDeleteId: personToMergeMedicalFile?._id,
                    };
                  }
                  if (!originPersonMedicalFile && !!personToMergeMedicalFile) {
                    return {
                      mergedMedicalFile: prepareMedicalFileForEncryption(customFieldsMedicalFile)({
                        ...body,
                        _id: personToMergeMedicalFile._id,
                        organisation: organisation._id,
                        person: originPerson._id,
                        documents: (personToMergeMedicalFile.documents || []).map((_doc) => ({
                          ..._doc,
                          downloadPath: _doc.downloadPath ?? `/person/${personToMergeAndDelete._id}/document/${_doc.file.filename}`,
                        })),
                      }),
                    };
                  }
                  return {};
                })();

                const [error] = await tryFetchExpectOk(async () =>
                  API.post({
                    path: "/merge/persons",
                    body: {
                      mergedPerson: await encryptItem(mergedPerson),
                      mergedActions: await Promise.all(mergedActions.map(encryptItem)),
                      mergedComments: await Promise.all(mergedComments.map(encryptItem)),
                      mergedRelsPersonPlace: await Promise.all(mergedRelsPersonPlace.map(encryptItem)),
                      mergedPassages: await Promise.all(mergedPassages.map(encryptItem)),
                      mergedRencontres: await Promise.all(mergedRencontres.map(encryptItem)),
                      mergedConsultations: await Promise.all(mergedConsultations.map(encryptItem)),
                      mergedTreatments: await Promise.all(mergedTreatments.map(encryptItem)),
                      mergedMedicalFile: mergedMedicalFile ? await encryptItem(mergedMedicalFile) : undefined,
                      mergedGroup: mergedGroup ? await encryptItem(mergedGroup) : undefined,
                      groupToDeleteId,
                      personToDeleteId: personToMergeAndDelete._id,
                      medicalFileToDeleteId,
                    },
                  })
                );

                if (error) {
                  toast.error("Échec de la fusion");
                  setSubmitting(false);
                  return;
                }
                toast.success("Fusion réussie !");

                setPersons((persons) => persons.filter((p) => p._id !== personToMergeAndDelete._id));

                refresh();

                setOpen(false);
                setSubmitting(false);
              }}
            >
              {({ values, handleChange, handleSubmit, isSubmitting }) => (
                <>
                  <Table
                    data={[...fields, ...(user.healthcareProfessional ? medicalFields : [])]}
                    // use this key prop to reset table and reset sortablejs on each element added/removed
                    rowKey="name"
                    columns={[
                      {
                        dataKey: "field",
                        render: (field) => {
                          return <Field>{field.name === "user" ? "Créé(e) par" : field.label}</Field>;
                        },
                      },
                      {
                        title: originPerson?.name,
                        dataKey: "originPerson",
                        render: (field) => {
                          if (field.name === "user")
                            return (
                              <Col md={12}>
                                <UserName id={originPerson.user} />
                              </Col>
                            );
                          if (field.name === "assignedTeams") {
                            return <Col md={12}>{originPerson?.assignedTeams?.map((id) => teams.find((t) => t._id === id)?.name).join(", ")}</Col>;
                          }
                          return getRawValue(field, originPerson[field.name] || originPersonMedicalFile?.[field.name]);
                        },
                      },
                      {
                        title: personToMergeAndDelete?.name,
                        dataKey: "personToMergeAndDelete",
                        render: (field) => {
                          if (field.name === "user")
                            return (
                              <Col md={12}>
                                <UserName id={personToMergeAndDelete?.user} />
                              </Col>
                            );
                          if (field.name === "assignedTeams") {
                            return (
                              <Col md={12}>
                                {personToMergeAndDelete?.assignedTeams?.map((id) => teams.find((t) => t._id === id)?.name).join(", ")}
                              </Col>
                            );
                          }
                          return getRawValue(field, personToMergeAndDelete?.[field.name] || personToMergeMedicalFile?.[field.name]);
                        },
                      },
                      {
                        title: "Je garde :",
                        dataKey: "keeping",
                        render: (field) => {
                          if (field.name === "user")
                            return (
                              <Col md={12}>
                                <UserName
                                  id={values.user}
                                  canAddUser
                                  handleChange={async (newUser) => handleChange({ currentTarget: { name: "user", value: newUser } })}
                                />
                              </Col>
                            );
                          if (field.name === "assignedTeams")
                            return (
                              <Col md={12}>
                                <SelectTeamMultiple
                                  onChange={(teamIds) => handleChange({ target: { value: teamIds, name: "assignedTeams" } })}
                                  value={values.assignedTeams}
                                  colored
                                  inputId="person-select-assigned-team"
                                  classNamePrefix="person-select-assigned-team"
                                />
                              </Col>
                            );
                          return (
                            <CustomFieldInput model="person" values={values} handleChange={handleChange} field={field} hideLabel colWidth={12} />
                          );
                        },
                      },
                    ]}
                  />
                  <Row style={{ justifyContent: "center", gap: "1rem", marginTop: "1rem" }}>
                    <Button color="link" onClick={() => setOpen(false)}>
                      Annuler
                    </Button>
                    <Button disabled={isSubmitting} onClick={() => !isSubmitting && handleSubmit()}>
                      {isSubmitting ? "Fusion en cours" : "Fusionner"}
                    </Button>
                  </Row>
                </>
              )}
            </Formik>
          )}
        </ModalBody>
      </StyledModal>
    </>
  );
};

const StyledModal = styled(Modal)`
  align-items: center;
  .modal-title {
    width: 100%;
    flex-grow: 1;
    padding: auto;
    font-size: 16px;
  }

  .form-group {
    margin-bottom: 0;
  }
`;

const Field = styled.p`
  font-weight: bold;
  margin-bottom: 0;
`;

export default MergeTwoPersons;
