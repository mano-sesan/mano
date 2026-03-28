import React from "react";
import { StyleSheet, View } from "react-native";
import { MyText } from "./MyText";

type Props = {
  pendingSync?: boolean;
};

const PendingSyncIndicator = ({ pendingSync }: Props) => {
  if (!pendingSync) return null;

  return (
    <View style={styles.container}>
      <MyText style={styles.icon}>{"\u23f3"}</MyText>
    </View>
  );
};

export default PendingSyncIndicator;

const styles = StyleSheet.create({
  container: {
    marginLeft: 4,
  },
  icon: {
    fontSize: 12,
  },
});
