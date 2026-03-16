import React, { useEffect, useRef, useState } from "react";
import { type NativeStackScreenProps } from "@react-navigation/native-stack";
import styled from "styled-components/native";
import {
  Alert,
  AlertButton,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  ScrollView,
  StatusBar,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMMKVNumber, useMMKVString } from "react-native-mmkv";
import API from "../../services/api";
import SceneContainer from "../../components/SceneContainer";
import ScrollContainer from "../../components/ScrollContainer";
import colors from "../../utils/colors";
import ButtonsContainer from "../../components/ButtonsContainer";
import Button from "../../components/Button";
import EmailInput from "../../services/EmailInput";
import { MyText } from "../../components/MyText";
import InputLabelled from "../../components/InputLabelled";
import EyeIcon from "../../icons/EyeIcon";
import Title, { SubTitle } from "../../components/Title";
import { DEVMODE_ENCRYPTION_KEY, DEVMODE_PASSWORD, VERSION } from "../../config";
import { useSetAtom } from "jotai";
import { currentTeamState, deletedUsersState, organisationState, teamsState, usersState, userState } from "../../recoil/auth";
import { clearCache, appCurrentCacheKey } from "../../services/dataManagement";
import { refreshTriggerState } from "../../components/Loader";
import { useIsFocused } from "@react-navigation/native";
import useResetAllCachedDataRecoilStates from "../../recoil/reset";
import { LoginStackParamsList } from "@/types/navigation";

type Props = NativeStackScreenProps<LoginStackParamsList, "LOGIN">;

