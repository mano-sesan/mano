import React, { useCallback, useEffect, useState } from "react";

import { useParams, useHistory } from "react-router-dom";
import { Formik } from "formik";
import { toast } from "react-toastify";
import { useAtom, useAtomValue, useSetAtom } from "jotai";

import Loading from "../../components/loading";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";
import SelectRole from "../../components/SelectRole";
import { deletedUsersState, organisationState, usersState, userState } from "../../atoms/auth";
import API, { tryFetch, tryFetchExpectOk } from "../../services/api";
import useTitle from "../../services/useTitle";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";
import { emailRegex, errorMessage } from "../../utils";
import BackButton from "../../components/backButton";

const View = () => {
  const [localUser, setLocalUser] = useState(null);
  const { id } = useParams();
  const history = useHistory();
  const [user, setUser] = useAtom(userState);
  const setUsers = useSetAtom(usersState);
  const setDeletedUsers = useSetAtom(deletedUsersState);
  const organisation = useAtomValue(organisationState);
  const [isReactivatingUser, setIsReactivatingUser] = useState(false);

  useTitle(`Utilisateur ${user?.name}`);

  const getUserData = useCallback(async () => {
    const [error, response] = await tryFetch(() => API.get({ path: `/user/${id}` }));
    if (error) {
      toast.error(errorMessage(error));
      history.push("/user");
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
            if (!body.email) return toast.error("L'email est obligatoire");
            if (body.email && !emailRegex.test(body.email)) return toast.error("Email invalide");
            if (!body.name) return toast.error("Le nom doit faire au moins un caractère");
            if (user._id === id && body.role !== "admin") {
              return toast.error("Vous ne pouvez pas modifier votre rôle : déconnectez-vous et demandez à un autre administrateur de le faire");
            }
            body.organisation = organisation._id;
            const [error, response] = await tryFetch(() => API.put({ path: `/user/${id}`, body }));
            if (error) {
              actions.setSubmitting(false);
              return toast.error(errorMessage(error));
            }
            if (user._id === id) {
              const [error, meResponse] = await tryFetchExpectOk(() => API.get({ path: `/user/${id}` }));
              if (error) {
                actions.setSubmitting(false);
                return toast.error(errorMessage(error));
              }
              setUser(meResponse.data);
            }
            setLocalUser(response.user);
            actions.setSubmitting(false);
            toast.success("Mis à jour !");
          } catch (errorUpdatingUser) {
            toast.error(errorUpdatingUser.message);
          }
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting }) => (
          <React.Fragment>
            <div className="-tw-mx-4 tw-flex tw-flex-row tw-flex-wrap">
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <div className="tw-mb-4">
                  <label htmlFor="name">Nom</label>
                  <input className="tailwindui" autoComplete="off" name="name" id="name" value={values.name} onChange={handleChange} />
                </div>
              </div>

              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <div className="tw-mb-4">
                  <label htmlFor="email">Email</label>
                  <input className="tailwindui" autoComplete="off" name="email" id="email" value={values.email} onChange={handleChange} required />
                </div>
              </div>
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <div className="tw-mb-4">
                  <label htmlFor="phone">Téléphone</label>
                  <input className="tailwindui" autoComplete="off" name="phone" id="phone" value={values.phone} onChange={handleChange} />
                </div>
              </div>
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <div className="tw-mb-4">
                  <label htmlFor="team">Équipes</label>
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
                </div>
              </div>
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <div className="tw-mb-4">
                  <label htmlFor="role">Role</label>
                  <SelectRole handleChange={handleChange} value={values.role} />
                </div>
              </div>
              {values.role !== "restricted-access" && values.role !== "stats-only" && (
                <div className="tw-flex tw-basis-full tw-flex-col tw-px-4 tw-py-2">
                  <label htmlFor="healthcareProfessional" style={{ marginBottom: 0 }}>
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
                  </label>
                  <div>
                    <small className="text-muted">Un·e professionnel·le de santé a accès au dossier médical complet des personnes.</small>
                  </div>
                </div>
              )}
            </div>
            <div className="tw-flex tw-justify-end tw-gap-4">
              {localUser.disabledAt && (
                <button
                  type="button"
                  className="button-classic"
                  disabled={isReactivatingUser}
                  onClick={async () => {
                    setIsReactivatingUser(localUser._id);
                    const [error, response] = await tryFetchExpectOk(async () =>
                      API.post({ path: `/user/reactivate-user`, body: { _id: localUser._id } })
                    );
                    setIsReactivatingUser(false);
                    if (error) {
                      return toast.error("Erreur lors de la réactivation de l'utilisateur");
                    }
                    toast.success("Utilisateur réactivé");
                    // Refresh user data
                    setLocalUser(response.user);
                    setUsers((users) => users.map((u) => (u._id === localUser._id ? response.user : u)));
                  }}
                >
                  Réactiver 🔓
                </button>
              )}
              {(localUser.decryptAttempts > 12 || localUser.loginAttempts > 12) && (
                <button
                  type="button"
                  className="button-classic"
                  disabled={isReactivatingUser}
                  onClick={async () => {
                    setIsReactivatingUser(localUser._id);
                    const [error, response] = await tryFetchExpectOk(async () =>
                      API.post({ path: `/user/release-user`, body: { _id: localUser._id } })
                    );
                    setIsReactivatingUser(false);
                    if (error) {
                      return toast.error("Erreur lors de la déblocage de l'utilisateur");
                    }
                    toast.success("Utilisateur réactivé");
                    setLocalUser(response.user);
                    setUsers((users) => users.map((u) => (u._id === localUser._id ? response.user : u)));
                  }}
                >
                  Débloquer 🔓
                </button>
              )}
              {id !== user._id && (
                <DeleteButtonAndConfirmModal
                  title={`Voulez-vous vraiment supprimer l'utilisateur ${values.name}`}
                  textToConfirm={values.email}
                  onConfirm={async () => {
                    const [error] = await tryFetchExpectOk(() => API.delete({ path: `/user/${id}` }));
                    if (error) {
                      return toast.error(errorMessage(error));
                    }
                    const response = await API.get({ path: "/user/deleted-users" });
                    if (response.ok && response.data?.length) {
                      setDeletedUsers(response.data);
                    }
                    setUsers((users) => users.filter((u) => u._id !== id));
                    toast.success("Suppression réussie");
                    history.goBack();
                  }}
                >
                  <span className="tw-mb-7 tw-block tw-w-full tw-text-center">Cette opération est irréversible</span>
                </DeleteButtonAndConfirmModal>
              )}
              <button type="submit" onClick={handleSubmit} className="button-submit" disabled={isSubmitting}>
                Mettre à jour
              </button>
            </div>
          </React.Fragment>
        )}
      </Formik>
    </>
  );
};

export default View;
