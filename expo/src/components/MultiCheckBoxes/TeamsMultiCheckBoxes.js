import React from "react";
import { useAtomValue } from "jotai";
import { teamsState } from "../../recoil/auth";
import MultiCheckBoxes from "./MultiCheckBoxes";

const TeamsMultiCheckBoxes = ({ values = [], onChange, editable }) => {
  const teams = useAtomValue(teamsState);
  return (
    <MultiCheckBoxes
      label="Assigner à une équipe"
      source={teams.map((t) => t.name)}
      values={values}
      onChange={onChange}
      editable={editable}
      emptyValue="-- Ne sait pas --"
    />
  );
};

export default TeamsMultiCheckBoxes;
