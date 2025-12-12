import React from "react";
import { useAtomValue } from "jotai";
import { fieldsPersonsCustomizableOptionsSelector } from "../../recoil/persons";
import MultiCheckBoxes from "../MultiCheckBoxes/MultiCheckBoxes";

const OutOfActiveListReasonMultiCheckBox = ({ values, onChange, editable }) => {
  const fieldsPersonsCustomizableOptions = useAtomValue(fieldsPersonsCustomizableOptionsSelector);
  const outOfActiveListReasonOptions = fieldsPersonsCustomizableOptions.find((f) => f.name === "outOfActiveListReasons").options;
  return (
    <MultiCheckBoxes
      label="Motif de sortie de file active"
      source={outOfActiveListReasonOptions}
      values={values}
      onChange={onChange}
      editable={editable}
      emptyValue="-- Ne sait pas --"
    />
  );
};

export default OutOfActiveListReasonMultiCheckBox;
