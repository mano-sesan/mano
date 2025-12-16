import React from "react";
import MultiCheckBoxes from "./MultiCheckBoxes";
import { useAtomValue } from "jotai";
import { flattenedTerritoriesTypesSelector } from "../../recoil/territory";
import { TerritoryType } from "@/types/territory";

const TerritoryMultiCheckBoxes = ({
  values = [],
  onChange,
  editable,
}: {
  values: TerritoryType[];
  onChange: (values: TerritoryType[]) => void;
  editable: boolean;
}) => {
  const territoryTypes = useAtomValue(flattenedTerritoriesTypesSelector);
  return (
    <MultiCheckBoxes
      label="Type"
      source={territoryTypes}
      values={values}
      onChange={(values) => onChange(values as TerritoryType[])}
      editable={editable}
      emptyValue="-- Choisissez --"
    />
  );
};

export default TerritoryMultiCheckBoxes;
