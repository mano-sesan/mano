import React from "react";
import { Redirect, Switch } from "react-router-dom";
import { useAtomValue } from "jotai";

import List from "./list";
import SentryRoute from "../../components/Sentryroute";
import { currentTeamState, userState } from "../../atoms/auth";

const Router = () => {
  const user = useAtomValue(userState);
  const currentTeam = useAtomValue(currentTeamState);

  if (!["admin", "normal", "restricted-access"].includes(user.role)) return <Redirect to="/" />;
  if (!currentTeam) return null;

  return (
    <Switch>
      <SentryRoute path="/" component={List} />
    </Switch>
  );
};

export default Router;
