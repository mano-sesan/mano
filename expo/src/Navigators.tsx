import React, { useEffect, useRef, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { Alert, InteractionManager, AppState, NativeEventSubscription } from "react-native";
import { NavigationContainer, useNavigationContainerRef, DefaultTheme } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useMMKVNumber } from "react-native-mmkv";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AgendaIcon, PersonIcon, TerritoryIcon } from "./icons";
import { Provider, useAtomValue, useSetAtom } from "jotai";
import logEvents from "./services/logEvents";
import Login from "./scenes/Login/Login";
import ActionScreen from "./scenes/Actions/Action";
import PersonsListNavigator from "./scenes/Persons/PersonsListNavigator";
import Person from "./scenes/Persons/Person";
import Rencontre from "./scenes/Persons/Rencontre";
import StructuresList from "./scenes/Structures/StructuresList";
import NewStructureForm from "./scenes/Structures/NewStructureForm";
import Structure from "./scenes/Structures/Structure";
import Soliguide from "./scenes/Soliguide/Soliguide";
import Comment from "./scenes/Comments/Comment";
import Place from "./scenes/Places/Place";
import PlaceNew from "./scenes/Places/PlaceNew";
import Menu from "./scenes/Menu/Menu";
import Legal from "./scenes/Menu/Legal";
import Privacy from "./scenes/Menu/Privacy";
import Cgu from "./scenes/Menu/Cgu";
import colors from "./utils/colors";
import { TeamSelection, ChangeTeam } from "./scenes/Login/TeamSelection";
import ActionsTabNavigator from "./scenes/Actions/ActionsTabNavigator";
import ChangePassword from "./scenes/Login/ChangePassword";
import ForgetPassword from "./scenes/Login/ForgetPassword";
import ForceChangePassword from "./scenes/Login/ForceChangePassword";
import TerritoriesList from "./scenes/Territories/TerritoriesList";
import NewTerritoryForm from "./scenes/Territories/NewTerritoryForm";
import Territory from "./scenes/Territories/Territory";
import TerritoryObservation from "./scenes/Territories/TerritoryObservation";
import EnvironmentIndicator from "./components/EnvironmentIndicator";
import API from "./services/api";
import Charte from "./scenes/Menu/Charte";
import CharteAcceptance from "./scenes/Login/CharteAcceptance";
import { DataLoader, loaderFullScreenState, loadingState, progressState } from "./components/Loader";
import BellWithNotifications from "./scenes/Notifications/BellWithNotifications";
import DotsIcon from "./icons/DotsIcon";
import Notifications from "./scenes/Notifications/Notifications";
import ReportsCalendar from "./scenes/Reports/ReportsCalendar";
import Report from "./scenes/Reports/Report";
import Actions from "./scenes/Reports/Actions";
import CommentsForReport from "./scenes/Reports/CommentsForReport";
import RencontresForReport from "./scenes/Reports/RencontresForReport";
import PassagesForReport from "./scenes/Reports/PassagesForReport";
import Observations from "./scenes/Reports/Observations";
import Services from "./scenes/Reports/Services";
import Collaborations from "./scenes/Reports/Collaborations";
import Treatment from "./scenes/Persons/Treatment";
import Consultation from "./scenes/Persons/Consultation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { currentTeamState, organisationState, teamsState, userState } from "./recoil/auth";
import { appCurrentCacheKey, clearCache } from "./services/dataManagement";
import useResetAllCachedDataRecoilStates from "./recoil/reset";
import CGUsAcceptance from "./scenes/Login/CGUsAcceptance";
import TerritoryObservationRencontre from "./scenes/Territories/TerritoryObservationRencontre";
import Consultations from "./scenes/Reports/Consultations";
import Passage from "./scenes/Persons/Passage";
import ProgressBar from "./components/ProgressBar";
import APKUpdater from "./components/APKUpdater";
import ActionsFilter from "./scenes/Actions/ActionsFilter";
import OrganisationDesactivee from "./scenes/Login/OrganisationDesactivee";
import { LoginStackParamsList, RootStackParamList, TabsParamsList } from "./types/navigation";
import ActionNewScreen from "./scenes/Actions/ActionNewScreen";

