import React, { useCallback, useEffect, useState } from "react";
import { FormGroup, Input, Label, Row, Col } from "reactstrap";

import { useParams, useHistory } from "react-router-dom";
import { Formik } from "formik";
import { toast } from "react-toastify";
import { useRecoilState, useRecoilValue } from "recoil";

import Loading from "../../components/loading";
import ButtonCustom from "../../components/ButtonCustom";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";
import SelectRole from "../../components/SelectRole";
import { organisationState, userState } from "../../recoil/auth";
import API, { tryFetch, tryFetchExpectOk } from "../../services/api";
import useTitle from "../../services/useTitle";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";
import { emailRegex, errorMessage } from "../../utils";
import { capture } from "../../services/sentry";
import BackButton from "../../components/backButton";

const View = () => {
  const [localUser, setLocalUser] = useState(null);
  const { id } = useParams();
  const history = useHistory();
  const [user, setUser] = useRecoilState(userState);
  const organisation = useRecoilValue(organisationState);

  useTitle(`Utilisateur ${user?.name}`);

  const getUserData = useCallback(async () => {
    const [error, response] = await tryFetch(() => API.get({ path: `/user/${id}` }));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    setLocalUser(response.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    getUserData();
  }, [getUserData, id]);

  if (!localUser) return <Loading />;

  return (
    <>
      <div className="tw-my-8">
        <BackButton />
      </div>
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
            const [error] = await tryFetch(() => API.put({ path: `/user/${id}`, body }));
            if (error) {
              actions.setSubmitting(false);
              return toast.error(errorMessage(error));
            }
            if (user._id === id) {
              const [error, response] = await tryFetchExpectOk(() => API.get({ path: `/user/${id}` }));
              if (error) {
                actions.setSubmitting(false);
                return toast.error(errorMessage(error));
              }
              setUser(response.data);
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
            <div className="tw-flex tw-justify-end tw-gap-4">
              {id !== user._id && (
                <DeleteButtonAndConfirmModal
                  title={`Voulez-vous vraiment supprimer l'utilisateur ${values.name}`}
                  textToConfirm={values.email}
                  onConfirm={async () => {
                    const [error] = await tryFetchExpectOk(() => API.delete({ path: `/user/${id}` }));
                    if (error) {
                      return toast.error(errorMessage(error));
                    }
                    toast.success("Suppression réussie");
                    history.goBack();
                  }}
                >
                  <span className="tw-mb-7 tw-block tw-w-full tw-text-center">Cette opération est irréversible</span>
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
