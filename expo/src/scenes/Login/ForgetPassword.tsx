import React, { useRef, useState } from "react";
import styled from "styled-components/native";
import { Alert, KeyboardAvoidingView, ScrollView, View, TextInput } from "react-native";
import API from "../../services/api";
import SceneContainer from "../../components/SceneContainer";
import ScrollContainer from "../../components/ScrollContainer";
import ButtonsContainer from "../../components/ButtonsContainer";
import Button from "../../components/Button";
import EmailInput from "../../services/EmailInput";
import Title, { SubTitle } from "../../components/Title";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LoginStackParamsList } from "@/types/navigation";

type ForgetPasswordProps = NativeStackScreenProps<LoginStackParamsList, "FORGET_PASSWORD">;

const ForgetPassword = ({ navigation }: ForgetPasswordProps) => {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const emailRef = useRef<TextInput | null>(null);
  const [email, setEmail] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [example, setExample] = useState("example@example.com");
  const [loading, setLoading] = useState(false);

  const onSendLink = async () => {
    if (!isValid) {
      Alert.alert("L'email n'est pas valide.", `Il doit être de la forme ${example}`);
      emailRef.current?.focus();
      return;
    }
    setLoading(true);
    const response = await API.post({ path: "/user/forgot_password", body: { email } });
    if (response.error) {
      Alert.alert(response.error);
      setLoading(false);
      return;
    }
    if (response.ok) {
      Alert.alert("Email envoyé !", "Un lien vous redirigera vers l'interface administrateur", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]);
      setLoading(false);
    }
  };

  return (
    <Background>
      <SceneContainer>
        <KeyboardAvoidingView behavior="padding" className="flex-1 bg-white">
          <ScrollContainer ref={scrollViewRef}>
            <View>
              <Title>Mot de passe oublié</Title>
              <SubTitle>
                Veuillez saisir un e-mail enregistré auprès de votre administrateur, nous vous enverrons un lien pour récupérer votre mot de passe
                dans l'interface administrateur
              </SubTitle>
              <EmailInput
                onChange={({ email, isValid, example }) => {
                  setEmail(email);
                  setIsValid(isValid);
                  setExample(example);
                }}
                ref={emailRef}
                onSubmitEditing={onSendLink}
              />
              <ButtonsContainer>
                <Button caption="Envoyer un lien" onPress={onSendLink} loading={loading} disabled={loading} />
              </ButtonsContainer>
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

export default ForgetPassword;
