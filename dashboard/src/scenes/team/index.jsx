import React from "react";
import { Redirect, Switch } from "react-router-dom";
import { useAtomValue } from "jotai";
import SentryRoute from "../../components/Sentryroute";
import { userState } from "../../atoms/auth";

import List from "./list";
import View from "./view";

const Router = () => {
  const user = useAtomValue(userState);

  if (!["admin"].includes(user.role)) return <Redirect to="/" />;

  return (
    <Switch>
      <SentryRoute path="/team/:id" component={View} />
      <SentryRoute path="/" component={List} />
    </Switch>
  );
};

export default Router;
