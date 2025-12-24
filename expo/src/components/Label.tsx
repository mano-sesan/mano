import React from "react";
import styled from "styled-components/native";
import { MyText } from "./MyText";

type LabelProps = {
  label: string;
  big?: boolean;
};
const Label = ({ label, big = false }: LabelProps) => <LabelStyled big={big}>{label}</LabelStyled>;

const LabelStyled = styled(MyText)<{ big: boolean }>`
  margin-bottom: 10px;
  font-weight: bold;
  ${(props) => props.big && "font-size: 17px;"}
`;

export default Label;
