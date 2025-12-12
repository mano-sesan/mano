import React from "react";
import styled from "styled-components/native";
import { TextInput, type TextInputProps, TouchableWithoutFeedback } from "react-native";
import Label from "./Label";
import InputMultilineAutoAdjust from "./InputMultilineAutoAdjust";
import { MyText, MyTextInput } from "./MyText";
import colors from "../utils/colors";
import Spacer from "./Spacer";

interface InputLabelledProps extends TextInputProps {
  error?: string;
  label?: string;
  multiline?: boolean;
  editable?: boolean;
  onClear?: () => void;
  noMargin?: boolean;
  EndIcon?: React.FC<{ size: number; color: string }>;
  children?: React.ReactNode;
  onEndIconPress?: () => void;
  ref?: React.RefObject<TextInput | null>;
}

const InputLabelled = ({
  error = "",
  label = "",
  multiline = false,
  editable = true,
  onClear = () => {},
  noMargin = false,
  EndIcon = () => <></>,
  children = null,
  onEndIconPress = () => {},
  ref,
  ...props
}: InputLabelledProps) => {
  if (!editable) {
    const value = String(props.value || "")
      .split("\\n")
      .join("\u000A");
    return (
      <FieldContainer noMargin={noMargin}>
        {!!label && <InlineLabel>{`${label} : `}</InlineLabel>}
        <Row>
          <Content ref={ref}>{value}</Content>
          <Spacer grow />
        </Row>
      </FieldContainer>
    );
  }
  return (
    <InputContainer>
      {label && <Label label={label} />}
      {multiline ? (
        <InputMultilineAutoAdjust ref={ref} {...props} />
      ) : (
        <Input autoComplete="off" ref={ref} {...props} value={String(props.value || "")} />
      )}
      {Boolean(EndIcon) && Boolean(props?.value?.length) && (
        <TouchableWithoutFeedback onPress={onEndIconPress}>
          <IconWrapper>
            <EndIcon size={20} color={colors.app.color} />
          </IconWrapper>
        </TouchableWithoutFeedback>
      )}
      {children}
      {/* {Boolean(onClear) && Boolean(props?.value?.length) && <ButtonReset onPress={onClear} />} */}
      {!!error && <Error>{error}</Error>}
    </InputContainer>
  );
};

const FieldContainer = styled.View<{ noMargin: boolean }>`
  flex-grow: 1;
  margin-bottom: ${(props) => (props.noMargin ? 0 : 25)}px;
`;

const InputContainer = styled.View`
  margin-bottom: 30px;
  flex-grow: 1;
`;

const Error = styled(MyText)`
  margin-left: 5px;
  font-size: 14px;
  color: red;
  height: 18px;
`;

const InlineLabel = styled(MyText)`
  font-size: 15px;
  color: ${colors.app.color};
  margin-bottom: 15px;
`;

const Content = styled(MyText)`
  font-size: 17px;
  line-height: 20px;
`;

const Input = styled(MyTextInput)`
  border: 1px solid rgba(30, 36, 55, 0.1);
  border-radius: 12px;
  padding-horizontal: 12px;
  padding-vertical: 15px;
`;

const IconWrapper = styled.View`
  position: absolute;
  right: 12px;
  top: 0;
  bottom: 0;
  justify-content: center;
  padding-top: 22px;
`;

const Row = styled.View`
  flex-direction: row;
  align-items: center;
`;

export default InputLabelled;
