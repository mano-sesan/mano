import React, { useState } from "react";
import { View } from "react-native";
import { FilterableField } from "@/types/field";
import InputLabelled from "./InputLabelled";
import DateAndTimeInput from "./DateAndTimeInput";
import SelectLabelled from "./Selects/SelectLabelled";
import MultiCheckBoxes from "./MultiCheckBoxes/MultiCheckBoxes";
import CheckboxLabelled from "./CheckboxLabelled";

type FilterConfigInputProps = {
  field: FilterableField;
  value: any;
  onChange: (value: any) => void;
};

const numberComparators = [
  { _id: "lower", name: "Inférieur à" },
  { _id: "greater", name: "Supérieur à" },
  { _id: "equals", name: "Égal à" },
  { _id: "between", name: "Entre" },
  { _id: "unfilled", name: "Non renseigné" },
];

const dateComparators = [
  { _id: "before", name: "Avant" },
  { _id: "after", name: "Après" },
  { _id: "equals", name: "Date exacte" },
  { _id: "unfilled", name: "Non renseigné" },
];

const FilterConfigInput = ({ field, value, onChange }: FilterConfigInputProps) => {
  const [unfilledChecked, setUnfilledChecked] = useState(value === "Non renseigné");

  // Handle number fields
  if (field.type === "number") {
    const comparator = value?.comparator || "equals";
    const number = value?.number || "";
    const number2 = value?.number2 || "";

    return (
      <View>
        <SelectLabelled
          label="Comparateur"
          values={numberComparators.map((c) => c._id)}
          value={comparator}
          onSelect={(newComparator) => {
            onChange({ comparator: newComparator, number, number2 });
          }}
          mappedIdsToLabels={numberComparators}
        />
        {comparator !== "unfilled" && (
          <>
            <InputLabelled
              label={comparator === "between" ? "Valeur minimale" : "Valeur"}
              keyboardType="numeric"
              value={String(number)}
              onChangeText={(text) => {
                onChange({ comparator, number: text, number2 });
              }}
            />
            {comparator === "between" && (
              <InputLabelled
                label="Valeur maximale"
                keyboardType="numeric"
                value={String(number2)}
                onChangeText={(text) => {
                  onChange({ comparator, number, number2: text });
                }}
              />
            )}
          </>
        )}
      </View>
    );
  }

  // Handle date fields
  if (["date", "date-with-time", "duration"].includes(field.type)) {
    const comparator = value?.comparator || "equals";
    const date = value?.date || null;

    return (
      <View>
        <SelectLabelled
          label="Comparateur"
          values={dateComparators.map((c) => c._id)}
          value={comparator}
          onSelect={(newComparator) => {
            onChange({ comparator: newComparator, date });
          }}
          mappedIdsToLabels={dateComparators}
        />
        {comparator !== "unfilled" && (
          <DateAndTimeInput
            label="Date"
            date={date}
            setDate={(newDate) => {
              onChange({ comparator, date: newDate });
            }}
            withTime={field.type === "date-with-time"}
          />
        )}
      </View>
    );
  }

  // Handle text/textarea fields
  if (["text", "textarea"].includes(field.type)) {
    return (
      <View>
        <InputLabelled
          label={`Rechercher dans ${field.label}`}
          value={unfilledChecked ? "" : value || ""}
          onChangeText={(text) => {
            onChange(text);
          }}
          multiline={field.type === "textarea"}
          editable={!unfilledChecked}
        />
        <View className="mt-3">
          <CheckboxLabelled
            _id="unfilled"
            label="Non renseigné"
            value={unfilledChecked}
            onPress={() => {
              const newChecked = !unfilledChecked;
              setUnfilledChecked(newChecked);
              onChange(newChecked ? "Non renseigné" : "");
            }}
            alone
          />
        </View>
      </View>
    );
  }

  // Handle boolean fields
  if (field.type === "boolean") {
    const booleanValues = ["Oui", "Non"];
    return (
      <SelectLabelled
        label={field.label}
        values={booleanValues}
        value={value || "Oui"}
        onSelect={(newValue) => {
          onChange(newValue);
        }}
      />
    );
  }

  // Handle yes-no fields
  if (field.type === "yes-no") {
    const yesNoValues = ["Oui", "Non", "Non renseigné"];
    return (
      <SelectLabelled
        label={field.label}
        values={yesNoValues}
        value={value || "Oui"}
        onSelect={(newValue) => {
          onChange(newValue);
        }}
      />
    );
  }

  // Handle enum and multi-choice fields
  if (["enum", "multi-choice"].includes(field.type)) {
    const options = field.options || [];
    const currentValue = Array.isArray(value) ? value : value ? [value] : [];

    // Special handling for outOfActiveList field
    if (field.field === "outOfActiveList") {
      return (
        <SelectLabelled
          label={field.label}
          values={options}
          value={currentValue[0] || options[0]}
          onSelect={(newValue) => {
            onChange([newValue]);
          }}
        />
      );
    }

    // Special handling for action categories (use ActionCategoriesModalSelect pattern)
    if (field.field === "actionCategories" || field.field === "actionCategoriesCombined") {
      // For now, we'll use MultiCheckBoxes since ActionCategoriesModalSelect needs specific refactoring
      // TODO: Create a generic modal select component for large option lists
      if (options.length > 15) {
        return (
          <View>
            <MultiCheckBoxes
              label={field.label}
              source={options}
              values={currentValue}
              onChange={(newValues) => {
                onChange(newValues);
              }}
              editable
              emptyValue="Aucune sélection"
              allowCreateOption={false}
            />
          </View>
        );
      }
    }

    // For small option lists (< 15), use MultiCheckBoxes
    if (options.length < 15) {
      return (
        <MultiCheckBoxes
          label={field.label}
          source={options}
          values={currentValue}
          onChange={(newValues) => {
            onChange(newValues);
          }}
          editable
          emptyValue="Aucune sélection"
          allowCreateOption={false}
        />
      );
    }

    // For large option lists (>= 15), use MultiCheckBoxes with search
    // TODO: Implement a better component for large lists (like ActionCategoriesModalSelect)
    return (
      <MultiCheckBoxes
        label={field.label}
        source={options}
        values={currentValue}
        onChange={(newValues) => {
          onChange(newValues);
        }}
        editable
        emptyValue="Aucune sélection"
        allowCreateOption={false}
      />
    );
  }

  // Default fallback
  return (
    <InputLabelled
      label={field.label}
      value={value || ""}
      onChangeText={(text) => {
        onChange(text);
      }}
    />
  );
};

export default FilterConfigInput;
