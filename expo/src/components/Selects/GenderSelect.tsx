import React from "react";
import { useAtomValue } from "jotai";
import { personFieldsSelector } from "../../recoil/persons";
import SelectLabelled from "./SelectLabelled";
import { PersonInstance } from "@/types/person";

type GenderSelectProps = {
  value?: string;
  onSelect: (value: PersonInstance["gender"]) => void;
  editable?: boolean;
};

const GenderSelect = ({ value = "-- Choisissez un genre --", onSelect, editable }: GenderSelectProps) => {
  const personFields = useAtomValue(personFieldsSelector)!;
  const genders = ["-- Choisissez un genre --", ...personFields.find((f) => f.name === "gender")!.options!];
  return (
    <SelectLabelled
      label="Genre"
      values={genders}
      value={value}
      onSelect={(newValue) => onSelect(newValue as PersonInstance["gender"])}
      editable={editable}
    />
  );
};

export default GenderSelect;
