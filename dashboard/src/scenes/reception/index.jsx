import React from "react";
import { Redirect, Switch } from "react-router-dom";
import { useAtomValue } from "jotai";
import SentryRoute from "../../components/Sentryroute";

import View from "./view";
import { currentTeamState, userState } from "../../atoms/auth";

const Router = () => {
  const user = useAtomValue(userState);
  const currentTeam = useAtomValue(currentTeamState);

  if (!["admin", "normal", "restricted-access"].includes(user.role)) return <Redirect to="/" />;
  if (!currentTeam) return null;

  return (
    <Switch>
      <SentryRoute path="/reception" component={View} />
    </Switch>
  );
};

export default Router;
