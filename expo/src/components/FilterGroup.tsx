import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { MyText } from "./MyText";
import { FilterableField, Filter } from "@/types/field";

type FilterGroupProps = {
  title: string;
  fields: FilterableField[];
  activeFilters: Filter[];
  onFieldPress: (field: FilterableField) => void;
};

const FilterGroup = ({ title, fields, activeFilters, onFieldPress }: FilterGroupProps) => {
  const [expanded, setExpanded] = useState(true);

  const isFieldFiltered = (field: FilterableField) => {
    return activeFilters.some((filter) => filter.field === field.field && Boolean(filter.value));
  };

  return (
    <View className="mb-4">
      <TouchableOpacity onPress={() => setExpanded(!expanded)} className="border-b border-gray-300 pb-2 mb-2">
        <View className="flex-row items-center">
          <MyText className="text-base font-bold text-gray-600 flex-1">{title}</MyText>
          <MyText className="text-gray-500">{expanded ? "▼" : "▶"}</MyText>
        </View>
      </TouchableOpacity>
      {expanded && (
        <View>
          {fields.map((field) => {
            const filtered = isFieldFiltered(field);
            return (
              <TouchableOpacity
                key={field.field}
                onPress={() => onFieldPress(field)}
                className="flex-row items-center justify-between py-3 px-4 border-b border-gray-100"
              >
                <MyText className={`text-base ${filtered ? "font-bold" : ""}`}>{field.label}</MyText>
                {filtered && <MyText className="text-blue-500 font-bold">✓</MyText>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default FilterGroup;
