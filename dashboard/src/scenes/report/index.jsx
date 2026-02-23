import { Redirect, Switch } from "react-router-dom";
import { useAtomValue } from "jotai";
import SentryRoute from "../../components/Sentryroute";
import { userState } from "../../atoms/auth";

import View from "./view";

const Router = () => {
  const user = useAtomValue(userState);

  if (!["admin", "normal", "restricted-access"].includes(user.role)) return <Redirect to="/" />;

  return (
    <Switch>
      <SentryRoute path="/report" component={View} />
    </Switch>
  );
};

export default Router;
