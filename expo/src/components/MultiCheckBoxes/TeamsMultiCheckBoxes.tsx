import React from "react";
import { useAtomValue } from "jotai";
import { teamsState } from "../../recoil/auth";
import MultiCheckBoxes from "./MultiCheckBoxes";
import { TeamInstance } from "@/types/team";

type TeamsMultiCheckBoxesProps = {
  values: TeamInstance["_id"][];
  onChange: (values: TeamInstance["_id"][]) => void;
  editable: boolean;
};

const TeamsMultiCheckBoxes = ({ values = [], onChange, editable }: TeamsMultiCheckBoxesProps) => {
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
