import React from "react";
import { Switch } from "react-router-dom";

import Reset from "./reset";
import Forgot from "./forgot";
import SignIn from "./signin";
import PscCallback from "./pscCallback";
import SentryRoute from "../../components/Sentryroute";

const Router = () => {
  return (
    <Switch>
      <SentryRoute path="/auth/reset" component={Reset} />
      <SentryRoute path="/auth/forgot" component={Forgot} />
      <SentryRoute path="/auth/psc/callback" component={PscCallback} />
      <SentryRoute path="/auth" component={SignIn} />
    </Switch>
  );
};

export default Router;
