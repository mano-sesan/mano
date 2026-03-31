import React, { useState } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import { useAtomValue } from "jotai";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import ScrollContainer from "../../components/ScrollContainer";
import Button from "../../components/Button";
import { MyText } from "../../components/MyText";
import colors from "../../utils/colors";
import { conflictsState, resolveConflict, discardConflict, type Conflict } from "../../services/syncProcessor";
import { RootStackParamList } from "@/types/navigation";

const ENTITY_LABELS: Record<string, string> = {
  person: "Personne",
  action: "Action",
  comment: "Commentaire",
  consultation: "Consultation",
  treatment: "Traitement",
  passage: "Passage",
  rencontre: "Rencontre",
  "territory-observation": "Observation",
  place: "Lieu",
  relPersonPlace: "Lieu fréquenté",
  group: "Famille",
  report: "Compte rendu",
};

type Props = NativeStackScreenProps<RootStackParamList, "CONFLICT_RESOLUTION">;

export default function ConflictResolution({ navigation }: Props) {
  const conflicts = useAtomValue(conflictsState);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (conflicts.length === 0) {
    return (
      <SceneContainer>
        <ScreenTitle title="Conflits" onBack={() => navigation.goBack()} />
        <ScrollContainer>
          <View className="flex-1 items-center justify-center p-10">
            <MyText>Aucun conflit à résoudre.</MyText>
          </View>
        </ScrollContainer>
      </SceneContainer>
    );
  }

  return (
    <SceneContainer>
      <ScreenTitle title={`${conflicts.length} conflit${conflicts.length > 1 ? "s" : ""}`} onBack={() => navigation.goBack()} />
      <ScrollContainer>
        {conflicts.map((conflict) => (
          <ConflictCard
            key={conflict.queueItemId}
            conflict={conflict}
            expanded={expandedId === conflict.queueItemId}
            onToggle={() => setExpandedId(expandedId === conflict.queueItemId ? null : conflict.queueItemId)}
            onResolveLocal={async () => {
              await resolveConflict(conflict.queueItemId, conflict.localVersion);
              if (conflicts.length <= 1) navigation.goBack();
            }}
            onResolveServer={() => {
              discardConflict(conflict.queueItemId);
              if (conflicts.length <= 1) navigation.goBack();
            }}
            onDismiss={() => {
              discardConflict(conflict.queueItemId);
              if (conflicts.length <= 1) navigation.goBack();
            }}
          />
        ))}
      </ScrollContainer>
    </SceneContainer>
  );
}

type ConflictCardProps = {
  conflict: Conflict;
  expanded: boolean;
  onToggle: () => void;
  onResolveLocal: () => void;
  onResolveServer: () => void;
  onDismiss: () => void;
};

function ConflictCard({ conflict, expanded, onToggle, onResolveLocal, onResolveServer, onDismiss }: ConflictCardProps) {
  const entityLabel = ENTITY_LABELS[conflict.entityType] || conflict.entityType;
  const entityName =
    conflict.localVersion?.name || conflict.serverVersion?.name || conflict.localVersion?.decrypted?.name || conflict.entityId.slice(0, 8);

  const handleKeepLocal = () => {
    Alert.alert("Garder ma version", "La version du serveur sera écrasée par vos modifications hors ligne.", [
      { text: "Annuler", style: "cancel" },
      { text: "Confirmer", onPress: onResolveLocal },
    ]);
  };

  const handleKeepServer = () => {
    Alert.alert("Garder la version serveur", "Vos modifications hors ligne seront perdues.", [
      { text: "Annuler", style: "cancel" },
      { text: "Confirmer", style: "destructive", onPress: onResolveServer },
    ]);
  };

  return (
    <View className="bg-white rounded-[10px] mb-4 border-l-4 border-l-orangeDark shadow-sm elevation-2">
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
        <View className="flex-row items-center p-4">
          <View className="flex-1">
            <MyText bold className="text-xs text-orangeDark uppercase">
              {entityLabel}
            </MyText>
            <MyText bold className="text-[17px] mt-0.5">
              {entityName}
            </MyText>
            <MyText className="text-[13px] text-[#8C9294] mt-1">
              {conflict.changedFields.length} champ{conflict.changedFields.length > 1 ? "s" : ""} modifié
              {conflict.changedFields.length > 1 ? "s" : ""}
            </MyText>
          </View>
          <MyText className="text-sm text-[#8C9294] ml-2">{expanded ? "\u25B2" : "\u25BC"}</MyText>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} hitSlop={12} className="absolute top-2 right-2 p-1">
        <MyText className="text-lg text-[#8C9294]">{"\u2715"}</MyText>
      </TouchableOpacity>

      {expanded && (
        <View className="px-4 pb-4">
          {conflict.changedFields.map((field) => {
            if (field === "updatedAt") return null;
            if (field === "createdAt") return null;
            if (field === "entityKey") return null;
            if (field === "entityUpdatedAt") return null;
            if (field === "history") return null;
            if (field === "assignedTeams") return null;

            const localVal = conflict.localVersion?.decrypted?.[field] ?? conflict.localVersion?.[field];
            const serverVal = conflict.serverVersion?.[field];
            return (
              <View key={field} className="mb-3">
                <MyText bold className="text-sm mb-1.5 text-[#0d5b54]">
                  {field}
                </MyText>
                <View className="flex-row">
                  <View className="flex-1">
                    <MyText bold className="text-[11px] text-[#8C9294] mb-1 uppercase">
                      Ma version
                    </MyText>
                    <MyText className="text-sm p-2 bg-[#f5f5f5] rounded-[6px] min-h-[36px]">{formatValue(localVal)}</MyText>
                  </View>
                  <View className="w-2" />
                  <View className="flex-1">
                    <MyText bold className="text-[11px] text-[#8C9294] mb-1 uppercase">
                      Serveur
                    </MyText>
                    <MyText className="text-sm p-2 bg-[#f5f5f5] rounded-[6px] min-h-[36px]">{formatValue(serverVal)}</MyText>
                  </View>
                </View>
              </View>
            );
          })}

          <View className="flex-row mt-4">
            <View className="flex-1 mr-1.5">
              <Button caption="Garder ma version" onPress={handleKeepLocal} backgroundColor={colors.app.color} color="#fff" />
            </View>
            <View className="flex-1 ml-1.5">
              <Button caption="Garder l'autre version" onPress={handleKeepServer} backgroundColor={colors.app.colorGrey} color="#fff" />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "(vide)";
  if (typeof val === "boolean") return val ? "Oui" : "Non";
  if (Array.isArray(val)) return val.join(", ") || "(vide)";
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}
