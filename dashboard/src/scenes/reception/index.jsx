import React from "react";
import { Switch } from "react-router-dom";
import { useAtomValue } from "jotai";
import SentryRoute from "../../components/Sentryroute";

import View from "./view";
import { currentTeamState } from "../../atoms/auth";

const Router = () => {
  const currentTeam = useAtomValue(currentTeamState);

  if (!currentTeam) return null;

  return (
    <Switch>
      <SentryRoute path="/reception" component={View} />
    </Switch>
  );
};

export default Router;
