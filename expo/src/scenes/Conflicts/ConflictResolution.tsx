import React, { useMemo, useState } from "react";
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
import { personFieldsIncludingCustomFieldsSelector } from "../../atoms/persons";
import { consultationsFieldsIncludingCustomFieldsSelector, flattenedCustomFieldsConsultationsSelector } from "../../atoms/consultations";
import { groupedCustomFieldsObsSelector } from "../../atoms/territoryObservations";
import { allowedActionFieldsInHistory } from "../../atoms/actions";
import { allowedTreatmentFieldsInHistory } from "../../atoms/treatments";
import { allowedCommentFieldsInHistory } from "../../atoms/comments";
import { allowedPassageFieldsInHistory } from "../../atoms/passages";
import { allowedRencontreFieldsInHistory } from "../../atoms/rencontres";
import { allowedReportFieldsInHistory } from "../../atoms/reports";
import { allowedPlaceFieldsInHistory } from "../../atoms/places";
import { allowedRelPersonPlaceFieldsInHistory } from "../../atoms/relPersonPlace";
import { allowedGroupFieldsInHistory } from "../../atoms/groups";
import { dayjsInstance } from "../../services/dateDayjs";
import { RootStackParamList } from "@/types/navigation";
import TeamsTags from "@/components/TeamsTags";

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

const HIDDEN_FIELDS = [
  "updatedAt",
  "createdAt",
  "updatedBy",
  "entityKey",
  "entityUpdatedAt",
  // history, documents, comments : auto-mergés par syncProcessor.detectConflict, jamais surfacés
  "history",
  "documents",
  "comments",
  "_id",
  "organisation",
  "encrypted",
  "encryptedEntityKey",
  "deletedAt",
  "_pendingSync",
  "_queueItemId",
];

type FieldMeta = { label: string; type?: string };

