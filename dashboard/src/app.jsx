import { useEffect } from "react";
import { Provider, useAtomValue } from "jotai";
import { store } from "./store";
import { Router, Switch, Redirect } from "react-router-dom";
import { createBrowserHistory } from "history";
import * as Sentry from "@sentry/react";
import { fr } from "date-fns/esm/locale";
import { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Account from "./scenes/account";
import Auth from "./scenes/auth";
import Organisation from "./scenes/organisation";
import Action from "./scenes/action";
import Territory from "./scenes/territory";
import Structure from "./scenes/structure";
import Team from "./scenes/team";
import Stats from "./scenes/stats";
import SearchView from "./scenes/search";
import User from "./scenes/user";
import Report from "./scenes/report";
import Person from "./scenes/person";
import Drawer from "./components/drawer";
import Reception from "./scenes/reception";
import ActionModal from "./components/ActionModal";
import Charte from "./scenes/auth/charte";
import { userState } from "./atoms/auth";
import API, { tryFetch } from "./services/api";
import ScrollToTop from "./components/ScrollToTop";
import TopBar from "./components/TopBar";
import VersionOutdatedAlert from "./components/VersionOutdatedAlert";
import EncryptionWarnings from "./components/EncryptionWarnings";
import ModalConfirm from "./components/ModalConfirm";
import DataLoader from "./components/DataLoader";
import { Bounce, cssTransition, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import SentryRoute from "./components/Sentryroute";
import { ENV, VERSION } from "./config";
import DuplicatedReportsTestChecker from "./components/DuplicatedReportsTestChecker";
import ConsultationModal from "./components/ConsultationModal";
import TreatmentModal from "./scenes/person/components/TreatmentModal";
import BottomBar from "./components/BottomBar";
import CGUs from "./scenes/auth/cgus";
import { getHashedOrgEncryptionKey, resetOrgEncryptionKey } from "./services/encryption";
import { deploymentCommitState, deploymentDateState, showOutdateAlertBannerState } from "./atoms/version";
import Sandbox from "./scenes/sandbox";
import { initialLoadIsDoneState, useDataLoader } from "./services/dataLoader";
import ObservationModal from "./components/ObservationModal";
import OrganisationDesactivee from "./scenes/organisation-desactivee";
import { UploadProgressProvider } from "./components/document/DocumentsUpload";

export const FORCE_LOGOUT_BROADCAST_KEY = "mano-force-logout";

// Track if this tab initiated the logout to avoid processing its own broadcast.
// Note: This flag is never reset because once set, this tab is in the process of
// logging out and will soon navigate to /auth, which reloads the module with the flag reset.
let thisTabInitiatedLogout = false;

export function markLogoutInitiatedByThisTab() {
  thisTabInitiatedLogout = true;
}

const ToastifyFastTransition = cssTransition({
  enter: "Toastify--animate Toastify__hack-force-fast Toastify__bounce-enter",
  exit: "Toastify--animate Toastify__hack-force-fast Toastify__bounce-exit",
  appendPosition: true,
  collapseDuration: 0,
  collapse: true,
});

registerLocale("fr", fr);

const history = createBrowserHistory();

if (ENV === "production") {
  Sentry.init({
    dsn: "https://2e784fe581bff74181600b4460c01955@o4506615228596224.ingest.sentry.io/4506672157229056",
    environment: "dashboard",
    release: VERSION,
    integrations: [Sentry.reactRouterV5BrowserTracingIntegration({ history })],
    maxValueLength: 10000,
    normalizeDepth: 10,
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 0.05,
    ignoreErrors: [
      "Network request failed",
      "Failed to fetch",
      "Load failed",
      "NetworkError",
      // ???
      "withrealtime/messaging",
      // This error seems to happen only in firefox and to be ignorable.
      // The "fetch" failed because user has navigated.
      // Since other browsers don't have this problem, we don't care about it,
      // it may be a false positive.
      "AbortError: The operation was aborted",
      // Sur safari, on a des erreur de type "TypeError: cancelled" qui seraient liées
      // au bouton "X" (ou refresh) pressé pendant un fetch. Il semblerait que la meilleure
      // approche soit de les ignorer.
      // Cf: https://stackoverflow.com/a/60860369/978690
      "TypeError: cancelled",
      "TypeError: annulé",
    ],
  });
}

function abortRequests() {
  // On souhaite rester silencieux sur ces erreurs, parce qu'on se contente de les annuler exprès
  // Source: https://stackoverflow.com/a/73783869/978690
  try {
    API.abortController.abort(new DOMException("Aborted by navigation", "BeforeUnloadAbortError"));
    // reset new abort controller ?
    // API.abortController = new AbortController();
  } catch (e) {
    console.log("Aborting requests failed", e);
    console.error(e);
  }
}

const App = () => {
  const user = useAtomValue(userState);
  const initialLoadIsDone = useAtomValue(initialLoadIsDoneState);
  const { refresh } = useDataLoader();
  const apiToken = API.getToken();

  // Abort all pending requests (that listen to this signal)
  useEffect(() => {
    window.addEventListener("beforeunload", abortRequests);
    return () => {
      window.removeEventListener("beforeunload", abortRequests);
    };
  }, []);

  // Cross-tab logout: when another tab triggers "logout + clear cache",
  // it writes a localStorage flag. Other tabs receive a `storage` event.
  useEffect(() => {
    const onStorage = (e) => {
      if (!e) return;
      if (e.key !== FORCE_LOGOUT_BROADCAST_KEY) return;
      // Skip if this tab initiated the logout - it's already handling its own logout
      if (thisTabInitiatedLogout) return;
      // If we're already on the auth page, don't fight navigation; just ensure we drop local secrets.
      const alreadyOnAuth = typeof window !== "undefined" && window.location?.pathname?.includes?.("/auth");
      abortRequests();
      try {
        window.sessionStorage?.clear();
      } catch (_err) {
        // ignore
      }
      resetOrgEncryptionKey();
      try {
        window.localStorage?.removeItem("previously-logged-in");
      } catch (_err) {
        // ignore
      }
      if (alreadyOnAuth) return;
      window.location.href = "/auth";
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const maybeRefreshOnReturn = () => {
      // When switching tabs in the same window, `focus` is not reliably fired, but `visibilitychange` is.
      // We only refresh when the tab becomes visible.
      if (typeof document !== "undefined" && document.visibilityState && document.visibilityState !== "visible") return;
      // why `!window.location.pathname.includes("/auth")` ?
      // EXPLANATION: in global_cache-when-logout.spec.ts:L77, we do
      // `await page.goto("http://localhost:8090/auth");`
      // changing the url from the url input implies a blur to go to the url input,
      // then a focus back on the window
      // which send two events: 'focus' and 'beforeunload'
      // 'focus' drives to `refresh()` if user is logged in
      // 'beforeunload' abort all pending requests, including the ones in `refresh()` if the requests `/check-auth`  went fast enough
      // aborting requests in `refresh()` clears the cache on line `await clearCache("resetLoaderOnError");`
      // clearing the cach cleares also the localStorage value of `previously-logged-in`
      // which prevent `/signin-token` to be called and the `#orgEncryptionKey` from appearing on the login page
      // which makes the test fails sometimes
      // so is it safe to add this condition ? well,
      // normally, the users never touch the url input for navigation to a /person or whatever, even not for /auth
      // so this check is basically only for tests
      // and checking only /auth makes sense as you shouldn't need to /check-auth on /auth page anyway
      if (apiToken && !window.location.pathname.includes("/auth")) {
        // Cela déclenchera un logout si la session est expirée
        tryFetch(() => API.getAbortable({ path: "/check-auth" })).then(() => {
          // On ne recharge que s'il y a une clé de chiffrement
          // Sinon ça met du bazar en cache (parce que ça va chercher des données chiffrées et que ça échoue)
          if (initialLoadIsDone && getHashedOrgEncryptionKey()) {
            refresh();
          }
        });
      }
    };
    window.addEventListener("focus", maybeRefreshOnReturn);
    document.addEventListener("visibilitychange", maybeRefreshOnReturn);
    return () => {
      window.removeEventListener("focus", maybeRefreshOnReturn);
      document.removeEventListener("visibilitychange", maybeRefreshOnReturn);
    };
  }, [initialLoadIsDone, refresh, apiToken]);

  const showOutdateAlertBanner = useAtomValue(showOutdateAlertBannerState);
  const deploymentCommit = useAtomValue(deploymentCommitState);
  const deploymentDate = useAtomValue(deploymentDateState);

  if (!user && showOutdateAlertBanner && !window.localStorage.getItem("automaticReload")) {
    abortRequests();
    window.localStorage.setItem("deploymentDate", deploymentDate);
    window.localStorage.setItem("deploymentCommit", deploymentCommit);
    window.localStorage.setItem("automaticReload", "true"); //  to prevent infinite loop
    window.location.reload(true);
    return null;
  }

  return (
    <div className="main-container">
      <ToastContainer transition={import.meta.env.VITE_TEST_PLAYWRIGHT !== "true" ? Bounce : ToastifyFastTransition} />
      <VersionOutdatedAlert />
      {import.meta.env.VITE_TEST_PLAYWRIGHT === "true" && <DuplicatedReportsTestChecker />}
      <Router history={history}>
        <ScrollToTop />
        <Switch>
          <SentryRoute path="/organisation-desactivee" component={OrganisationDesactivee} />
          <SentryRoute path="/auth" component={Auth} />
          <SentryRoute path="/bac-a-sable" component={Sandbox} />
          <RestrictedRoute path="/charte" component={Charte} />
          <RestrictedRoute path="/account" component={Account} />
          <RestrictedRoute path="/user" component={User} />
          <RestrictedRoute path="/person" component={Person} />
          <RestrictedRoute path="/action" component={Action} />
          <RestrictedRoute path="/territory" component={Territory} />
          <RestrictedRoute path="/structure" component={Structure} />
          <RestrictedRoute path="/team" component={Team} />
          <RestrictedRoute path="/organisation" component={Organisation} />
          <RestrictedRoute path="/stats" component={Stats} />
          <RestrictedRoute path="/reception" component={Reception} />
          <RestrictedRoute path="/search" component={SearchView} />
          <RestrictedRoute path="/report" component={Report} />
          <RestrictedRoute path="*" component={() => <Redirect to={"stats"} />} />
        </Switch>
        <ObservationModal />
        <ActionModal />
        <ConsultationModal />
        <TreatmentModal />
        <ModalConfirm />
        <UploadProgressProvider />
        {!!user && <DataLoader />}
      </Router>
    </div>
  );
};

const RestrictedRoute = ({ component: Component, _isLoggedIn, ...rest }) => {
  const { fullScreen } = useDataLoader();
  const user = useAtomValue(userState);
  if (!!user && !user?.termsAccepted)
    return (
      <main className="main">
        <SentryRoute {...rest} path="/auth" component={Charte} />
      </main>
    );
  if (!!user && !user?.cgusAccepted)
    return (
      <main className="main">
        <SentryRoute {...rest} path="/auth" component={CGUs} />
      </main>
    );

  // When no user, store in session storage the current route to redirect to it after login
  if (!user) {
    try {
      window.sessionStorage.setItem("redirectPath", rest.location.pathname);
    } catch (_e) {
      // On s'en fiche si ça ne marche pas
    }
  }

  // Do not show content if loading state is fullscreen and user is logged in.
  if (user && fullScreen) return <div></div>;

  if (user && ["superadmin"].includes(user.role)) return <SentryRoute {...rest} render={(props) => <Component {...props} />} />;

  return (
    <>
      {!!user && <TopBar />}
      <div className="main">
        {!!user && !["stats-only"].includes(user.role) && <Drawer />}
        <main
          id="main-content"
          className="tw-relative tw-flex tw-grow tw-basis-full tw-flex-col tw-overflow-auto tw-overflow-x-hidden tw-overflow-y-scroll print:tw-h-auto print:tw-max-w-full print:tw-overflow-visible"
        >
          {!!user && <EncryptionWarnings />}
          <div className="tw-px-2 sm:tw-px-12 sm:tw-pb-12 sm:tw-pt-4 print:!tw-ml-0 print:tw-p-0">
            <SentryRoute {...rest} render={(props) => (user ? <Component {...props} /> : <Redirect to={{ pathname: "/auth" }} />)} />
          </div>
        </main>
      </div>
      {!!user && !["stats-only"].includes(user.role) && <BottomBar />}
    </>
  );
};

export default function ContextedApp() {
  // TODO: check if provider is needed
  // https://jotai.org/docs/core/provider
  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
}
