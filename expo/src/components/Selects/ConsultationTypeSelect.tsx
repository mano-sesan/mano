import React from "react";
import { useAtomValue } from "jotai";
import { organisationState } from "../../recoil/auth";
import SelectLabelled from "./SelectLabelled";

const ConsultationTypeSelect = ({ value, onSelect, editable }: { value: string; onSelect: (value: string) => void; editable: boolean }) => {
  const organisation = useAtomValue(organisationState)!;
  const types = ["-- Choisissez un type  --", ...organisation.consultations.map((t) => t.name)];
  if (!value?.length) value = types[0];
  return <SelectLabelled label="Type" values={types} value={value} onSelect={onSelect} editable={editable} />;
};

export default ConsultationTypeSelect;
