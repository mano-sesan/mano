import React from "react";
import { useAtomValue } from "jotai";
import { personFieldsSelector } from "../../recoil/persons";
import SelectLabelled from "./SelectLabelled";

type OutOfActiveListSelectProps = {
  value: string;
  onSelect: (value: string) => void;
  editable: boolean;
};

const OutOfActiveListSelect = ({ value = "", onSelect, editable }: OutOfActiveListSelectProps) => {
  const personFields = useAtomValue(personFieldsSelector)!;
  const options = [
    {
      _id: "all",
      name: "Tout le monde (oui et non)",
    },
    ...(personFields?.find((f) => f.name === "outOfActiveList")?.options?.map((o) => ({ _id: o, name: o })) || []),
  ];
  return (
    <SelectLabelled
      mappedIdsToLabels={options}
      label="Sortie de file active"
      values={options.map((o) => o._id)}
      value={value}
      onSelect={(value) => {
        if (value === "all") {
          onSelect("");
        } else {
          onSelect(value);
        }
      }}
      editable={editable}
    />
  );
};

export default OutOfActiveListSelect;
