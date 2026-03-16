import { useAtomValue } from "jotai";
import { currentTeamAuthentifiedState } from "../../../atoms/auth";
import { useMemo, useState } from "react";
import EditModal from "./EditModal";
import CustomFieldDisplay from "../../../components/CustomFieldDisplay";
import type { PersonPopulated } from "../../../types/person";
import type { CustomField } from "../../../types/field";
import { PencilSquareIcon } from "@heroicons/react/24/outline";

interface PersonCustomFieldsProps {
  person: PersonPopulated;
  sectionName: string;
  fields: CustomField[];
  isMedicalFile?: boolean;
}

export default function PersonCustomFields({ person, sectionName, fields, isMedicalFile = false }: PersonCustomFieldsProps) {
  const [editModal, setEditModal] = useState("");
  const team = useAtomValue(currentTeamAuthentifiedState);
  const enabledFields = useMemo(() => {
    return fields.filter((f) => f.enabled || f.enabledTeams?.includes(team._id));
  }, [fields, team]);
  if (!enabledFields.length) return null;
  return (
    <div className="p-3 border tw-min-h-[132px] tw-rounded-lg tw-border tw-border-zinc-200 tw-shadow tw-bg-zinc-50/80">
      {Boolean(editModal) && <EditModal isMedicalFile={isMedicalFile} person={person} selectedPanel={editModal} onClose={() => setEditModal("")} />}
      <div className="tw-flex">
        <h4 className="tw-flex-1 tw-text-xl">{sectionName}</h4>
        <div>
          <button
            className="tw-transition hover:tw-scale-125"
            onClick={() => setEditModal(sectionName)}
            aria-label={`Éditer les ${sectionName.toLowerCase()}`}
            title={`Éditer les ${sectionName.toLowerCase()}`}
          >
            <PencilSquareIcon className="tw-h-5 tw-w-5 tw-text-main" />
          </button>
        </div>
      </div>
      <div className="tw-grid tw-grid-cols-3 tw-gap-2">
        {enabledFields.map((field, i) => {
          return (
            <div
              key={field.label + i}
              className={
                field.type === "textarea"
                  ? "tw-col-span-3 tw-rounded tw-bg-white tw-border tw-border-zinc-200"
                  : "tw-col-span-3 sm:tw-col-span-1 tw-rounded tw-bg-white tw-border tw-border-zinc-200"
              }
            >
              <div className="p-2 [overflow-wrap:anywhere]">
                <div className="tw-text-sm tw-font-semibold tw-text-main75">{field.label}</div>
                <div>
                  <CustomFieldDisplay
                    showHistory
                    type={field.type}
                    value={isMedicalFile ? person[field.name] || person.medicalFile?.[field.name] : person[field.name]}
                    name={field.name}
                    person={person}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
