import React, { useEffect, useState } from "react";
import { Modal, Col, Row, ModalHeader, ModalBody, FormGroup, Label } from "reactstrap";
import { toast } from "react-toastify";
import { Formik } from "formik";
import ButtonCustom from "./ButtonCustom";
import SelectUser from "./SelectUser";
import { currentTeamState, teamsState, userState } from "../recoil/auth";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { rencontresState, prepareRencontreForEncryption, encryptRencontre } from "../recoil/rencontres";
import SelectTeam from "./SelectTeam";
import SelectPerson from "./SelectPerson";
import DatePicker from "./DatePicker";
import { outOfBoundariesDate } from "../services/date";
import AutoResizeTextarea from "./AutoresizeTextArea";
import api from "../services/apiv2";
import { useDataLoader } from "./DataLoader";

const Rencontre = ({ rencontre, personId, onFinished, onSave, disableAccessToPerson = false }) => {
  const user = useRecoilValue(userState);
  const teams = useRecoilValue(teamsState);
  const [open, setOpen] = useState(false);
  const currentTeam = useRecoilValue(currentTeamState);
  const { refresh } = useDataLoader();

  const setRencontres = useSetRecoilState(rencontresState);

  useEffect(() => {
    setOpen(!!rencontre);
  }, [rencontre]);

  const onCancelRequest = () => {
    setOpen(false);
    onFinished();
  };

  const onDeleteRencontre = async () => {
    const confirm = window.confirm("Êtes-vous sûr ?");
    if (confirm) {
      const rencontreRes = await api.delete(`/rencontre/${rencontre._id}`);
      if (rencontreRes.ok) {
        toast.success("Suppression réussie");
        setOpen(false);
        setRencontres((rencontres) => rencontres.filter((p) => p._id !== rencontre._id));
      }
    }
  };

  const isNew = !rencontre?._id;
  const isForPerson = !!rencontre?.person;
  const showMultiSelect = isNew && !isForPerson;

  return (
    <>
      <Modal zIndex={5000} isOpen={!!open && !!rencontre} toggle={onCancelRequest} size="lg" backdrop="static">
        <ModalHeader toggle={onCancelRequest}>{isNew ? "Enregistrer une rencontre" : "Éditer la rencontre"}</ModalHeader>
        <ModalBody>
          <Formik
            initialValues={{
              date: new Date(),
              ...rencontre,
              anonymousNumberOfRencontres: 1,
              persons: rencontre?.person ? [rencontre.person] : rencontre?.persons ? rencontre?.persons : [],
            }}
            onSubmit={async (body, actions) => {
              if (!body.user) return toast.error("L'utilisateur est obligatoire");
              if (!body.date) return toast.error("La date est obligatoire");
              if (outOfBoundariesDate(body.date)) return toast.error("La date est hors limites (entre 1900 et 2100)");
              if (!body.team) return toast.error("L'équipe est obligatoire");
              if (!body.anonymous && (showMultiSelect ? !body.persons?.length : !body.person?.length))
                return toast.error("Veuillez spécifier une personne");

              if (isNew) {
                const newRencontre = {
                  date: body.date,
                  team: body.team ?? currentTeam._id,
                  user: user._id,
                  person: personId,
                  comment: body.comment,
                };

                if (onSave) {
                  // Sometimes we don't want to actually save the rencontre, but just to get the data.
                  // Par exemple quand on veut ajouter une rencontre à une observation pas encore créee.
                  onSave(showMultiSelect ? body.persons.map((person) => ({ ...newRencontre, person })) : [newRencontre]);
                } else {
                  if (showMultiSelect) {
                    for (const person of body.persons) {
                      const response = await api.post("/rencontre", await encryptRencontre({ ...newRencontre, person }));
                      if (response.ok) {
                        await refresh();
                      }
                    }
                  } else {
                    const response = await api.post("/rencontre", await encryptRencontre({ ...newRencontre, person: body.person }));
                    if (response.ok) {
                      await refresh();
                    }
                  }
                }

                setOpen(false);
                onFinished();
                toast.success(body.person.length > 1 ? "Rencontre enregistrée" : "Rencontres enregistrées");
                actions.setSubmitting(false);
                return;
              }
              const response = await api.put(`/rencontre/${rencontre._id}`, await encryptRencontre(body));
              if (!response.ok) return;
              await refresh();
              setOpen(false);
              onFinished();
              toast.success("Rencontre mise à jour");
              actions.setSubmitting(false);
            }}
          >
            {({ values, handleChange, handleSubmit, isSubmitting }) => {
              return (
                <React.Fragment>
                  <Row>
                    <Col md={6}>
                      <FormGroup>
                        <Label htmlFor="date">Date</Label>
                        <div>
                          <DatePicker withTime id="date" defaultValue={values.date} onChange={handleChange} />
                        </div>
                      </FormGroup>
                    </Col>
                    <Col md={6}>
                      <FormGroup>
                        {showMultiSelect ? (
                          <SelectPerson
                            disableAccessToPerson={disableAccessToPerson}
                            value={values.persons}
                            onChange={handleChange}
                            isClearable
                            isMulti
                            name="persons"
                          />
                        ) : (
                          <SelectPerson disableAccessToPerson={disableAccessToPerson} value={values.person} onChange={handleChange} />
                        )}
                      </FormGroup>
                    </Col>
                    <Col md={12}>
                      <FormGroup>
                        <Label htmlFor="update-rencontre-comment">Commentaire</Label>
                        <div className="tw-rounded tw-border tw-border-gray-300">
                          <AutoResizeTextarea
                            id="update-rencontre-comment"
                            name="comment"
                            placeholder="Tapez votre commentaire ici..."
                            value={values.comment}
                            rows={7}
                            onChange={handleChange}
                          />
                        </div>
                      </FormGroup>
                    </Col>
                    <Col md={6}>
                      <FormGroup>
                        <Label htmlFor="update-rencontre-user-select">Créée par</Label>
                        <SelectUser
                          inputId="update-rencontre-user-select"
                          value={values.user || user._id}
                          onChange={(userId) => handleChange({ target: { value: userId, name: "user" } })}
                        />
                      </FormGroup>
                    </Col>
                    <Col md={6}>
                      <FormGroup>
                        <Label htmlFor="update-rencontre-team-select">Sous l'équipe</Label>
                        <SelectTeam
                          teams={user.role === "admin" ? teams : user.teams}
                          teamId={values.team}
                          onChange={(team) => handleChange({ target: { value: team._id, name: "team" } })}
                          inputId="update-rencontre-team-select"
                        />
                      </FormGroup>
                    </Col>
                  </Row>
                  <br />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                    {!isNew && <ButtonCustom title="Supprimer" type="button" color="danger" onClick={onDeleteRencontre} />}
                    <ButtonCustom title="Enregistrer" loading={isSubmitting} onClick={() => !isSubmitting && handleSubmit()} />
                  </div>
                </React.Fragment>
              );
            }}
          </Formik>
        </ModalBody>
      </Modal>
    </>
  );
};

export default Rencontre;
