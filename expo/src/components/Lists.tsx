import { AnimatedFlashList, type FlashListProps } from "@shopify/flash-list";
import React from "react";
import { type SectionListProps, Animated, ViewStyle } from "react-native";

type SectionListStyledProps<ItemT> = Omit<SectionListProps<ItemT>, "style"> & {
  parentScroll?: Animated.Value | undefined;
};

export const SectionListStyled = <ItemT,>({ parentScroll, ...props }: SectionListStyledProps<ItemT>) => (
  <Animated.SectionList<ItemT>
    {...(props as any)}
    scrollEventThrottle={16}
    contentContainerStyle={styles.contentContainerStyle}
    style={styles.content(parentScroll)}
  />
);

type FlashListStyledProps<ItemT> = Omit<FlashListProps<ItemT>, "style"> & {
  withHeaderSearch?: boolean;
};

export const FlashListStyled = <ItemT,>({ withHeaderSearch = false, ...props }: FlashListStyledProps<ItemT>) => (
  <AnimatedFlashList contentContainerStyle={styles.flashListContentContainerStyle(withHeaderSearch)} {...(props as any)} />
);

type Styles = {
  content: (parentScroll: Animated.Value | undefined) => ViewStyle;
  contentContainerStyle: ViewStyle;
  flashListContentContainerStyle: (withHeaderSearch: boolean) => ViewStyle;
};

const styles: Styles = {
  content: (parentScroll) => ({
    transform: [
      {
        translateY: parentScroll?.interpolate
          ? parentScroll.interpolate({
              inputRange: [0, 100],
              outputRange: [90, 0],
              extrapolate: "clamp",
            })
          : 0,
      },
    ],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: "#fff",
  }),
  contentContainerStyle: {
    flexGrow: 1,
    paddingTop: 30,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: "#fff",
  },
  flashListContentContainerStyle: (withHeaderSearch) => ({
    paddingTop: 30 + (withHeaderSearch ? 60 : 0),
    backgroundColor: "#fff",
  }),
};
