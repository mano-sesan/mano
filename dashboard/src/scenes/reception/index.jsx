import React from "react";
import { Switch } from "react-router-dom";
import { useStore } from "../../store";
import SentryRoute from "../../components/Sentryroute";

import View from "./view";

const Router = () => {
  const currentTeam = useStore((state) => state.currentTeam);

  if (!currentTeam) return null;

  return (
    <Switch>
      <SentryRoute path="/reception" component={View} />
    </Switch>
  );
};

export default Router;
