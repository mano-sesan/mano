import { useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import API, { tryFetch } from "../../services/api";

const PscCallback = () => {
  const history = useHistory();
  const location = useLocation();

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get("code");
      const state = params.get("state");
      const pscError = params.get("error");

      if (pscError) {
        // PSC a refusé l'auth côté portail (ex. timeout, code wallet faux).
        history.replace(`/auth?psc_error=PSC_FLOW_ERROR`);
        return;
      }
      if (!code || !state) {
        history.replace(`/auth?psc_error=PSC_FLOW_ERROR`);
        return;
      }

      const [err, response] = await tryFetch(() => API.get({ path: "/user/psc/exchange", query: { code, state } }));
      if (err || !response?.ok) {
        const errorCode = response?.error ?? "PSC_FLOW_ERROR";
        history.replace(`/auth?psc_error=${encodeURIComponent(errorCode)}`);
        return;
      }
      history.replace("/auth?psc_success=1");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="tw-flex tw-min-h-screen tw-items-center tw-justify-center">
      <p>Connexion via Pro Santé Connect en cours…</p>
    </div>
  );
};

export default PscCallback;
