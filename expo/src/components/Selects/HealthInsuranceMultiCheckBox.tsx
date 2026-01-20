import React from "react";
import { useAtomValue } from "jotai";
import { flattenedCustomFieldsPersonsSelector } from "../../recoil/persons";
import MultiCheckBoxes from "../MultiCheckBoxes/MultiCheckBoxes";
import { PersonInstance } from "@/types/person";

type HealthInsuranceMultiCheckBoxProps = {
  values: PersonInstance["healthInsurances"];
  onChange: (values: PersonInstance["healthInsurances"]) => void;
  editable: boolean;
};

const HealthInsuranceMultiCheckBox = ({ values, onChange, editable }: HealthInsuranceMultiCheckBoxProps) => {
  const flattenedCustomFieldsPersons = useAtomValue(flattenedCustomFieldsPersonsSelector);

  return (
    <MultiCheckBoxes
      label="Couverture(s) médicale(s)"
      source={flattenedCustomFieldsPersons.find((f) => f.name === "healthInsurances")!.options!}
      values={values}
      onChange={onChange}
      editable={editable}
      emptyValue="-- Ne sait pas --"
    />
  );
};

export default HealthInsuranceMultiCheckBox;