const Tab = createBottomTabNavigator<TabsParamsList>();
const TabNavigator = () => {
  const user = useAtomValue(userState);
  const organisation = useAtomValue(organisationState);
  const fullScreen = useAtomValue(loaderFullScreenState);

  if (fullScreen) return null;

  return (
    <Tab.Navigator
      initialRouteName="AGENDA"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.app.color,
        tabBarInactiveTintColor: "#aaa",
        lazy: true,
      }}
    >
      <Tab.Screen
        name="AGENDA"
        component={ActionsTabNavigator}
        options={{
          tabBarIcon: AgendaIcon,
          tabBarLabel: "AGENDA",
          tabBarButtonTestID: "tab-bar-actions",
          lazy: true,
        }}
      />
      {!!organisation?.territoriesEnabled && (
        <Tab.Screen
          name="TERRITOIRES"
          component={TerritoriesList}
          options={{
            tabBarIcon: TerritoryIcon,
            tabBarLabel: "TERRITOIRES",
            tabBarButtonTestID: "tab-bar-territories",
            lazy: true,
          }}
        />
      )}
      <Tab.Screen
        name="PERSONNES"
        component={PersonsListNavigator}
        options={{
          tabBarIcon: PersonIcon,
          tabBarLabel: "PERSONNES",
          tabBarButtonTestID: "tab-bar-persons",
          lazy: true,
        }}
      />
      {["admin", "normal"].includes(user?.role!) && (
        <Tab.Screen
          name="PRIORITÉS"
          component={Notifications}
          options={{
            tabBarIcon: BellWithNotifications,
            tabBarLabel: "PRIORITÉS",
            tabBarButtonTestID: "tab-bar-notifications",
            lazy: true,
          }}
        />
      )}
      <Tab.Screen
        name="MENU"
        component={Menu}
        options={{
          tabBarIcon: DotsIcon,
          tabBarLabel: "MENU",
          tabBarButtonTestID: "tab-bar-profil",
          lazy: true,
        }}
      />
    </Tab.Navigator>
  );
};

const LoginStack = createStackNavigator<LoginStackParamsList>();
const LoginNavigator = () => (
  <LoginStack.Navigator initialRouteName="LOGIN" screenOptions={{ headerShown: false }}>
    <LoginStack.Screen name="LOGIN" component={Login} />
    <LoginStack.Screen name="TEAM_SELECTION" component={TeamSelection} />
    <LoginStack.Screen name="CHARTE_ACCEPTANCE" component={CharteAcceptance} />
    <LoginStack.Screen name="CGUS_ACCEPTANCE" component={CGUsAcceptance} />
    <LoginStack.Screen name="FORCE_CHANGE_PASSWORD" component={ForceChangePassword} />
    <LoginStack.Screen name="FORGET_PASSWORD" component={ForgetPassword} />
    <LoginStack.Screen name="ORGANISATION_DESACTIVEE" component={OrganisationDesactivee} />
  </LoginStack.Navigator>
);

const AppStack = createStackNavigator<RootStackParamList>();

