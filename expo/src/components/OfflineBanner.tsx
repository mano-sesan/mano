import React from "react";
import { TouchableOpacity, View } from "react-native";
import { useAtomValue } from "jotai";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MyText } from "./MyText";
import { isOnlineState } from "@/services/network";
import { offlineQueueCountState } from "@/services/offlineQueue";
import { syncStatusState, conflictsState } from "@/services/syncProcessor";
import { processQueue } from "@/services/syncProcessor";
import { RootStackParamList } from "@/types/navigation";

const OfflineBanner = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isOnline = useAtomValue(isOnlineState);
  const queueCount = useAtomValue(offlineQueueCountState);
  const syncStatus = useAtomValue(syncStatusState);
  const conflicts = useAtomValue(conflictsState);

  if (isOnline && queueCount === 0 && conflicts.length === 0) return null;

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
      <View
        className={[
          "py-2 px-4 flex-row items-center justify-center",
          !isOnline && "bg-[#6B7280]",
          isOnline && syncStatus === "syncing" && "bg-main",
          isOnline && conflicts.length > 0 && "bg-orangeDark",
          isOnline && queueCount > 0 && conflicts.length === 0 && syncStatus !== "syncing" && "bg-[#0d5b54]",
        ].join(" ")}>
        <MyText bold color="#fff" className="text-[13px] text-center">
          {getMessage()}
        </MyText>
        {conflicts.length > 0 && (
          <MyText color="#fff" className="text-[13px] ml-2 underline">
            Résoudre
          </MyText>
        )}
        {isOnline && queueCount > 0 && conflicts.length === 0 && syncStatus !== "syncing" && (
          <MyText color="#fff" className="text-[13px] ml-2 underline">
            Synchroniser
          </MyText>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default OfflineBanner;
