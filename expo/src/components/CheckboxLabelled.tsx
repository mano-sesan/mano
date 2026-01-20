import React from "react";
import styled, { css } from "styled-components/native";
import colors from "../utils/colors";
import { MyText } from "./MyText";
import { TouchableWithoutFeedback } from "react-native";

type CheckboxLabelledProps = {
  _id: string;
  label: string;
  onPress: (value: { _id: string; value: boolean; label: string }) => void;
  value: boolean;
  bold?: boolean;
  alone?: boolean;
};

const CheckboxLabelled = ({ _id, label, onPress, value, bold, alone = false }: CheckboxLabelledProps) => (
  <TouchableWithoutFeedback onPress={() => onPress({ _id, value: !value, label })}>
    <Container alone={alone}>
      <CheckBoxContainer bold={bold}>
        <CheckBox isSelected={Boolean(value)} />
      </CheckBoxContainer>
      {label && <LabelStyled bold={bold}>{label}</LabelStyled>}
    </Container>
  </TouchableWithoutFeedback>
);

const Container = styled.View<{ alone?: boolean }>`
  flex-direction: row;
  align-items: center;
  margin-bottom: ${(props) => (props.alone ? 25 : 0)}px;
  padding-vertical: ${(props) => (props.alone ? 0 : 10)}px;
  padding-horizontal: ${(props) => (props.alone ? 0 : 12)}px;
`;

const selectedCss = css`
  background-color: ${colors.app.color};
`;
const CheckBox = styled.View<{ isSelected?: boolean }>`
  border-radius: 3px;
  flex-grow: 1;
  ${(props) => props.isSelected && selectedCss}
`;
const CheckBoxContainer = styled.View<{ bold?: boolean }>`
  margin-right: 10px;
  height: 20px;
  width: 20px;
  border-radius: 3px;
  border: ${(props) => (props.bold ? 2 : 1)}px solid ${colors.app.color};
  padding: 2px;
`;

const LabelStyled = styled(MyText)`
  ${(props) => props.bold && "font-weight: bold;"}
  ${(props) => props.bold && "font-size: 18px;"}
  ${(props) => props.bold && "margin-left: 15px;"}
  line-height: 22px;
  text-align-vertical: center;
`;

export default CheckboxLabelled;
