import React from "react";
import { Redirect, Switch } from "react-router-dom";
import { useAtomValue } from "jotai";
import SentryRoute from "../../components/Sentryroute";
import { userState } from "../../atoms/auth";

import List from "./list";

const Router = () => {
  const user = useAtomValue(userState);

  if (!["admin", "normal", "restricted-access"].includes(user.role)) return <Redirect to="/" />;

  return (
    <Switch>
      <SentryRoute path="/" component={List} />
    </Switch>
  );
};

export default Router;
