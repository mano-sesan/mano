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
import { customFieldsObsSelector } from "../../atoms/territoryObservations";
import { dayjsInstance } from "../../services/dateDayjs";
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

const HIDDEN_FIELDS = ["updatedAt", "createdAt", "entityKey", "entityUpdatedAt", "history", "assignedTeams", "documents", "comments"];

type FieldMeta = { label: string; type?: string };

const ENTITY_FIELD_DEFAULTS: Record<string, Record<string, FieldMeta>> = {
  action: {
    name: { label: "Nom de l'action", type: "text" },
    description: { label: "Description", type: "textarea" },
    categories: { label: "Catégorie(s)", type: "multi-choice" },
    category: { label: "Catégorie", type: "text" },
    person: { label: "Personne suivie" },
    teams: { label: "Équipe(s) en charge", type: "multi-choice" },
    team: { label: "Équipe" },
    urgent: { label: "Action urgente", type: "boolean" },
    completedAt: { label: "Faite le", type: "date-with-time" },
    dueAt: { label: "À faire le", type: "date-with-time" },
    status: { label: "Statut" },
    withTime: { label: "Avec heure", type: "boolean" },
    user: { label: "Créée par" },
    group: { label: "Action familiale", type: "boolean" },
    structure: { label: "Structure" },
  },
  treatment: {
    person: { label: "Personne suivie" },
    name: { label: "Nom du traitement", type: "text" },
    startDate: { label: "Date de début", type: "date" },
    endDate: { label: "Date de fin", type: "date" },
    dosage: { label: "Dosage", type: "text" },
    frequency: { label: "Fréquence", type: "text" },
    indication: { label: "Indication", type: "textarea" },
    user: { label: "Créé par" },
  },
  comment: {
    comment: { label: "Commentaire", type: "textarea" },
    person: { label: "Personne" },
    action: { label: "Action" },
    group: { label: "Famille" },
    team: { label: "Équipe" },
    user: { label: "Auteur" },
    date: { label: "Date", type: "date-with-time" },
    urgent: { label: "Urgent", type: "boolean" },
  },
  passage: {
    person: { label: "Personne" },
    team: { label: "Équipe" },
    user: { label: "Auteur" },
    date: { label: "Date", type: "date-with-time" },
    comment: { label: "Commentaire", type: "textarea" },
  },
  rencontre: {
    person: { label: "Personne" },
    team: { label: "Équipe" },
    user: { label: "Auteur" },
    date: { label: "Date", type: "date-with-time" },
    comment: { label: "Commentaire", type: "textarea" },
  },
  report: {
    description: { label: "Description", type: "textarea" },
    services: { label: "Services" },
    collaborations: { label: "Collaborations" },
    date: { label: "Date", type: "date" },
    team: { label: "Équipe" },
  },
  place: {
    name: { label: "Nom", type: "text" },
    user: { label: "Créé par" },
  },
  relPersonPlace: {
    person: { label: "Personne" },
    place: { label: "Lieu" },
    user: { label: "Créé par" },
  },
  group: {
    persons: { label: "Personnes", type: "multi-choice" },
    relations: { label: "Relations" },
  },
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
    conflict.localVersion?.name ||
    conflict.serverVersion?.name ||
    conflict.localVersion?.decrypted?.name ||
    conflict.entityId.slice(0, 8);

  const visibleFields = useMemo(() => {
    return conflict.changedFields.filter((field) => {
      if (HIDDEN_FIELDS.includes(field)) return false;
      const localVal = conflict.localVersion?.decrypted?.[field] ?? conflict.localVersion?.[field];
      const serverVal = conflict.serverVersion?.[field];
      return !valuesEqual(localVal, serverVal);
    });
  }, [conflict]);

  const [selections, setSelections] = useState<Record<string, "local" | "server">>(() =>
    Object.fromEntries(visibleFields.map((f) => [f, "local"]))
  );

  const setAll = (side: "local" | "server") => {
    setSelections(Object.fromEntries(visibleFields.map((f) => [f, side])));
  };

  const handleConfirm = () => {
    const resolved: Record<string, any> = { ...conflict.localVersion };
    if (conflict.localVersion?.decrypted) {
      resolved.decrypted = { ...conflict.localVersion.decrypted };
    }
    for (const field of visibleFields) {
      if (selections[field] === "server") {
        const serverVal = conflict.serverVersion?.[field];
        if (resolved.decrypted && field in resolved.decrypted) {
          resolved.decrypted[field] = serverVal;
        } else {
          resolved[field] = serverVal;
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

          {visibleFields.map((field) => {
            const meta = getFieldMeta(conflict.entityType, field);
            const localVal = conflict.localVersion?.decrypted?.[field] ?? conflict.localVersion?.[field];
            const serverVal = conflict.serverVersion?.[field];
            const selected = selections[field] || "local";
            return (
              <View key={field} className="mb-3">
                <MyText bold className="text-sm mb-1.5 text-[#0d5b54]">
                  {meta.label || field}
                </MyText>
                <View className="flex-row">
                  <ValueOption
                    label="Ma version"
                    value={localVal}
                    type={meta.type}
                    selected={selected === "local"}
                    onPress={() => setSelections((prev) => ({ ...prev, [field]: "local" }))}
                  />
                  <View className="w-2" />
                  <ValueOption
                    label="Serveur"
                    value={serverVal}
                    type={meta.type}
                    selected={selected === "server"}
                    onPress={() => setSelections((prev) => ({ ...prev, [field]: "server" }))}
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
  value: unknown;
  type?: string;
  selected: boolean;
  onPress: () => void;
};

function ValueOption({ label, value, type, selected, onPress }: ValueOptionProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="flex-1">
      <View
        className={["rounded-[6px] p-2 border-2 min-h-[60px]", selected ? "border-main bg-main25" : "border-transparent bg-[#f5f5f5]"].join(" ")}
      >
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
        <MyText className="text-sm">{formatValue(value, type)}</MyText>
      </View>
    </TouchableOpacity>
  );
}

function useFieldMetaResolver(): (entityType: string, fieldName: string) => FieldMeta {
  const personFields = useAtomValue(personFieldsIncludingCustomFieldsSelector);
  const consultationFields = useAtomValue(consultationsFieldsIncludingCustomFieldsSelector);
  const customConsultationFields = useAtomValue(flattenedCustomFieldsConsultationsSelector);
  const obsFields = useAtomValue(customFieldsObsSelector);

  return useMemo(() => {
    return (entityType: string, fieldName: string) => {
      if (entityType === "person") {
        const f = personFields.find((field: any) => field.name === fieldName);
        if (f) return { label: f.label || fieldName, type: f.type };
      }
      if (entityType === "consultation") {
        const cf = customConsultationFields.find((field: any) => field.name === fieldName);
        if (cf) return { label: cf.label || fieldName, type: cf.type };
        const f = consultationFields.find((field: any) => field.name === fieldName);
        if (f) return { label: f.label || fieldName };
      }
      if (entityType === "territory-observation") {
        const f = obsFields.find((field: any) => field.name === fieldName);
        if (f) return { label: f.label || fieldName, type: f.type };
      }
      const def = ENTITY_FIELD_DEFAULTS[entityType]?.[fieldName];
      if (def) return def;
      return { label: fieldName };
    };
  }, [personFields, consultationFields, customConsultationFields, obsFields]);
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
