import React from "react";
import { ScrollView, type ScrollViewProps } from "react-native";
import styled from "styled-components/native";
import colors from "../utils/colors";

interface ScrollContainerProps extends ScrollViewProps {
  ref?: React.RefObject<ScrollView | null>;
  debug?: boolean;
  noPadding?: boolean;
  testID?: string;
  noRadius?: boolean;
  backgroundColor?: string;
  flexGrow?: number;
}

const ScrollContainer = (props: ScrollContainerProps) => <Container keyboardShouldPersistTaps="handled" {...props} />;

const Container = styled.ScrollView.attrs<ScrollContainerProps>(({ debug, noPadding, testID, contentContainerStyle = {}, noRadius = false }) => ({
  contentContainerStyle: {
    borderWidth: debug ? 2 : 0,
    borderColor: "red",
    padding: noPadding ? 0 : 30,
    backgroundColor: "#fff",
    borderTopLeftRadius: noRadius ? 0 : 16,
    borderTopRightRadius: noRadius ? 0 : 16,
    flexGrow: 1,
    // @ts-expect-error Spread types may only be created from object types.ts(2698)
    ...contentContainerStyle,
  },
  testID,
}))`
  flex: 1;
  background-color: ${(props) => props.backgroundColor || colors.app.color};
  ${(props) => props.debug && "border: 3px solid #000;"}
  ${(props) => props.flexGrow && `flex-grow: ${props.flexGrow};`}
`;

export default ScrollContainer;
