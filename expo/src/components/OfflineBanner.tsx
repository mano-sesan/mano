import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useAtomValue } from "jotai";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MyText } from "./MyText";
import { isOnlineState } from "@/services/network";
import { offlineQueueCountState } from "@/services/offlineQueue";
import { syncStatusState, conflictsState } from "@/services/syncProcessor";
import { processQueue } from "@/services/syncProcessor";
import colors from "@/utils/colors";
import { RootStackParamList } from "@/types/navigation";

const OfflineBanner = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isOnline = useAtomValue(isOnlineState);
  const queueCount = useAtomValue(offlineQueueCountState);
  const syncStatus = useAtomValue(syncStatusState);
  const conflicts = useAtomValue(conflictsState);

  if (isOnline && queueCount === 0 && conflicts.length === 0) return null;

  const getBannerStyle = () => {
    if (!isOnline) return styles.offline;
    if (syncStatus === "syncing") return styles.syncing;
    if (conflicts.length > 0) return styles.conflict;
    if (queueCount > 0) return styles.pending;
    return styles.offline;
  };

  const getMessage = () => {
    if (!isOnline && queueCount > 0) {
      return `Mode hors ligne \u2014 ${queueCount} modification${queueCount > 1 ? "s" : ""} en attente`;
    }
    if (!isOnline) {
      return "Mode hors ligne";
    }
    if (syncStatus === "syncing") {
      return "Synchronisation en cours\u2026";
    }
    if (conflicts.length > 0) {
      return `${conflicts.length} conflit${conflicts.length > 1 ? "s" : ""} \u00e0 r\u00e9soudre`;
    }
    if (queueCount > 0) {
      return `${queueCount} modification${queueCount > 1 ? "s" : ""} en attente`;
    }
    return "";
  };

  const handlePress = () => {
    if (conflicts.length > 0) {
      navigation.navigate("CONFLICT_RESOLUTION");
      return;
    }
    if (isOnline && queueCount > 0) {
      processQueue().catch(() => {});
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <View style={[styles.container, getBannerStyle()]}>
        <MyText bold color="#fff" style={styles.text}>
          {getMessage()}
        </MyText>
        {conflicts.length > 0 && (
          <MyText color="#fff" style={styles.syncButton}>
            Résoudre
          </MyText>
        )}
        {isOnline && queueCount > 0 && conflicts.length === 0 && syncStatus !== "syncing" && (
          <MyText color="#fff" style={styles.syncButton}>
            Synchroniser
          </MyText>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default OfflineBanner;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 13,
    textAlign: "center",
  },
  syncButton: {
    fontSize: 13,
    marginLeft: 8,
    textDecorationLine: "underline",
  },
  offline: {
    backgroundColor: "#6B7280",
  },
  syncing: {
    backgroundColor: colors.app.color,
  },
  conflict: {
    backgroundColor: colors.warning.color,
  },
  pending: {
    backgroundColor: colors.app.colorDark,
  },
});
