import React from "react";
import CheckboxLabelled from "./CheckboxLabelled";
import DateAndTimeInput from "./DateAndTimeInput";
import InputLabelled from "./InputLabelled";
import MultiCheckBoxes from "./MultiCheckBoxes/MultiCheckBoxes";
import SelectLabelled from "./Selects/SelectLabelled";
import YesNoSelect from "./Selects/YesNoSelect";
import { TextInput } from "react-native";
import { CustomField } from "@/types/field";

type CustomFieldInputProps = {
  forwardRef?: React.RefObject<TextInput | null>;
  label: string;
  field: CustomField;
  value: any;
  handleChange: (value: any) => void;
  editable: boolean;
};
const CustomFieldInput = ({ forwardRef, label, field, value, handleChange, ...props }: CustomFieldInputProps) => {
  // prettier-ignore
  const choices = [
    '-- Choisissez --',
    ...(field.options || []),
  ];

  return (
    <>
      {!!["text", "number", "textarea"].includes(field.type) && (
        <InputLabelled
          label={label}
          onChangeText={handleChange}
          value={value || ""}
          placeholder={label}
          keyboardType={field.type === "number" ? "number-pad" : "default"}
          multiline={field.type === "textarea"}
          ref={forwardRef}
          {...props}
        />
      )}
      {!!["date-with-time", "date", "duration"].includes(field.type) && (
        <DateAndTimeInput
          label={label}
          setDate={handleChange}
          date={value}
          showTime={field.type === "date-with-time"}
          withTime={field.type === "date-with-time"}
          showDay
          required={field.required}
        />
      )}
      {!!["boolean"].includes(field.type) && (
        <CheckboxLabelled _id={field.label} label={label} alone onPress={() => handleChange(!value)} value={value} />
      )}
      {!!["yes-no"].includes(field.type) && <YesNoSelect label={label} value={value} onSelect={handleChange} {...props} />}
      {!!["enum"].includes(field.type) && (
        <SelectLabelled
          allowCreateOption={field.allowCreateOption}
          label={label}
          values={choices}
          value={value || choices[0]}
          onSelect={handleChange}
          {...props}
        />
      )}
      {!!["multi-choice"].includes(field.type) && (
        <MultiCheckBoxes
          allowCreateOption={field.allowCreateOption}
          label={label}
          source={field.options!}
          values={value || []}
          onChange={handleChange}
          {...props}
          emptyValue="-- Aucun --"
        />
      )}
    </>
  );
};

export default CustomFieldInput;
