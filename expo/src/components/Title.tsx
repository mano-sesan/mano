import React from "react";
import styled from "styled-components/native";
import { MyText } from "./MyText";

type TitleProps = {
  children: React.ReactNode;
  left?: boolean;
};

const Title = ({ children, left = false }: TitleProps) => <TitleStyled left={left}>{children}</TitleStyled>;

const TitleStyled = styled(MyText)<TitleProps>`
  padding-horizontal: 30px;
  padding-vertical: 15px;
  font-weight: bold;
  font-size: 30px;
  margin-top: 30%;
  align-self: ${(props) => (props.left ? "flex-start" : "center")};
`;

type SubTitleProps = {
  children: React.ReactNode;
};
export const SubTitle = styled(MyText)<SubTitleProps>`
  font-size: 13px;
  margin-top: 2%;
  margin-bottom: 15%;
  align-self: center;
  text-align: center;
  opacity: 0.75;
`;

export default Title;
