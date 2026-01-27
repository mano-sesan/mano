import React, { useState } from "react";
import { View } from "react-native";
import SceneContainer from "@/components/SceneContainer";
import ScreenTitle from "@/components/ScreenTitle";
import ScrollContainer from "@/components/ScrollContainer";
import Button from "@/components/Button";
import ButtonsContainer from "@/components/ButtonsContainer";
import FilterConfigInput from "@/components/FilterConfigInput";
import { FilterableField, Filter } from "@/types/field";

type FilterConfigModalProps = {
  field: FilterableField;
  onBack: () => void;
  onAdd: (filter: Filter) => void;
};

const FilterConfigModal = ({ field, onBack, onAdd }: FilterConfigModalProps) => {
  const [value, setValue] = useState<any>(getDefaultValue(field));

  const handleAdd = React.useCallback(() => {
    // Validate that the value is not empty
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return;
    }

    // For number and date filters, ensure comparator and value are set
    if (field.type === "number" && value.comparator !== "unfilled") {
      if (!value.number) return;
      if (value.comparator === "between" && !value.number2) return;
    }

    if (["date", "date-with-time", "duration"].includes(field.type) && value.comparator !== "unfilled") {
      if (!value.date) return;
    }

    // Create the filter
    const filter: Filter = {
      field: field.field,
      type: field.type,
      value,
      category: field.category,
      label: field.label,
    };

    onAdd(filter);
    onBack();
  }, [value, field, onAdd, onBack]);

  const isAddDisabled = React.useMemo(() => {
    if (!value) return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (field.type === "number" && value.comparator !== "unfilled") {
      if (!value.number) return true;
      if (value.comparator === "between" && !value.number2) return true;
    }
    if (["date", "date-with-time", "duration"].includes(field.type) && value.comparator !== "unfilled") {
      if (!value.date) return true;
    }
    return false;
  }, [value, field.type]);

  return (
    <SceneContainer>
      <ScreenTitle title={`Configurer: ${field.label}`} onBack={onBack} />
      <ScrollContainer>
        <View className="p-4">
          <FilterConfigInput field={field} value={value} onChange={setValue} />
        </View>
      </ScrollContainer>
      <View className="bg-white pb-8 pt-2">
        <ButtonsContainer>
          <Button caption="Ajouter le filtre" onPress={handleAdd} disabled={isAddDisabled} testID="add-filter-button" />
        </ButtonsContainer>
      </View>
    </SceneContainer>
  );
};

// Helper function to get default value based on field type
function getDefaultValue(field: FilterableField): any {
  if (field.type === "number") {
    return { comparator: "equals", number: "", number2: "" };
  }
  if (["date", "date-with-time", "duration"].includes(field.type)) {
    return { comparator: "equals", date: null };
  }
  if (field.type === "boolean") {
    return "Oui";
  }
  if (field.type === "yes-no") {
    return "Oui";
  }
  if (["enum", "multi-choice"].includes(field.type)) {
    return [];
  }
  return "";
}

export default FilterConfigModal;
