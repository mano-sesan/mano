import React from "react";
import { Switch } from "react-router-dom";
import { useStore } from "../../store";

import List from "./list";
import SentryRoute from "../../components/Sentryroute";

const Router = () => {
  const currentTeam = useStore((state) => state.currentTeam);

  if (!currentTeam) return null;

  return (
    <Switch>
      <SentryRoute path="/" component={List} />
    </Switch>
  );
};

export default Router;
