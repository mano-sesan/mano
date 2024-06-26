import React, { useState } from "react";
import { Formik } from "formik";
import { toast } from "react-toastify";
import { useRecoilState } from "recoil";
import Loading from "../components/loading";
import ChangePassword from "../components/ChangePassword";
import { userState } from "../recoil/auth";
import API, { tryFetch, tryFetchExpectOk } from "../services/api";
import { ModalBody, ModalContainer, ModalHeader } from "../components/tailwind/Modal";
import DeleteButtonAndConfirmModal from "../components/DeleteButtonAndConfirmModal";
import { errorMessage } from "../utils";

const Account = () => {
  const [user, setUser] = useRecoilState(userState);

  if (!user) return <Loading />;

  return (
    <>
      <h1 className="tw-text-xl tw-my-8 tw-font-normal">{user.name}</h1>
      <Formik
        initialValues={user}
        onSubmit={async (body) => {
          const [error] = await tryFetch(async () => API.put({ path: "/user", body }));
          if (!error) {
            toast.success("Mis à jour !");
            const [error, response] = await tryFetchExpectOk(async () => API.get({ path: "/user/me" }));
            if (error) {
              toast.error(errorMessage(error));
              return;
            }
            setUser(response.user);
          } else {
            toast.error(errorMessage(error));
          }
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting }) => (
          <React.Fragment>
            <div className="tw-flex tw-flex-row tw-flex-wrap">
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <div className="tw-mb-4">
                  <label htmlFor="orgName">Nom</label>
                  <input
                    className="tailwindui"
                    autoComplete="off"
                    type="text"
                    name="name"
                    id="name"
                    value={values.name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <div className="tw-mb-4">
                  <label htmlFor="email">Email</label>
                  <input
                    className="tailwindui"
                    autoComplete="off"
                    type="email"
                    name="email"
                    id="email"
                    value={values.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>
            <hr />
            <div className="tw-flex tw-justify-end tw-gap-4">
              <LinkToChangePassword />
              <DeleteButtonAndConfirmModal
                title={`Voulez-vous vraiment supprimer l'utilisateur ${values.name}`}
                textToConfirm={values.email}
                roles={["admin", "superadmin", "normal", "restricted-access", "stats-only"]}
                onConfirm={async () => {
                  const [error] = await tryFetch(async () => API.delete({ path: "/user/me" }));
                  if (error) return;
                  toast.success("Suppression réussie");
                  window.location.reload();
                }}
              >
                <span className="tw-mb-7 tw-block tw-w-full tw-text-center">Cette opération est irréversible</span>
              </DeleteButtonAndConfirmModal>
              <button type="button" className="button-submit" disabled={isSubmitting} onClick={() => handleSubmit()}>
                Mettre à jour
              </button>
            </div>
          </React.Fragment>
        )}
      </Formik>
    </>
  );
};

const LinkToChangePassword = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="button-classic !tw-bg-black !tw-text-white" onClick={() => setOpen(true)}>
        Modifier son mot de passe
      </button>

      <ModalContainer open={open} onClose={() => setOpen(false)} className="change-password" size="3xl">
        <ModalHeader title="Modifier son mot de passe" onClose={() => setOpen(false)} />
        <ModalBody className="tw-px-4 tw-py-2">
          <ChangePassword
            onSubmit={async (body: any) => {
              const [error, response] = await tryFetch(async () => API.post({ path: `/user/reset_password`, body }));
              if (error) {
                toast.error(errorMessage(error));
              }
              return response;
            }}
            onFinished={() => setOpen(false)}
            withCurrentPassword
          />
        </ModalBody>
      </ModalContainer>
    </>
  );
};

export default Account;
