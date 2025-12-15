import React from "react";
import { TouchableWithoutFeedback } from "react-native";
import styled from "styled-components/native";
import { Plus } from "../icons";
import colors from "../utils/colors";

type FloatAddButtonProps = {
  onPress: () => void;
  color?: string;
  testID?: string;
};

const FloatAddButton = ({ onPress, color = colors.app.secondary, testID }: FloatAddButtonProps) => {
  return (
    <TouchableWithoutFeedback onPress={onPress} testID={testID}>
      <Button color={color}>
        <Plus size={20} color="white" />
      </Button>
    </TouchableWithoutFeedback>
  );
};

const size = 60;
const Button = styled.View<{ color: string }>`
  position: absolute;
  bottom: 15px;
  right: 25px;
  z-index: 1000;
  height: ${size}px;
  width: ${size}px;
  border-radius: ${size}px;
  background-color: ${(props) => props.color};
  justify-content: center;
  align-items: center;
`;

export default FloatAddButton;
