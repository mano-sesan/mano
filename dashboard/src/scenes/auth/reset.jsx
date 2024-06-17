import { useState } from "react";
import { Link, Redirect, useLocation } from "react-router-dom";
import ChangePassword from "../../components/ChangePassword";
import API, { tryFetch, tryFetchExpectOk } from "../../services/api";
import { toast } from "react-toastify";
import { errorMessage } from "../../utils";

const Reset = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get("token");
  const newUser = searchParams.get("newUser") === "true";
  const [name, setName] = useState("");
  const [hasError, setHasError] = useState(false);

  if (!token) return <Redirect to="/" />;

  return (
    <div className="tw-mx-10 tw-my-20 tw-w-full tw-max-w-lg tw-overflow-y-auto tw-overflow-x-hidden tw-rounded-lg tw-bg-white tw-px-7 tw-pb-2 tw-pt-10 tw-text-black tw-shadow-[0_0_20px_0_rgba(0,0,0,0.2)]">
      <h1 className="tw-mb-6 tw-text-center tw-text-3xl tw-font-bold">
        {newUser ? "Renseignez votre prénom et nom, et choisissez un mot de passe" : "Modifiez votre mot de passe"}
      </h1>
      {newUser ? (
        <div className="tw-mb-4 tw-flex tw-flex-col tw-py-2">
          <label htmlFor="email">Prénom et nom</label>
          <input className="tailwindui" name="name" id="name" type="search" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      ) : null}
      <ChangePassword
        onSubmit={async ({ newPassword }) => {
          if (newUser && !name) {
            toast.error("Veuillez renseigner votre prénom et nom");
            return false;
          }
          const [error, res] = await tryFetch(async () =>
            API.post({
              path: "/user/forgot_password_reset",
              body: {
                token,
                name,
                password: newPassword,
              },
            })
          );
          if (error) {
            toast.error(errorMessage(error));
            setHasError(true);
            return false;
          }
          return res;
        }}
        onFinished={(res) => {
          if (res) {
            // Dans le doute on déconnecte l'utilisateur
            tryFetchExpectOk(() => API.post({ path: "/user/logout" })).then(([error]) => {
              if (error) return toast.error(errorMessage(error));
              window.location.href = "/auth";
            });
          }
        }}
        withCurrentPassword={false}
        centerButton
      />
      {hasError && (
        <Link to="/auth/forgot?new-link-request=true" className="tw-mx-auto tw-mb-0 tw-mt-5 tw-block tw-text-center tw-text-sm">
          Demander un nouveau lien de connection
        </Link>
      )}
    </div>
  );
};

export default Reset;
