import React from "react";
import { Switch } from "react-router-dom";
import { useAtomValue } from "jotai";

import List from "./list";
import SentryRoute from "../../components/Sentryroute";
import { currentTeamState } from "../../atoms/auth";

const Router = () => {
  const currentTeam = useAtomValue(currentTeamState);

  if (!currentTeam) return null;

  return (
    <Switch>
      <SentryRoute path="/" component={List} />
    </Switch>
  );
};

export default Router;
