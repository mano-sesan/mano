import React from "react";
import { type ViewStyle, TouchableOpacity, View } from "react-native";

type RowContainerProps = {
  Component?: typeof TouchableOpacity;
  onPress: () => void;
  disabled?: boolean;
  noPadding?: boolean;
  children?: React.ReactNode;
  center?: boolean;
  testID?: string;
  styles?: { container?: ViewStyle; subContainer?: ViewStyle };
};

const RowContainer = ({
  Component = TouchableOpacity,
  onPress,
  disabled,
  noPadding,
  children,
  center,
  testID = "",
  styles: stylesProps = {},
}: RowContainerProps) => {
  return (
    <Component onPress={onPress} disabled={disabled} testID={testID}>
      <View className="overflow-hidden rounded-2xl bg-[#f4f5f8] mx-2.5 mb-2.5" style={stylesProps?.container}>
        <View
          className={["py-5 px-3 items-center flex-row w-full", noPadding && "p-0", center && "justify-center"].join(" ")}
          style={stylesProps?.subContainer}
        >
          {children}
        </View>
      </View>
    </Component>
  );
};

export default RowContainer;
