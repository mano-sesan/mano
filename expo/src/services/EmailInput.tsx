import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import InputLabelled from "../components/InputLabelled";
import { TextInput } from "react-native";

const emailValidatorRE = new RegExp(
  '^(([^<>()\\[\\]\\\\.,;:\\s@"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@"]+)*)|(".+"))' +
    "@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$"
);
const validateEmail = (email: string) => {
  return emailValidatorRE.test(String(email).toLowerCase());
};

export interface EmailInputProps {
  ref: React.RefObject<TextInput | null>;
  onChange: ({ email, isValid, example }: { email: string; isValid: boolean; example: string }) => void;
  onSubmitEditing: () => void;
  testID?: string;
}

const EmailInput = ({ ref, onChange, onSubmitEditing, testID = "email" }: EmailInputProps) => {
  const [email, setEmail] = useState("");
  const onInputChange = (email: string) => {
    email = email.trim();
    setEmail(email);
    onChange({
      email: email,
      isValid: validateEmail(email),
      example: "example@example.com",
    });
  };

  const isFocused = useIsFocused();

  useEffect(() => {
    (async () => {
      const storedEmail = await AsyncStorage.getItem("persistent_email");
      if (storedEmail) {
        setEmail(storedEmail);
        onInputChange(storedEmail);
      } else {
        setEmail("");
        onInputChange("");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  return (
    <InputLabelled
      label="Email"
      ref={ref}
      onChangeText={onInputChange}
      value={email}
      placeholder="example@example.com"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      keyboardType="email-address"
      textContentType="emailAddress"
      returnKeyType="next"
      onSubmitEditing={onSubmitEditing}
      testID={testID}
    />
  );
};

export default EmailInput;
