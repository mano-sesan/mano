import styled from "styled-components/native";

type MyTextProps = {
  bold?: boolean;
  heavy?: boolean;
  color?: string;
};

const MyText = styled.Text.attrs({ selectable: true })<MyTextProps>`
  font-family: NexaRegular;
  ${(props) => props.bold && "font-family: Nexa-Bold;"}
  ${(props) => props.heavy && "font-family: NexaHeavy;"}
  color: #000000;
  ${(props) => props.color && `color: ${props.color};`}
`;

type MyTextInputProps = {
  placeholderTextColor?: string;
};

const MyTextInput = styled.TextInput.attrs({ placeholderTextColor: "#ccc" })<MyTextInputProps>`
  font-family: NexaRegular;
  color: #000000;
`;

export { MyText, MyTextInput };
