import { useState, useEffect } from "react";
import validator from "validator";
import { Link, useHistory, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { detect } from "detect-browser";
import ButtonCustom from "../../components/ButtonCustom";
import { DEFAULT_ORGANISATION_KEY } from "../../config";
import PasswordInput from "../../components/PasswordInput";
import {
  currentTeamState,
  deletedUsersState,
  encryptionKeyLengthState,
  organisationState,
  sessionInitialDateTimestamp,
  teamsState,
  usersState,
  userState,
} from "../../recoil/auth";
import API, { tryFetch, tryFetchExpectOk } from "../../services/api";
import useMinimumWidth from "../../services/useMinimumWidth";
import { deploymentShortCommitSHAState } from "../../recoil/version";
import { checkEncryptedVerificationKey, resetOrgEncryptionKey, setOrgEncryptionKey } from "../../services/encryption";
import { errorMessage } from "../../utils";
import KeyInput from "../../components/KeyInput";
import { modalConfirmState } from "../../components/ModalConfirm";
import { useDataLoader } from "../../services/dataLoader";

const SignIn = () => {
  const [organisation, setOrganisation] = useRecoilState(organisationState);
  const setSessionInitialTimestamp = useSetRecoilState(sessionInitialDateTimestamp);
  const setCurrentTeam = useSetRecoilState(currentTeamState);
  const setTeams = useSetRecoilState(teamsState);
  const setUsers = useSetRecoilState(usersState);
  const setDeletedUsers = useSetRecoilState(deletedUsersState);
  const setModalConfirmState = useSetRecoilState(modalConfirmState);
  const [user, setUser] = useRecoilState(userState);
  const history = useHistory();
  const location = useLocation();
  const [showErrors, setShowErrors] = useState(false);
  const [userName, setUserName] = useState(false);
  const [showSelectTeam, setShowSelectTeam] = useState(false);
  const [showEncryption, setShowEncryption] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authViaCookie, setAuthViaCookie] = useState(false);
  const { startInitialLoad, cleanupLoader } = useDataLoader();

  const isDisconnected = new URLSearchParams(location.search).get("disconnected");

  const deploymentCommit = useRecoilValue(deploymentShortCommitSHAState);
  const setEncryptionKeyLength = useSetRecoilState(encryptionKeyLengthState);

  const [signinForm, setSigninForm] = useState({ email: "", password: "", orgEncryptionKey: DEFAULT_ORGANISATION_KEY || "" });
  const [signinFormErrors, setSigninFormErrors] = useState({ email: "", password: "", orgEncryptionKey: "", otp: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDesktop = useMinimumWidth("sm");

  const browser = detect();
  const isAndroid = browser?.os?.toLowerCase().includes("android");

  useEffect(() => {
    if (isDisconnected) {
      toast.error("Votre session a expiré, veuillez vous reconnecter");
      history.replace("/auth");
    }
  }, [isDisconnected, history]);

  const onSigninValidated = () =>
    startInitialLoad()
      // On redirige seulement après le chargement pour ne pas se retrouver dans un cas
      // où l'élément qu'on veut voir n'est pas encore chargé.
      .then(() => {
        if (["stats-only"].includes(user.role)) return history.push("/stats");
        // S'il y a une redirection prévues dans le sessionStorage, on la fait
        const redirect = window.sessionStorage.getItem("redirectPath");
        if (redirect && redirect !== "/") {
          window.sessionStorage.removeItem("redirectPath");
          history.push(redirect);
        } else {
          if (isDesktop && !!organisation?.receptionEnabled) {
            history.push("/reception");
          } else {
            history.push("/action");
          }
        }
        // Pour éviter le problème de timing, on attend le prochain cycle.
        return Promise.resolve();
      })
      // On fait le nettoyage du loader après la redirection pour éviter un flash de chargement
      .then(() => cleanupLoader());

  const onLogout = async () => {
    setShowErrors(false);
    setUserName("");
    setShowSelectTeam(false);
    setShowEncryption(false);
    setShowPassword(false);
    setAuthViaCookie(false);
    tryFetchExpectOk(() => API.post({ path: "/user/logout" })).then(() => {
      window.localStorage.removeItem("previously-logged-in");
      window.location.href = "/auth";
    });
  };

  useEffect(() => {
    (async () => {
      if (!window.localStorage.getItem("previously-logged-in")) return setLoading(false);
      const [error, response] = await tryFetch(() => API.getSigninToken());
      if (error) {
        // Pas besoin d'afficher un message d'erreur si on était en train de quitter la page pendant le chargement.
        if (error?.name === "BeforeUnloadAbortError") return setLoading(false);
        toast.error(errorMessage(error));
        return setLoading(false);
      }
      const { token, user, ok } = response;
      if (ok && token && user) {
        setAuthViaCookie(true);
        const { organisation } = user;
        setOrganisation(organisation);
        setUserName(user.name);
        setUser(user);
        if (!!organisation.encryptionEnabled && !["superadmin"].includes(user.role)) setShowEncryption(true);
      }
      return setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailError = !authViaCookie && !validator.isEmail(signinForm.email) ? "Adresse email invalide" : "";
    const passwordError = !authViaCookie && validator.isEmpty(signinForm.password) ? "Ce champ est obligatoire" : "";
    const orgEncryptionKeyError = !!showEncryption && validator.isEmpty(signinForm.orgEncryptionKey) ? "Ce champ est obligatoire" : "";
    const otpKeyError = !!showOtp && validator.isEmpty(signinForm.otp) ? "Ce champ est obligatoire" : "";
    if (emailError || passwordError || orgEncryptionKeyError || otpKeyError) {
      setShowErrors(true);
      setSigninFormErrors({ email: emailError, password: passwordError, orgEncryptionKey: orgEncryptionKeyError, otp: otpKeyError });
      return;
    }
    setShowErrors(false);
    setIsSubmitting(true);
    const body = {
      email: signinForm.email,
      password: signinForm.password,
      otp: signinForm.otp?.trim()?.toUpperCase(),
    };
    const browser = detect();
    if (browser) {
      body.browsertype = browser.type;
      body.browsername = browser.name;
      body.browserversion = browser.version;
      body.browseros = browser.os;
    }

    let response;
    if (authViaCookie) {
      const [signinTokenError, signinTokenResponse] = await tryFetch(() => API.getSigninToken());
      if (signinTokenError || !signinTokenResponse.ok) {
        // Pas besoin d'afficher un message d'erreur si on était en train de quitter la page pendant le chargement.
        if (signinTokenError?.name === "BeforeUnloadAbortError") return setLoading(false);
        toast.error(errorMessage(signinTokenError || signinTokenResponse?.error));
        return setIsSubmitting(false);
      }
      response = signinTokenResponse;
    } else {
      const [signinError, signinResponse] = await tryFetch(() => API.post({ path: "/user/signin", body }));
      if (signinError || !signinResponse.ok) {
        toast.error(errorMessage(signinError || signinResponse?.error));
        return setIsSubmitting(false);
      }
      response = signinResponse;
    }
    window.localStorage.removeItem("automaticReload"); //  to enable automatiq reload when outdated version is used
    const { user, token, ok, askForOtp } = response;
    if (!ok) return setIsSubmitting(false);
    if (askForOtp) {
      setShowOtp(true);
      return setIsSubmitting(false);
    }
    const { organisation } = user;
    if (organisation?.disabledAt) {
      return (window.location.href = "/organisation-desactivee");
    }
    setOrganisation(organisation);
    setUser(user);
    if (!!organisation.encryptionEnabled && !showEncryption && !["superadmin"].includes(user.role)) {
      setShowEncryption(true);
      return setIsSubmitting(false);
    }
    if (token) API.setToken(token);
    setSessionInitialTimestamp(Date.now());
    if (!["superadmin"].includes(user.role) && !!signinForm.orgEncryptionKey && organisation.encryptionEnabled) {
      let organisationKey;
      try {
        organisationKey = await setOrgEncryptionKey(signinForm.orgEncryptionKey.trim(), { needDerivation: true });
      } catch (e) {
        setIsSubmitting(false);
        // Si c'est une erreur de dom sur `window.btoa`, on ne peut pas continuer
        if (e instanceof DOMException) {
          toast.error("La clé ne peut pas être chiffrée, elle contient des caractères invalides");
          // Pas besoin de capturer, parce que c'est juste un caractère invalide
          return setIsSubmitting(false);
        }
        throw e;
      }
      const encryptionIsValid = await checkEncryptedVerificationKey(organisation.encryptedVerificationKey, organisationKey);
      if (!encryptionIsValid) {
        resetOrgEncryptionKey();
        toast.error(
          "La clé de chiffrement ne semble pas être correcte, veuillez réessayer ou demander à un membre de votre organisation de vous aider (les équipes ne mano ne la connaissent pas)"
        );
        await tryFetch(() => API.post({ path: "/user/decrypt-attempt-failure" }));
        return setIsSubmitting(false);
      } else {
        setEncryptionKeyLength(signinForm.orgEncryptionKey.length);
        await tryFetch(() => API.post({ path: "/user/decrypt-attempt-success" }));
      }
    }
    // now login !
    window.localStorage.setItem("previously-logged-in", "true");
    // superadmin
    if (["superadmin"].includes(user.role)) {
      setIsSubmitting(false);
      history.push("/organisation");
      return;
    }
    const [error, teamResponse] = await tryFetchExpectOk(async () => API.get({ path: "/team" }));
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    const teams = teamResponse.data;
    const [errorUsers, usersResponse] = await tryFetchExpectOk(async () => API.get({ path: "/user", query: { minimal: true } }));
    if (errorUsers) {
      toast.error(errorMessage(errorUsers));
      return;
    }
    const users = usersResponse.data;
    setTeams(teams);
    setUsers(users);

    // Les utilisateurs supprimés sont récupérés pour pouvoir afficher leur nom dans les éléments qu'ils ont créés.
    const [errorDeletedUsers, deletedUsersResponse] = await tryFetchExpectOk(async () => API.get({ path: "/user/deleted-users" }));
    if (errorDeletedUsers) {
      toast.error(errorMessage(errorDeletedUsers));
      return;
    }
    setDeletedUsers(deletedUsersResponse.data);

    // onboarding
    if (!organisation.encryptionEnabled && ["admin"].includes(user.role)) {
      history.push(`/organisation/${organisation._id}`);
      return;
    }
    if (!teams.length) {
      history.push("/team");
      return;
    }
    if (organisation.lockedBy === user._id) {
      const canSignin = await new Promise((resolve) => {
        setModalConfirmState({
          open: true,
          options: {
            title: "Il semblerait que vous soyez en train de rechiffrer votre organisation, est-ce toujours le cas ?",
            subTitle: (
              <>
                <b>Votre organisation est actuellement verrouillée pour rechiffrement.</b>
                <br />
                <br />
                <small className="tw-opacity-70">
                  Lorsque vous êtes en train de rechiffrer votre organisation, il devient impossible aux autres utilisateurs d'ajouter ou de modifier
                  des données.
                  <br /> Il se peut que, pendant un rechiffrement, le rechiffrement a été interrompu (par exemple si vous rechargez votre page de
                  navigateur), mais l'organisation est toujours verrouillée, et les utilisateurs -&nbsp;vous compris&nbsp;- ne peuvent toujours pas
                  ajouter ou modifier des données.
                </small>
              </>
            ),
            buttons: [
              {
                text: "Oui, je suis toujours en train de rechiffrer sur une autre page",
                className: "button-cancel",
                onClick: () => {
                  resolve(true);
                },
              },
              {
                text: "Non, je ne rechiffre plus",
                className: "button-submit",
                onClick: async () => {
                  const [error] = await tryFetchExpectOk(async () =>
                    API.put({
                      path: `/organisation/${organisation._id}`,
                      body: {
                        encrypting: false,
                        lockedForEncryption: false,
                        lockedBy: null,
                      },
                    })
                  );
                  if (error) {
                    toast.error(errorMessage(error));
                  }
                  resolve(false);
                },
              },
            ],
          },
        });
      });
      if (!canSignin) {
        handleSubmit(e);
        return;
      }
    }
    // basic login
    if (user.teams.length === 1 || (process.env.NODE_ENV === "development" && import.meta.env.SKIP_TEAMS === "true")) {
      setCurrentTeam(user.teams[0]);
      onSigninValidated();
      return;
    }
    setShowSelectTeam(true);
  };
  const handleChangeRequest = (e) => {
    setShowErrors(false);
    setSigninForm((form) => ({ ...form, [e.target.name]: e.target.value }));
  };
  const handleKeyChange = (value) => {
    setShowErrors(false);
    setSigninForm((form) => ({ ...form, orgEncryptionKey: value }));
  };

  if (loading) return <></>;

  if (showSelectTeam) {
    return (
      <div className="tw-mx-10 tw-my-0 tw-w-full tw-max-w-lg tw-overflow-y-auto tw-overflow-x-hidden tw-rounded-lg tw-bg-white tw-px-7 tw-py-10 tw-text-black tw-shadow-[0_0_20px_0_rgba(0,0,0,0.2)]">
        <h1 className="tw-mb-6 tw-text-center tw-text-3xl tw-font-bold">Choisir son équipe pour commencer</h1>
        <div className="tw-flex tw-w-full tw-flex-col tw-items-center tw-gap-7 [&_>_*]:!tw-w-full">
          {user.teams.map((team) => (
            <ButtonCustom
              type="button"
              key={team._id}
              title={team.name}
              onClick={() => {
                setCurrentTeam(team);
                onSigninValidated();
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="tw-mx-10 tw-my-0 tw-w-full tw-max-w-lg tw-overflow-y-auto tw-overflow-x-hidden tw-rounded-lg tw-bg-white tw-px-7 tw-pb-2 tw-pt-10 tw-text-black sm:tw-drop-shadow-2xl">
      <h1 className="tw-mb-6 tw-text-center tw-text-3xl tw-font-bold">{userName ? `Bienvenue ${userName?.split(" ")?.[0]}` : "Bienvenue"}&nbsp;!</h1>
      {isAndroid && (
        <div className="tw-mb-6 tw-text-center">
          <a href="https://mano.sesan.fr/download" className="tw-text-main hover:tw-underline" target="_blank" rel="noopener noreferrer">
            👋 Télécharger l'application mobile pour Android
          </a>
          <p className="tw-text-xs tw-text-gray-500">Cette application est recommandée pour une meilleure expérience mobile</p>
        </div>
      )}
      <form onSubmit={handleSubmit} method="POST">
        {!authViaCookie && (
          <>
            <div className="tw-mb-6">
              <div className="tw-flex tw-flex-col-reverse">
                <input
                  name="email"
                  type="email"
                  id="email"
                  className="tw-mb-1.5 tw-block tw-w-full tw-rounded tw-border tw-border-main75 tw-bg-transparent tw-p-2.5 tw-text-black tw-outline-main tw-transition-all"
                  autoComplete="email"
                  placeholder="Cliquez ici pour entrer votre email"
                  value={signinForm.email}
                  onChange={handleChangeRequest}
                />
                <label htmlFor="email">Email </label>
              </div>
              {!!showErrors && <p className="tw-text-xs tw-text-red-500">{signinFormErrors.email}</p>}
            </div>
            <div className="tw-mb-6">
              <div className="tw-flex tw-flex-col-reverse">
                <PasswordInput
                  className="tw-mb-1.5 tw-block tw-w-full tw-rounded tw-border tw-border-main75 tw-bg-transparent tw-p-2.5 tw-text-black tw-outline-main tw-transition-all"
                  name="password"
                  id="password"
                  placeholder="Cliquez ici pour entrer votre mot de passe"
                  autoComplete="current-password"
                  value={signinForm.password}
                  onChange={handleChangeRequest}
                  setShowPassword={setShowPassword}
                  showPassword={showPassword}
                />
                <label htmlFor="password">Mot de passe</label>
              </div>
              {!!showErrors && <p className="tw-text-xs tw-text-red-500">{signinFormErrors.password}</p>}
            </div>
            <div className="-tw-mt-5 tw-mb-5 tw-text-right tw-text-sm">
              <Link to="/auth/forgot">Première connexion ou mot de passe oublié&nbsp;?</Link>
            </div>
            {showOtp && (
              <div className="tw-mb-6">
                <div className="tw-flex tw-flex-col-reverse ">
                  <input
                    name="otp"
                    type="text"
                    id="otp"
                    className="tw-mb-1.5 tw-block tw-w-full tw-rounded tw-border tw-border-main75 tw-bg-transparent tw-p-2.5 tw-text-black tw-outline-main tw-transition-all tw-uppercase"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={signinForm.otp}
                    onChange={handleChangeRequest}
                  />
                  <label htmlFor="email">Code reçu par email </label>
                </div>
                {!!showErrors && <p className="tw-text-xs tw-text-red-500">{signinFormErrors.otp}</p>}
              </div>
            )}
          </>
        )}
        {!!showEncryption && (
          <div className="tw-mb-6">
            <div className="tw-flex tw-flex-col-reverse">
              <KeyInput id="orgEncryptionKey" onChange={handleKeyChange} onPressEnter={handleSubmit} />
              <label htmlFor="orgEncryptionKey">Clé de chiffrement d'organisation</label>
            </div>
            <p className="tw-text-xs">
              Votre clé de chiffrement est uniquement connue par les membres de votre organisation, les équipes de Mano ne la connaissent pas
            </p>
            {!!showErrors && <p className="tw-text-xs tw-text-red-500">{signinFormErrors.orgEncryptionKey}</p>}
          </div>
        )}
        <ButtonCustom
          loading={isSubmitting}
          type="submit"
          color="primary"
          title="Se connecter"
          onClick={handleSubmit}
          className="tw-m-auto !tw-mt-8 !tw-w-56 tw-font-[Helvetica] !tw-text-base tw-font-medium"
        />
        {!!authViaCookie && (
          <ButtonCustom
            color="link"
            title="Me connecter avec un autre utilisateur"
            onClick={onLogout}
            type="button"
            className="tw-m-auto tw-font-[Helvetica] !tw-text-base !tw-font-normal"
          />
        )}
        <p className="tw-mx-auto tw-mb-0 tw-mt-5 tw-block tw-text-center tw-text-xs tw-text-gray-500">Version&nbsp;: {deploymentCommit}</p>
      </form>
    </div>
  );
};

export default SignIn;
