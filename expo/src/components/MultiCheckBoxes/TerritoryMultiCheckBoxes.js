import React from "react";
import MultiCheckBoxes from "./MultiCheckBoxes";
import { useAtomValue } from "jotai";
import { flattenedTerritoriesTypesSelector } from "../../recoil/territory";

const TerritoryMultiCheckBoxes = ({ values = [], onChange, editable }) => {
  const territoryTypes = useAtomValue(flattenedTerritoriesTypesSelector);
  return (
    <MultiCheckBoxes label="Type" source={territoryTypes} values={values} onChange={onChange} editable={editable} emptyValue="-- Choisissez --" />
  );
};

export default TerritoryMultiCheckBoxes;
