import React from "react";
import { TouchableOpacity, View } from "react-native";
import { useAtomValue } from "jotai";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MyText } from "./MyText";
import { offlineModeState } from "@/services/network";
import { offlineQueueCountState } from "@/services/offlineQueue";
import { processQueue, syncStatusState, conflictsState } from "@/services/syncProcessor";
import { RootStackParamList } from "@/types/navigation";

const OfflineBanner = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const offlineMode = useAtomValue(offlineModeState);
  const queueCount = useAtomValue(offlineQueueCountState);
  const syncStatus = useAtomValue(syncStatusState);
  const conflicts = useAtomValue(conflictsState);

  if (!offlineMode && queueCount === 0 && conflicts.length === 0) return null;

  const getMessage = () => {
    if (offlineMode && queueCount > 0) {
      return `Mode hors ligne \u2014 ${queueCount} modification${queueCount > 1 ? "s" : ""} en attente`;
    }
    if (offlineMode) {
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
    if (!offlineMode && queueCount > 0) {
      processQueue().catch(() => {});
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <View
        className={[
          "py-2 px-4 flex-row items-center justify-center",
          offlineMode && "bg-[#6B7280]",
          !offlineMode && syncStatus === "syncing" && "bg-main",
          !offlineMode && conflicts.length > 0 && "bg-orangeDark",
          !offlineMode && queueCount > 0 && conflicts.length === 0 && syncStatus !== "syncing" && "bg-[#0d5b54]",
        ].join(" ")}
      >
        <MyText bold color="#fff" className="text-[13px] text-center">
          {getMessage()}
        </MyText>
        {conflicts.length > 0 && (
          <MyText color="#fff" className="text-[13px] ml-2 underline">
            Résoudre
          </MyText>
        )}
        {!offlineMode && queueCount > 0 && conflicts.length === 0 && syncStatus !== "syncing" && (
          <MyText color="#fff" className="text-[13px] ml-2 underline">
            Synchroniser
          </MyText>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default OfflineBanner;
