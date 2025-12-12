import React, { useRef, useState } from "react";
import styled from "styled-components/native";
import { Alert, KeyboardAvoidingView, ScrollView, TextInput, TouchableWithoutFeedback, View } from "react-native";
import API from "../../services/api";
import ScrollContainer from "../../components/ScrollContainer";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import ButtonsContainer from "../../components/ButtonsContainer";
import Button from "../../components/Button";
import { MyText } from "../../components/MyText";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";

import EyeIcon from "../../icons/EyeIcon";
import InputLabelled from "../../components/InputLabelled";

type Check = "IS_EMPTY" | "IS_TOO_SHORT_OR_TOO_LONG" | "NO_NUMBER" | "NO_LETTER" | "NO_UPPERCASE" | "NO_LOWERCASE" | "NO_SPECIAL";

const checks: Record<Check, (password: string) => boolean> = {
  IS_EMPTY: (password: string) => password === "",
  IS_TOO_SHORT_OR_TOO_LONG: (password: string) => password.length < 6 || password.length > 32,
  NO_NUMBER: (password: string) => !/\d/.test(password),
  NO_LETTER: (password: string) => !/[a-zA-Z]/g.test(password),
  NO_UPPERCASE: (password: string) => !/[A-Z]/g.test(password),
  NO_LOWERCASE: (password: string) => !/[a-z]/g.test(password),
  NO_SPECIAL: (password: string) => !/[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(password),
};

const checkErrorPassword = (password: string): keyof typeof checks | null => {
  for (let check of Object.keys(checks) as Check[]) {
    if (checks[check](password)) return check;
  }
  return null;
};

const codesToErrors: Record<Check, string> = {
  IS_EMPTY: "Le mot de passe ne peut pas être vide",
  IS_TOO_SHORT_OR_TOO_LONG: "Le mot de passe doit avoir entre 8 et 32 caractères",
  NO_NUMBER: "Le mot de passe doit avoir au moins un chiffre",
  NO_LETTER: "Le mot de passe doit avoir au moins une lettre",
  NO_UPPERCASE: "Le mot de passe doit avoir au moins une lettre majuscule",
  NO_LOWERCASE: "Le mot de passe doit avoir au moins une lettre minuscule",
  NO_SPECIAL: "Le mot de passe doit avoir au moins un caractère spécial",
};

const codesToHints: Record<Check, string> = {
  IS_EMPTY: "entre 8 et 32 caractères",
  IS_TOO_SHORT_OR_TOO_LONG: "entre 8 et 32 caractères",
  NO_NUMBER: "au moins un chiffre",
  NO_LETTER: "au moins une lettre",
  NO_UPPERCASE: "au moins une majuscule",
  NO_LOWERCASE: "au moins une minuscule",
  NO_SPECIAL: "au moins un caractère spécial",
};

type ChangePasswordBodyProps = {
  onOK: () => void;
  children: React.ReactNode;
};

const ChangePasswordBody = ({ onOK, children }: ChangePasswordBodyProps) => {
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [verifyPassword, setVerifyPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(!__DEV__);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const passwordRef = useRef<TextInput | null>(null);
  const newPasswordRef = useRef<TextInput | null>(null);
  const verifyPasswordRef = useRef<TextInput | null>(null);

  const onModify = async () => {
    if (password.trim() === "") {
      Alert.alert("Mot de passe incorrect", "Le mot de passe ne peut pas être vide");
      passwordRef.current?.focus();
      return;
    }
    let checkedError = checkErrorPassword(newPassword.trim());
    if (checkedError) {
      Alert.alert(codesToErrors[checkedError]);
      newPasswordRef.current?.focus();
      return;
    }
    if (verifyPassword.trim() === "") {
      Alert.alert("Veuillez rentrer à nouveau le mot de passe pour vérification");
      verifyPasswordRef.current?.focus();
      return;
    }
    if (password.trim() === newPassword.trim()) {
      Alert.alert("Le nouveau mot de passe doit être différent de l'ancien");
      newPasswordRef.current?.focus();
      return;
    }
    if (newPassword.trim() !== verifyPassword.trim()) {
      Alert.alert("Les nouveaux mots de passe sont différents", "Vous pouvez cliquer sur 'Montrer les mots de passe' pour voir les différences");
      verifyPasswordRef.current?.focus();
      return;
    }
    setLoading(true);
    const response = await API.post({
      path: "/user/reset_password",
      body: { newPassword: newPassword.trim(), verifyPassword: verifyPassword.trim(), password: password.trim() },
    });
    if (response.error) {
      Alert.alert(response.error);
      setLoading(false);
      return;
    }
    if (response.ok) {
      setLoading(false);
      Alert.alert("Mot de passe modifié !");
      onOK();
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-white">
      <ScrollContainer ref={scrollViewRef}>
        <View>
          {children}
          <InputLabelled
            ref={passwordRef}
            onChangeText={setPassword}
            label="Saisissez votre mot de passe"
            placeholder="Saisissez votre mot de passe"
            value={password}
            autoComplete="password"
            autoCapitalize="none"
            secureTextEntry={hidden}
            returnKeyType="done"
            onSubmitEditing={() => newPasswordRef.current?.focus()}
            EndIcon={() => <EyeIcon strikedThrough={!hidden} />}
            onEndIconPress={() => setHidden((h) => !h)}
          />
          <InputLabelled
            ref={newPasswordRef}
            onChangeText={setNewPassword}
            label="Saisissez un nouveau mot de passe"
            placeholder="Saisissez un nouveau mot de passe"
            value={newPassword}
            autoComplete="password"
            autoCapitalize="none"
            secureTextEntry={hidden}
            returnKeyType="done"
            onSubmitEditing={() => verifyPasswordRef.current?.focus()}
            EndIcon={() => <EyeIcon strikedThrough={!hidden} />}
            onEndIconPress={() => setHidden((h) => !h)}
          />
          <PasswordHintContainer>
            {(Object.keys(codesToHints) as Check[]).map((check, index, array) => {
              let caption = codesToHints[check];
              if (index === 0) caption = caption.charAt(0).toUpperCase() + caption.slice(1);
              if (index !== array.length - 1) caption = `${caption}, `;
              return (
                <PasswordHint key={caption} disabled={!checks[check](newPassword)}>
                  {caption}
                </PasswordHint>
              );
            })}
          </PasswordHintContainer>
          <InputLabelled
            ref={verifyPasswordRef}
            onChangeText={setVerifyPassword}
            label="Confirmez le nouveau mot de passe"
            placeholder="Confirmez le nouveau mot de passe"
            value={verifyPassword}
            autoComplete="password"
            autoCapitalize="none"
            secureTextEntry={hidden}
            returnKeyType="done"
            onSubmitEditing={onModify}
            EndIcon={() => <EyeIcon strikedThrough={!hidden} />}
            onEndIconPress={() => setHidden((h) => !h)}
          />
          <TouchableWithoutFeedback onPress={() => setHidden((h) => !h)}>
            <Hint>Montrer les mots de passe</Hint>
          </TouchableWithoutFeedback>
          <ButtonsContainer>
            <Button caption="Modifier" onPress={onModify} loading={loading} disabled={loading} />
          </ButtonsContainer>
        </View>
      </ScrollContainer>
    </KeyboardAvoidingView>
  );
};

type ChangePasswordProps = NativeStackScreenProps<RootStackParamList, "CHANGE_PASSWORD">;
const ChangePassword = ({ navigation }: ChangePasswordProps) => {
  return (
    <SceneContainer>
      <ScreenTitle title="Mot de passe" onBack={navigation.goBack} />
      <ChangePasswordBody onOK={navigation.goBack}>
        <SubTitle>Veuillez confirmer votre mot de passe et saisir un nouveau</SubTitle>
      </ChangePasswordBody>
    </SceneContainer>
  );
};

const SubTitle = styled(MyText)`
  font-size: 13px;
  margin-top: 15%;
  margin-bottom: 10%;
  align-self: center;
  text-align: center;
`;

const PasswordHintContainer = styled.View`
  flex-direction: row;
  margin-top: -20px;
  margin-bottom: 20px;
  width: 100%;
  flex-wrap: wrap;
`;
const PasswordHint = styled(MyText)`
  font-size: 11px;
  align-self: center;
  text-align: center;
  ${(props) => props.disabled && "opacity: 0.3;"}
`;

const Hint = styled(MyText)`
  font-size: 13px;
  margin-top: 15%;
  margin-bottom: 10%;
  align-self: center;
  text-align: center;
  text-decoration-line: underline;
`;

export { ChangePasswordBody };
export default ChangePassword;
