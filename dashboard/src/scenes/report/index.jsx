import { Switch } from "react-router-dom";
import SentryRoute from "../../components/Sentryroute";

import View from "./view";

const Router = () => {
  return (
    <Switch>
      <SentryRoute path="/report" component={View} />
    </Switch>
  );
};

export default Router;
