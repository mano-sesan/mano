import React from "react";
import styled from "styled-components/native";
import colors from "../utils/colors";

type SceneContainerProps = {
  children: React.ReactNode;
  debug?: boolean;
  backgroundColor?: string;
  testID?: string;
};

const SceneContainer = ({ children, debug, backgroundColor = colors.app.color, testID = "" }: SceneContainerProps) => (
  <Container testID={testID} backgroundColor={backgroundColor} debug={debug}>
    {children}
  </Container>
);

const Container = styled.View<SceneContainerProps>`
  flex: 1;
  background-color: ${(props) => props.backgroundColor || colors.app.color};
  ${(props) => props.debug && "border: 3px solid #000;"}
`;

export default SceneContainer;