const App = () => {
  const appState = useRef(AppState.currentState);
  const appStateListener = useRef<NativeEventSubscription | null>(null);
  const navigationRef = useNavigationContainerRef();
  const loading = useAtomValue(loadingState);
  const progress = useAtomValue(progressState);
  const fullScreen = useAtomValue(loaderFullScreenState);

  const resetAllRecoilStates = useResetAllCachedDataRecoilStates();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const resetOrganisation = useSetAtom(organisationState);
  const resetUser = useSetAtom(userState);
  const resetTeams = useSetAtom(teamsState);
  const resetCurrentTeam = useSetAtom(currentTeamState);
  const [_, setLastRefresh] = useMMKVNumber(appCurrentCacheKey);
  const [resetLoginStackKey, setResetLoginStackKey] = useState(0);
  const clearAllRef = useRef(false);

  useEffect(() => {
    logEvents.initLogEvents().then(() => {
      logEvents.logAppVisit();
      appStateListener.current = AppState.addEventListener("change", (nextAppState) => {
        if (appState.current.match(/inactive|background/) && nextAppState === "active") {
          if (API.token) API.get({ path: "/check-auth" }); // will force logout if session is expired
          logEvents.logAppVisit();
        } else {
          logEvents.logAppClose();
        }
        appState.current = nextAppState;
      });
    });

    API.onLogIn = () => setIsLoggedIn(true);

    API.logout = async (clearAll: boolean) => {
      clearAllRef.current = clearAll;
      setIsLoggedIn(false);
    };

    return () => {
      logEvents.logAppClose();
      appStateListener.current?.remove();
    };
  }, []);

  const onLogout = async () => {
    API.token = "";
    AsyncStorage.removeItem("persistent_token");
    API.enableEncrypt = null;
    API.hashedOrgEncryptionKey = null;
    API.orgEncryptionKey = null;
    API.organisation = null;
    if (clearAllRef.current) {
      await clearCache();
      resetAllRecoilStates();
      setLastRefresh(0);
    }
    InteractionManager.runAfterInteractions(async () => {
      resetUser(null);
      resetOrganisation(null);
      resetTeams([]);
      resetCurrentTeam(null);
      if (clearAllRef.current) {
        Alert.alert("Déconnexion réussie", "Vous pouvez aussi supprimer Mano pour plus de sécurité");
        clearAllRef.current = false;
      }
      setResetLoginStackKey((k) => k + 1);
    });
  };

  const isMounted = useRef(false);
  useEffect(() => {
    if (isLoggedIn) return;
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    onLogout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  return (
    <ActionSheetProvider>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          // @ts-expect-error - Property 'navigation' does not exist on type 'ApiService'.ts(2339)
          API.navigation = navigationRef;
          SplashScreen.hide();
        }}
        theme={{
          ...DefaultTheme,
          colors: { ...DefaultTheme.colors, primary: colors.app.color },
        }}
        linking={{
          enabled: true,
          prefixes: [
            // Change the scheme to match your app's scheme defined in app.json
            "mano://",
          ],
        }}
      >
        <AppStack.Navigator initialRouteName="LOGIN_STACK" screenOptions={{ gestureEnabled: false, headerShown: false }}>
          <AppStack.Screen name="LOGIN_STACK" component={LoginNavigator} key={resetLoginStackKey} />
          {!!isLoggedIn && (
            <>
              <AppStack.Screen name="TABS_STACK" component={TabNavigator} />
              {/* Actions */}
              <AppStack.Screen name="ACTION" component={ActionScreen} />
              <AppStack.Screen name="ACTION_NEW_STACK" component={ActionNewScreen} />
              <AppStack.Screen name="ACTIONS" component={Actions} />
              <AppStack.Screen name="ACTIONS_FILTER" component={ActionsFilter} />
              {/* Persons */}
              <AppStack.Screen name="PERSON" component={Person} />
              {/* Comments */}
              <AppStack.Screen name="COMMENT" component={Comment} />
              <AppStack.Screen name="COMMENTS" component={CommentsForReport} />
              {/* Place */}
              <AppStack.Screen name="PLACE" component={Place} />
              <AppStack.Screen name="PLACE_NEW" component={PlaceNew} />
              {/* Treatments */}
              <AppStack.Screen name="TREATMENT" component={Treatment} />
              {/* Territories */}
              <AppStack.Screen name="TERRITORY" component={Territory} />
              <AppStack.Screen name="TERRITORY_NEW" component={NewTerritoryForm} />
              <AppStack.Screen name="TERRITORY_OBSERVATION" component={TerritoryObservation} />
              <AppStack.Screen name="TERRITORY_OBSERVATIONS" component={Observations} />
              <AppStack.Screen name="TERRITORY_OBSERVATION_RENCONTRE" component={TerritoryObservationRencontre} />
              {/* Rencontres */}
              <AppStack.Screen name="RENCONTRE" component={Rencontre} />
              <AppStack.Screen name="RENCONTRES" component={RencontresForReport} />
              {/* Passages */}
              <AppStack.Screen name="PASSAGE" component={Passage} />
              <AppStack.Screen name="PASSAGES" component={PassagesForReport} />
              {/* Reports */}
              <AppStack.Screen name="COMPTES_RENDUS" component={ReportsCalendar} />
              <AppStack.Screen name="COMPTE_RENDU" component={Report} />
              {/* Collaborations */}
              <AppStack.Screen name="COLLABORATIONS" component={Collaborations} />
              {/* Consultations */}
              <AppStack.Screen name="CONSULTATIONS" component={Consultations} />
              <AppStack.Screen name="CONSULTATION" component={Consultation} />
              {/* Services */}
              <AppStack.Screen name="SERVICES" component={Services} />
              {/* Structures */}
              <AppStack.Screen name="STRUCTURES" component={StructuresList} />
              <AppStack.Screen name="STRUCTURE_NEW" component={NewStructureForm} />
              <AppStack.Screen name="STRUCTURE" component={Structure} />
              {/* Autre */}
              <AppStack.Screen name="SOLIGUIDE" component={Soliguide} />
              <AppStack.Screen name="CHANGE_PASSWORD" component={ChangePassword} />
              <AppStack.Screen name="CHANGE_TEAM" component={ChangeTeam} />
              <AppStack.Screen name="LEGAL" component={Legal} />
              <AppStack.Screen name="PRIVACY" component={Privacy} />
              <AppStack.Screen name="CGU" component={Cgu} />
              <AppStack.Screen name="CHARTE" component={Charte} />
            </>
          )}
        </AppStack.Navigator>
        <DataLoader />
        <ProgressBar loading={loading} progress={progress} fullScreen={fullScreen} />
        <APKUpdater />
        <EnvironmentIndicator />
      </NavigationContainer>
    </ActionSheetProvider>
  );
};

export default function Navigators() {
  return (
    <Provider>
      <App />
    </Provider>
  );
}
