import React from 'react';
import styled from 'styled-components/native';
import colors from '../utils/colors';

const ScrollContainer = React.forwardRef(({ children, ...props }, ref) => (
  <Container ref={ref} keyboardShouldPersistTaps="handled" {...props}>
    {children}
  </Container>
));

const Container = styled.ScrollView.attrs(({ debug, noPadding, testID, contentContainerStyle = {}, noRadius = false }) => ({
  contentContainerStyle: {
    borderWidth: debug ? 2 : 0,
    borderColor: 'red',
    padding: noPadding ? 0 : 30,
    backgroundColor: '#fff',
    borderTopLeftRadius: noRadius ? 0 : 16,
    borderTopRightRadius: noRadius ? 0 : 16,
    flexGrow: 1,
    ...contentContainerStyle,
  },
  testID,
}))`
  flex: 1;
  background-color: ${(props) => props.backgroundColor || colors.app.color};
  ${(props) => props.debug && 'border: 3px solid #000;'}
  ${(props) => props.flexGrow && `flex-grow: ${props.flexGrow};`}
`;

export default ScrollContainer;