const STATIC_FIELDS_BY_ENTITY: Record<string, Array<{ name: string; label: string; type?: string }>> = {
  action: allowedActionFieldsInHistory,
  treatment: allowedTreatmentFieldsInHistory,
  comment: allowedCommentFieldsInHistory,
  passage: allowedPassageFieldsInHistory,
  rencontre: allowedRencontreFieldsInHistory,
  report: allowedReportFieldsInHistory,
  place: allowedPlaceFieldsInHistory,
  relPersonPlace: allowedRelPersonPlaceFieldsInHistory,
  group: allowedGroupFieldsInHistory,
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
            onResolve={async (mergedBody) => {
              await resolveConflict(conflict.queueItemId, mergedBody);
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
  onResolve: (mergedBody: Record<string, any>) => void;
  onDismiss: () => void;
};

function ConflictCard({ conflict, expanded, onToggle, onResolve, onDismiss }: ConflictCardProps) {
  const getFieldMeta = useFieldMetaResolver();
  const entityLabel = ENTITY_LABELS[conflict.entityType] || conflict.entityType;
  const entityName =
    conflict.localVersion?.name || conflict.serverVersion?.name || conflict.localVersion?.decrypted?.name || conflict.entityId.slice(0, 8);

  const visibleFields = useMemo(() => {
    const localKeys = Object.keys(conflict.localVersion?.decrypted || {});
    const serverKeys = Object.keys(conflict.serverVersion || {});
    const union = Array.from(new Set([...localKeys, ...serverKeys]));
    return union.filter((field) => {
      if (HIDDEN_FIELDS.includes(field)) return false;
      const localVal = conflict.localVersion?.decrypted?.[field] ?? conflict.localVersion?.[field];
      const serverVal = conflict.serverVersion?.[field];
      return !valuesEqual(localVal, serverVal);
    });
  }, [conflict]);

  const [selections, setSelections] = useState<Record<string, "local" | "server">>(() =>
    Object.fromEntries(
      visibleFields.map((field) => {
        const localVal = conflict.localVersion?.decrypted?.[field] ?? conflict.localVersion?.[field];
        const serverVal = conflict.serverVersion?.[field];
        const defaultSide: "local" | "server" = isEmpty(localVal) && !isEmpty(serverVal) ? "server" : "local";
        return [field, defaultSide];
      })
    )
  );

  const setAll = (side: "local" | "server") => {
    setSelections(Object.fromEntries(visibleFields.map((f) => [f, side])));
  };

  const handleConfirm = () => {
    const resolved: Record<string, any> = { ...conflict.localVersion };
    resolved.decrypted = { ...(conflict.localVersion?.decrypted || {}) };
    for (const field of visibleFields) {
      if (selections[field] === "server") {
        const serverVal = conflict.serverVersion?.[field];
        if (field in (conflict.localVersion?.decrypted || {})) {
          resolved.decrypted[field] = serverVal;
        } else if (field in (conflict.localVersion || {})) {
          resolved[field] = serverVal;
        } else {
          resolved.decrypted[field] = serverVal;
        }
      }
    }
    Alert.alert("Confirmer la résolution", "La version sélectionnée pour chaque champ sera enregistrée.", [
      { text: "Annuler", style: "cancel" },
      { text: "Confirmer", onPress: () => onResolve(resolved) },
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
              {visibleFields.length} champ{visibleFields.length > 1 ? "s" : ""} en conflit
            </MyText>
          </View>
          <MyText className="text-sm text-[#8C9294] ml-2">{expanded ? "▲" : "▼"}</MyText>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} hitSlop={12} className="absolute top-2 right-2 p-1">
        <MyText className="text-lg text-[#8C9294]">{"✕"}</MyText>
      </TouchableOpacity>

      {expanded && (
        <View className="px-4 pb-4">
          <View className="flex-row mb-3">
            <TouchableOpacity onPress={() => setAll("local")} className="flex-1 mr-1.5 py-2 rounded-[6px] border border-main25 items-center">
              <MyText className="text-xs text-main">Tout garder ma version</MyText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAll("server")} className="flex-1 ml-1.5 py-2 rounded-[6px] border border-main25 items-center">
              <MyText className="text-xs text-main">Tout garder serveur</MyText>
            </TouchableOpacity>
          </View>

          {visibleFields.map((fieldName) => {
            const meta = getFieldMeta(conflict.entityType, fieldName);
            const localVal = conflict.localVersion?.decrypted?.[fieldName] ?? conflict.localVersion?.[fieldName];
            const serverVal = conflict.serverVersion?.[fieldName];
            const selected = selections[fieldName] || "local";
            return (
              <View key={fieldName} className="mb-3">
                <MyText bold className="text-sm mb-1.5 text-[#0d5b54]">
                  {meta.label || fieldName}
                </MyText>
                <View className="flex-row">
                  <ValueOption
                    label="Ma version"
                    fieldName={fieldName}
                    value={localVal}
                    type={meta.type}
                    selected={selected === "local"}
                    onPress={() => setSelections((prev) => ({ ...prev, [fieldName]: "local" }))}
                  />
                  <View className="w-2" />
                  <ValueOption
                    label="Serveur"
                    fieldName={fieldName}
                    value={serverVal}
                    type={meta.type}
                    selected={selected === "server"}
                    onPress={() => setSelections((prev) => ({ ...prev, [fieldName]: "server" }))}
                  />
                </View>
              </View>
            );
          })}

          <View className="mt-4">
            <Button caption="Confirmer la résolution" onPress={handleConfirm} backgroundColor={colors.app.color} color="#fff" />
          </View>
        </View>
      )}
    </View>
  );
}

type ValueOptionProps = {
  label: string;
  fieldName: string;
  value: unknown;
  type?: string;
  selected: boolean;
  onPress: () => void;
};

function ValueOption({ label, fieldName, value, type, selected, onPress }: ValueOptionProps) {
  console.log({ fieldName });
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="flex-1">
      <View className={["rounded-[6px] p-2 border-2 min-h-[60px]", selected ? "border-main bg-main25" : "border-transparent bg-[#f5f5f5]"].join(" ")}>
        <View className="flex-row items-center justify-between mb-1">
          <MyText bold className="text-[11px] text-[#8C9294] uppercase">
            {label}
          </MyText>
          {selected && (
            <MyText bold className="text-[11px] text-main">
              {"✓"}
            </MyText>
          )}
        </View>
        {fieldName.toLocaleLowerCase().includes("teams") ? (
          Array.isArray(value) ? (
            <TeamsTags teams={value as string[]} />
          ) : (
            <TeamsTags teams={(value as string).split(", ")} />
          )
        ) : (
          <MyText className="text-sm">{formatValue(value, type)}</MyText>
        )}
      </View>
    </TouchableOpacity>
  );
}

function useFieldMetaResolver(): (entityType: string, fieldName: string) => FieldMeta {
  const personFieldsIncludingCustomFields = useAtomValue(personFieldsIncludingCustomFieldsSelector);
  const consultationsFieldsIncludingCustomFields = useAtomValue(consultationsFieldsIncludingCustomFieldsSelector);
  const flattenedCustomFieldsConsultations = useAtomValue(flattenedCustomFieldsConsultationsSelector);
  const groupedCustomFieldsObs = useAtomValue(groupedCustomFieldsObsSelector);

  return useMemo(() => {
    const flatObsFields = groupedCustomFieldsObs.flatMap((g: any) => g.fields || []);
    return (entityType: string, fieldName: string): FieldMeta => {
      if (entityType === "person") {
        const f = personFieldsIncludingCustomFields.find((field: any) => field.name === fieldName);
        if (f) return { label: f.label || fieldName, type: f.type };
      }
      if (entityType === "consultation") {
        const cf = flattenedCustomFieldsConsultations.find((field: any) => field.name === fieldName);
        if (cf) return { label: cf.label || fieldName, type: cf.type };
        const f = consultationsFieldsIncludingCustomFields.find((field: any) => field.name === fieldName);
        if (f) return { label: f.label || fieldName };
      }
      if (entityType === "territory-observation") {
        const f = flatObsFields.find((field: any) => field.name === fieldName);
        if (f) return { label: f.label || fieldName, type: f.type };
      }
      const staticFields = STATIC_FIELDS_BY_ENTITY[entityType];
      if (staticFields) {
        const f = staticFields.find((field) => field.name === fieldName);
        if (f) return { label: f.label || fieldName, type: (f as any).type };
      }
      return { label: fieldName };
    };
  }, [personFieldsIncludingCustomFields, consultationsFieldsIncludingCustomFields, flattenedCustomFieldsConsultations, groupedCustomFieldsObs]);
}

function isEmpty(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === "string" && val === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => valuesEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function formatValue(val: unknown, type?: string): string {
  if (val === null || val === undefined || val === "") return "(vide)";
  if (typeof val === "boolean") return val ? "Oui" : "Non";
  if (type === "yes-no") {
    if (val === "yes" || val === "Oui") return "Oui";
    if (val === "no" || val === "Non") return "Non";
    return "(vide)";
  }
  if (Array.isArray(val)) return val.length === 0 ? "(vide)" : val.join(", ");
  if (typeof val === "object") return JSON.stringify(val);
  if (typeof val === "string") {
    if (type === "date" || type === "duration") {
      const d = dayjsInstance(val);
      if (d.isValid()) return d.format("DD/MM/YYYY");
    }
    if (type === "date-with-time") {
      const d = dayjsInstance(val);
      if (d.isValid()) return d.format("DD/MM/YYYY HH:mm");
    }
    if (!type) {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
        const d = dayjsInstance(val);
        if (d.isValid()) {
          const isMidnightUTC = /T00:00:00\.?\d*Z?$/.test(val);
          return d.format(isMidnightUTC ? "DD/MM/YYYY" : "DD/MM/YYYY HH:mm");
        }
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        const d = dayjsInstance(val);
        if (d.isValid()) return d.format("DD/MM/YYYY");
      }
    }
  }
  return String(val);
}