const Login = ({ navigation }: Props) => {
  const [authViaCookie, setAuthViaCookie] = useState(false);
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [example, setExample] = useState("example@example.com");
  const [password, setPassword] = useState(__DEV__ ? DEVMODE_PASSWORD : "");
  const [encryptionKey, setEncryptionKey] = useState(__DEV__ ? DEVMODE_ENCRYPTION_KEY : "");
  const [showPassword, setShowPassword] = useState(false);
  const [showEncryptionKeyInput, setShowEncryptionKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const setUser = useSetAtom(userState);
  // eslint-disable-next-line no-unused-vars
  const [_, setLastRefresh] = useMMKVNumber(appCurrentCacheKey);
  const setOrganisation = useSetAtom(organisationState);
  const setTeams = useSetAtom(teamsState);
  const setUsers = useSetAtom(usersState);
  const setDeletedUsers = useSetAtom(deletedUsersState);
  const setCurrentTeam = useSetAtom(currentTeamState);
  const [storageOrganisationId, setStorageOrganisationId] = useMMKVString("organisationId");
  const setRefreshTrigger = useSetAtom(refreshTriggerState);
  const resetAllRecoilStates = useResetAllCachedDataRecoilStates();

  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) return;
    const initTimeout = setTimeout(async () => {
      // check version
      const response = await API.get({ path: "/version" });
      if (!response.ok) {
        SplashScreen.hide();
        const [title, subTitle, actions = [], options = {}] = response.inAppMessage;
        if (!actions || !actions.length) return Alert.alert(title, subTitle);
        const actionsWithNavigation = actions
          .map((action: { text: string; link: string; onPress: () => void }) => {
            if (action.text === "Installer") {
              API.updateLink = action.link as unknown as string;
              action.onPress = () => {
                API.downloadAndInstallUpdate(action.link);
              };
            } else if (action.link) {
              action.onPress = () => {
                Linking.openURL(action.link);
              };
            }
            return action;
          })
          .filter(Boolean);
        Alert.alert(title, subTitle, actionsWithNavigation, options);
        return;
      }
      // check token
      const storedToken = await AsyncStorage.getItem("persistent_token");
      if (!storedToken) return SplashScreen.hide();
      API.token = storedToken;
      const { token, ok, user } = await API.get({ path: "/user/signin-token" });
      if (ok && token && user) {
        setAuthViaCookie(true);
        API.onLogIn();
        const { organisation } = user;
        if (!!storageOrganisationId && organisation._id !== storageOrganisationId) {
          await clearCache("not same org");
          resetAllRecoilStates();
          setLastRefresh(0);
        }
        setStorageOrganisationId(organisation._id);
        setOrganisation(organisation);
        setUserName(user.name);
        if (!!organisation.encryptionEnabled && !["superadmin"].includes(user.role)) setShowEncryptionKeyInput(true);
      } else {
        await AsyncStorage.removeItem("persistent_token");
      }
      SplashScreen.hide();
      return setLoading(false);
    }, 500);

    return () => clearTimeout(initTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const toggleShowPassword = () => setShowPassword((show) => !show);

  const onResetCurrentUser = async () => {
    await AsyncStorage.removeItem("persistent_email");
    await AsyncStorage.removeItem("persistent_token");
    setEmail("");
    setPassword("");
    setAuthViaCookie(false);
    setUserName("");
    setShowEncryptionKeyInput(false);
    API.token = "";
  };

  const onForgetPassword = () => navigation.navigate("FORGET_PASSWORD");
  const onConnect = async () => {
    if (!authViaCookie) {
      if (!isValid) {
        Alert.alert("L'email n'est pas valide.", `Il doit être de la forme ${example}`);
        emailRef.current?.focus();
        return;
      }
      if (password === "") {
        Alert.alert("Mot de passe incorrect", "Le mot de passe ne peut pas être vide");
        passwordRef.current?.focus();
        return;
      }
    }
    setLoading(true);
    const userDebugInfos = await API.getUserDebugInfos();
    const response = authViaCookie
      ? await API.get({ path: "/user/signin-token" })
      : await API.post({ path: "/user/signin", body: { password, email, ...userDebugInfos } });
    if (response.error) {
      Alert.alert(response.error, undefined, [{ text: "OK", onPress: () => passwordRef.current?.focus() }], {
        cancelable: true,
        onDismiss: () => passwordRef.current?.focus(),
      });
      setLoading(false);
      setPassword("");
      return;
    }
    if (response?.user?.role === "superadmin") {
      Alert.alert("Vous n'avez pas d'organisation dans Mano");
      setLoading(false);
      return;
    }
    if (["stats-only"].includes(response?.user?.role)) {
      Alert.alert("Vous n'avez pas accès à l'application mobile Mano");
      setLoading(false);
      return;
    }
    if (response.ok) {
      Keyboard.dismiss();

      if (response.user.organisation.disabledAt) {
        setLoading(false);
        navigation.navigate("ORGANISATION_DESACTIVEE");
        return;
      }

      API.token = response.token;
      API.onLogIn();
      await AsyncStorage.setItem("persistent_token", response.token);
      API.showTokenExpiredError = true;
      API.organisation = response.user.organisation;
      setUser(response.user);

      setOrganisation(response.user.organisation);
      if (!!response.user.organisation?.encryptionEnabled && !showEncryptionKeyInput) {
        setLoading(false);
        setShowEncryptionKeyInput(true);
        return;
      }
      if (showEncryptionKeyInput) {
        const keyIsValid = await API.setOrgEncryptionKey(encryptionKey);
        if (!keyIsValid) {
          setLoading(false);
          return;
        }
      }
      await AsyncStorage.setItem("persistent_email", email);
      const { data: teams } = await API.get({ path: "/team" });
      const { data: users } = await API.get({ path: "/user", query: { minimal: true } });
      const { data: deletedUsers } = await API.get({ path: "/user/deleted-users" });
      setUser(response.user);
      setOrganisation(response.user.organisation);
      // We need to reset cache if organisation has changed.
      if (!!storageOrganisationId && response.user.organisation._id !== storageOrganisationId) {
        await clearCache("again not same org");
        resetAllRecoilStates();
        setLastRefresh(0);
      }
      setStorageOrganisationId(response.user.organisation._id);
      setUsers(users);
      setDeletedUsers(deletedUsers);
      setTeams(teams);
      // getting teams before going to team selection
      if (!__DEV__ && !response.user.lastChangePasswordAt) {
        navigation.navigate("FORCE_CHANGE_PASSWORD");
      } else {
        if (!response.user?.cgusAccepted) {
          navigation.navigate("CGUS_ACCEPTANCE");
        } else if (!response.user?.termsAccepted) {
          navigation.navigate("CHARTE_ACCEPTANCE");
        } else if (response.user?.teams?.length === 1) {
          setCurrentTeam(response.user.teams[0]);
          setRefreshTrigger({ status: true, options: { showFullScreen: true, initialLoad: true } });
          navigation.getParent()?.navigate("TABS_STACK");
        } else {
          navigation.navigate("TEAM_SELECTION");
        }
      }
    }
    setTimeout(() => {
      // reset state
      setEmail("");
      setIsValid(false);
      setExample("example@example.com");
      setPassword("");
      setEncryptionKey("");
      setShowPassword(false);
      setAuthViaCookie(false);
      setShowEncryptionKeyInput(false);
      setLoading(false);
    }, 500);
  };

  const scrollViewRef = useRef<ScrollView>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const encryptionKeyRef = useRef<TextInput>(null);

  return (
    <Background>
      <SceneContainer>
        <KeyboardAvoidingView behavior="padding" className="flex-1 bg-white">
          <ScrollContainer ref={scrollViewRef} testID="login-screen">
            <View>
              <StatusBar backgroundColor={colors.app.color} />
              <Title>{userName ? `Bienvenue ${userName}\u00A0 !` : "Bienvenue !"}</Title>
              <SubTitle>
                Veuillez saisir {authViaCookie ? "la clé de chiffrement définie par" : "un e-mail enregistré auprès de"} votre administrateur
              </SubTitle>
              {API.updateLink && (
                <ButtonsContainer>
                  <Button
                    caption="Mettre à jour Mano"
                    onPress={() => {
                      setDownloading(true);
                      setTimeout(() => setDownloading(false), 20_000);
                      API.downloadAndInstallUpdate(API.updateLink);
                    }}
                    loading={downloading}
                    disabled={downloading}
                    testID="button-connect"
                    backgroundColor={colors.app.color}
                    color={colors.app.colorWhite}
                  />
                </ButtonsContainer>
              )}
              {!authViaCookie && (
                <EmailInput
                  onChange={({ email, isValid, example }) => {
                    setEmail(email);
                    setIsValid(isValid);
                    setExample(example);
                  }}
                  ref={emailRef}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  testID="login-email"
                />
              )}
              {!authViaCookie && (
                <InputLabelled
                  ref={passwordRef}
                  onChangeText={setPassword}
                  label="Mot de passe"
                  placeholder="unSecret23!"
                  value={password}
                  autoComplete="password"
                  autoCapitalize="none"
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={onConnect}
                  EndIcon={() => <EyeIcon strikedThrough={showPassword} />}
                  onEndIconPress={toggleShowPassword}
                  testID="login-password"
                />
              )}
              {!!showEncryptionKeyInput && (
                <InputLabelled
                  ref={encryptionKeyRef}
                  onChangeText={setEncryptionKey}
                  label="Clé de chiffrement"
                  placeholder="unSecret23!"
                  value={encryptionKey}
                  autoCapitalize="none"
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={onConnect}
                  EndIcon={() => <EyeIcon strikedThrough={showPassword} />}
                  onEndIconPress={toggleShowPassword}
                  testID="login-encryption"
                />
              )}
              {authViaCookie ? (
                <TouchableWithoutFeedback onPress={onResetCurrentUser}>
                  <Hint>Se connecter avec un autre utilisateur</Hint>
                </TouchableWithoutFeedback>
              ) : (
                <TouchableWithoutFeedback onPress={onForgetPassword}>
                  <Hint>J'ai oublié mon mot de passe</Hint>
                </TouchableWithoutFeedback>
              )}
              <ButtonsContainer>
                <Button caption="Connecter" onPress={onConnect} loading={loading} disabled={loading} testID="button-connect" />
              </ButtonsContainer>
              <Version>Mano v{VERSION}</Version>
            </View>
          </ScrollContainer>
        </KeyboardAvoidingView>
      </SceneContainer>
    </Background>
  );
};

const Background = styled.View`
  flex: 1;
  background-color: #fff;
`;

const Hint = styled(MyText)`
  font-size: 13px;
  margin-top: 5%;
  margin-bottom: 10%;
  align-self: center;
  text-align: center;
  color: ${colors.app.color};
`;

const Version = styled(MyText)`
  font-size: 10px;
  margin-top: 10%;
  margin-bottom: 2%;
  align-self: center;
  text-align: center;
  /* color: #ddd; */
`;

export default Login;
