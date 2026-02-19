import React, { useState } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import styled from "styled-components/native";
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
          <EmptyContainer>
            <MyText>Aucun conflit à résoudre.</MyText>
          </EmptyContainer>
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
            onResolveLocal={() => {
              resolveConflict(conflict.queueItemId, conflict.localVersion);
              if (conflicts.length <= 1) navigation.goBack();
            }}
            onResolveServer={() => {
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
};

function ConflictCard({ conflict, expanded, onToggle, onResolveLocal, onResolveServer }: ConflictCardProps) {
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
    <CardContainer>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
        <CardHeader>
          <View style={{ flex: 1 }}>
            <EntityType>{entityLabel}</EntityType>
            <EntityName>{entityName}</EntityName>
            <FieldCount>
              {conflict.changedFields.length} champ{conflict.changedFields.length > 1 ? "s" : ""} modifié
              {conflict.changedFields.length > 1 ? "s" : ""}
            </FieldCount>
          </View>
          <ChevronText>{expanded ? "\u25B2" : "\u25BC"}</ChevronText>
        </CardHeader>
      </TouchableOpacity>

      {expanded && (
        <CardBody>
          {conflict.changedFields.map((field) => {
            const localVal = conflict.localVersion?.decrypted?.[field] ?? conflict.localVersion?.[field];
            const serverVal = conflict.serverVersion?.[field];
            return (
              <FieldDiff key={field}>
                <FieldLabel>{field}</FieldLabel>
                <DiffRow>
                  <DiffColumn>
                    <DiffColumnHeader>Ma version</DiffColumnHeader>
                    <DiffValue>{formatValue(localVal)}</DiffValue>
                  </DiffColumn>
                  <DiffSeparator />
                  <DiffColumn>
                    <DiffColumnHeader>Serveur</DiffColumnHeader>
                    <DiffValue>{formatValue(serverVal)}</DiffValue>
                  </DiffColumn>
                </DiffRow>
              </FieldDiff>
            );
          })}

          <ButtonsRow>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Button caption="Garder ma version" onPress={handleKeepLocal} backgroundColor={colors.app.color} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Button caption="Garder serveur" onPress={handleKeepServer} backgroundColor={colors.app.colorGrey} color="#fff" />
            </View>
          </ButtonsRow>
        </CardBody>
      )}
    </CardContainer>
  );
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "(vide)";
  if (typeof val === "boolean") return val ? "Oui" : "Non";
  if (Array.isArray(val)) return val.join(", ") || "(vide)";
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

const EmptyContainer = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px;
`;

const CardContainer = styled.View`
  background-color: #fff;
  border-radius: 10px;
  margin-bottom: 16px;
  border-left-width: 4px;
  border-left-color: ${colors.warning.color};
  shadow-color: #000;
  shadow-offset: 0px 1px;
  shadow-opacity: 0.1;
  shadow-radius: 3px;
  elevation: 2;
`;

const CardHeader = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 16px;
`;

const EntityType = styled(MyText)`
  font-size: 12px;
  color: ${colors.warning.color};
  font-weight: bold;
  text-transform: uppercase;
`;

const EntityName = styled(MyText)`
  font-size: 17px;
  font-weight: bold;
  margin-top: 2px;
`;

const FieldCount = styled(MyText)`
  font-size: 13px;
  color: ${colors.app.colorGrey};
  margin-top: 4px;
`;

const ChevronText = styled(MyText)`
  font-size: 14px;
  color: ${colors.app.colorGrey};
  margin-left: 8px;
`;

const CardBody = styled.View`
  padding: 0 16px 16px;
`;

const FieldDiff = styled.View`
  margin-bottom: 12px;
`;

const FieldLabel = styled(MyText)`
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 6px;
  color: ${colors.app.colorDark};
`;

const DiffRow = styled.View`
  flex-direction: row;
`;

const DiffColumn = styled.View`
  flex: 1;
`;

const DiffColumnHeader = styled(MyText)`
  font-size: 11px;
  font-weight: bold;
  color: ${colors.app.colorGrey};
  margin-bottom: 4px;
  text-transform: uppercase;
`;

const DiffValue = styled(MyText)`
  font-size: 14px;
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 6px;
  min-height: 36px;
`;

const DiffSeparator = styled.View`
  width: 8px;
`;

const ButtonsRow = styled.View`
  flex-direction: row;
  margin-top: 16px;
`;
