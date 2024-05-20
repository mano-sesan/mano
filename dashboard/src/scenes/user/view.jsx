import React, { useCallback, useEffect, useState } from "react";
import { FormGroup, Input, Label, Row, Col } from "reactstrap";

import { useParams, useHistory } from "react-router-dom";
import { Formik } from "formik";
import { toast } from "react-toastify";
import { useRecoilState, useRecoilValue } from "recoil";

import { SmallHeaderWithBackButton } from "../../components/header";
import Loading from "../../components/loading";
import ButtonCustom from "../../components/ButtonCustom";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";
import SelectRole from "../../components/SelectRole";
import { organisationState, userState } from "../../recoil/auth";
import useTitle from "../../services/useTitle";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";
import { emailRegex } from "../../utils";
import { capture } from "../../services/sentry";
import api from "../../services/apiv2";

const View = () => {
  const [localUser, setLocalUser] = useState(null);
  const { id } = useParams();
  const history = useHistory();
  const [user, setUser] = useRecoilState(userState);
  const organisation = useRecoilValue(organisationState);

  useTitle(`Utilisateur ${user?.name}`);

  const getUserData = useCallback(async () => {
    const { data } = await api.get(`/user/${id}`);
    setLocalUser(data);
  }, [id]);

  useEffect(() => {
    getUserData();
  }, [getUserData, id]);

  if (!localUser) return <Loading />;

  return (
    <>
      <SmallHeaderWithBackButton />
      <button
        type="button"
        className="tw-absolute tw-bottom-0 tw-right-0 tw-m-4 tw-rounded tw-bg-white tw-p-2 tw-text-sm tw-text-white tw-opacity-0"
        onClick={() => {
          capture(new Error("Test Capture Error Sentry Manually"));
          throw new Error("Test Throw Error Sentry Manually");
        }}
      >
        Test Sentry
      </button>
      <Formik
        initialValues={{
          name: localUser.name,
          email: localUser.email,
          phone: localUser.phone,
          team: localUser.team,
          role: localUser.role,
          healthcareProfessional: localUser.healthcareProfessional,
        }}
        enableReinitialize
        onSubmit={async (body, actions) => {
          try {
            if (!body.team?.length) return toast.error("Au moins une équipe est obligatoire");
            if (body.email && !emailRegex.test(body.email)) return toast.error("Email invalide");
            if (!body.name) return toast.error("Le nom doit faire au moins un caractère");
            body.organisation = organisation._id;
            const res = await api.put(`/user/${id}`, body);
            if (!res.ok) return actions.setSubmitting(false);
            if (user._id === id) {
              const { data } = await api.get(`/user/${id}`);
              setUser(data);
            }
            actions.setSubmitting(false);
            toast.success("Mis à jour !");
          } catch (errorUpdatingUser) {
            console.log("error in updating user", errorUpdatingUser);
            toast.error(errorUpdatingUser.message);
          }
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting }) => (
          <React.Fragment>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label htmlFor="name">Nom</Label>
                  <Input name="name" id="name" value={values.name} onChange={handleChange} />
                </FormGroup>
              </Col>

              <Col md={6}>
                <FormGroup>
                  <Label htmlFor="email">Email</Label>
                  <Input name="email" id="email" value={values.email} onChange={handleChange} />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input name="phone" id="phone" value={values.phone} onChange={handleChange} />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label htmlFor="team">Équipes</Label>
                  <div>
                    <SelectTeamMultiple
                      onChange={(teamIds) => handleChange({ target: { value: teamIds, name: "team" } })}
                      organisation={organisation._id}
                      value={values.team || []}
                      colored
                      required
                      inputId="team"
                    />
                  </div>
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label htmlFor="role">Role</Label>
                  <SelectRole handleChange={handleChange} value={values.role} />
                </FormGroup>
              </Col>
              {values.role !== "restricted-access" && (
                <Col md={12}>
                  <Label htmlFor="healthcareProfessional" style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      id="healthcareProfessional"
                      style={{ marginRight: "0.5rem" }}
                      name="healthcareProfessional"
                      checked={values.healthcareProfessional}
                      onChange={() => {
                        handleChange({ target: { value: !values.healthcareProfessional, name: "healthcareProfessional" } });
                      }}
                    />
                    Professionnel·le de santé
                  </Label>
                  <div>
                    <small className="text-muted">Un·e professionnel·le de santé a accès au dossier médical complet des personnes.</small>
                  </div>
                </Col>
              )}
            </Row>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
              {id !== user._id && (
                <DeleteButtonAndConfirmModal
                  title={`Voulez-vous vraiment supprimer l'utilisateur ${values.name}`}
                  textToConfirm={values.name}
                  onConfirm={async () => {
                    const res = await api.delete(`/user/${id}`);
                    if (!res.ok) return;
                    toast.success("Suppression réussie");
                    history.goBack();
                  }}
                >
                  <span style={{ marginBottom: 30, display: "block", width: "100%", textAlign: "center" }}>Cette opération est irréversible</span>
                </DeleteButtonAndConfirmModal>
              )}
              <ButtonCustom title={"Mettre à jour"} loading={isSubmitting} onClick={handleSubmit} />
            </div>
          </React.Fragment>
        )}
      </Formik>
    </>
  );
};

export default View;
