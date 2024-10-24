import React, { useState } from "react";
import { Col, FormGroup, Row, Modal, ModalBody, ModalHeader, Input, Label } from "reactstrap";
import { useHistory } from "react-router-dom";
import { Formik } from "formik";
import { toast } from "react-toastify";
import personIcon from "../../assets/icons/person-icon.svg";

import ButtonCustom from "../../components/ButtonCustom";
import { currentTeamState, userState } from "../../recoil/auth";
import { personsState, usePreparePersonForEncryption } from "../../recoil/persons";
import { useRecoilState, useRecoilValue } from "recoil";
import API, { tryFetchExpectOk } from "../../services/api";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";
import dayjs from "dayjs";
import { useDataLoader } from "../../services/dataLoader";

const CreatePerson = () => {
  const { refresh } = useDataLoader();
  const [open, setOpen] = useState(false);
  const currentTeam = useRecoilValue(currentTeamState);
  const user = useRecoilValue(userState);
  const history = useHistory();
  const [persons] = useRecoilState(personsState);
  const { encryptPerson } = usePreparePersonForEncryption();

  return (
    <>
      <ButtonCustom
        icon={personIcon}
        disabled={!currentTeam}
        onClick={() => setOpen(true)}
        color="primary"
        type="button"
        title="Créer une personne"
        padding="12px 24px"
      />
      <Modal isOpen={open} toggle={() => setOpen(false)} size="lg" backdrop="static">
        <ModalHeader toggle={() => setOpen(false)}>Créer une nouvelle personne</ModalHeader>
        <ModalBody>
          <Formik
            initialValues={{ name: "", assignedTeams: [currentTeam?._id] }}
            onSubmit={async (body, actions) => {
              if (!body.name?.trim()?.length) return toast.error("Une personne doit avoir un nom");
              if (!body.assignedTeams?.length) return toast.error("Une personne doit être suivie par au moins une équipe");
              const existingPerson = persons.find((p) => p.name === body.name);
              if (existingPerson) return toast.error("Une personne existe déjà à ce nom");
              body.followedSince = dayjs();
              body.user = user._id;
              const [error, response] = await tryFetchExpectOk(async () =>
                API.post({
                  path: "/person",
                  body: await encryptPerson(body),
                })
              );
              if (!error) {
                await refresh();
                toast.success("Création réussie !");
                setOpen(false);
                actions.setSubmitting(false);
                history.push(`/person/${response.data._id}`);
              }
            }}
          >
            {({ values, handleChange, handleSubmit, isSubmitting }) => (
              <React.Fragment>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label htmlFor="name">Nom</Label>
                      <Input autoComplete="off" name="name" id="name" value={values.name} onChange={handleChange} />
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label htmlFor="person-select-assigned-team">Équipe(s) en charge</Label>
                      <SelectTeamMultiple
                        onChange={(teamIds) => handleChange({ target: { value: teamIds, name: "assignedTeams" } })}
                        value={values.assignedTeams}
                        colored
                        inputId="person-select-assigned-team"
                        classNamePrefix="person-select-assigned-team"
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <br />
                <div className="tw-mt-4 tw-flex tw-justify-end">
                  <ButtonCustom
                    type="submit"
                    onClick={() => !isSubmitting && handleSubmit()}
                    disabled={!!isSubmitting || !values.name?.trim()?.length}
                    title={isSubmitting ? "Sauvegarde..." : "Sauvegarder"}
                  />
                </div>
              </React.Fragment>
            )}
          </Formik>
        </ModalBody>
      </Modal>
    </>
  );
};

export default CreatePerson;
