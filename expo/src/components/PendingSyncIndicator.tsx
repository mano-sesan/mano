import React from "react";
import { View } from "react-native";
import { MyText } from "./MyText";

type Props = {
  pendingSync?: boolean;
};

const PendingSyncIndicator = ({ pendingSync }: Props) => {
  if (!pendingSync) return null;

  return (
    <View className="ml-1">
      <MyText className="text-xs">{"\u23f3"}</MyText>
    </View>
  );
};

export default PendingSyncIndicator;
