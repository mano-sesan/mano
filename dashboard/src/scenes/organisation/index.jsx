import { Redirect, Switch } from "react-router-dom";
import { useAtomValue } from "jotai";
import SentryRoute from "../../components/Sentryroute";
import { userState } from "../../atoms/auth";

import Superadmin from "./superadmin";
import View from "./view";

const Router = () => {
  const user = useAtomValue(userState);

  if (!["admin", "superadmin"].includes(user.role)) return <Redirect to="/" />;

  return (
    <Switch>
      <SentryRoute path="/organisation/:id" component={View} />
      <SentryRoute path="/" component={Superadmin} />
    </Switch>
  );
};

export default Router;
