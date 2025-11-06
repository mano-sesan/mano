import React from 'react';
import styled from 'styled-components/native';
import colors from '../utils/colors';

const SceneContainer = ({ children, debug, backgroundColor = colors.app.color, testID = '' }) => (
  <Container testID={testID} backgroundColor={backgroundColor} debug={debug}>
    {children}
  </Container>
);

const Container = styled.View`
  flex: 1;
  background-color: ${(props) => props.backgroundColor};
  ${(props) => props.debug && 'border: 3px solid #000;'}
`;

export default SceneContainer;
