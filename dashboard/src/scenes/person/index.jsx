import React from "react";
import { Switch } from "react-router-dom";
import SentryRoute from "../../components/Sentryroute";

import List from "./list";
import View from "./view";
import { useAtomValue } from "jotai";
import { currentTeamState } from "../../recoil/auth";

const Router = () => {
  const currentTeam = useAtomValue(currentTeamState);

  if (!currentTeam) return null;

  return (
    <Switch>
      <SentryRoute path="/person/:personId" component={View} />
      <SentryRoute path="/" component={List} />
    </Switch>
  );
};

export default Router;
