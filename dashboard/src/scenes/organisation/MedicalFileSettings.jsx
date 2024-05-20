import React, { useState, useCallback } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { useDataLoader } from "../../components/DataLoader";
import { organisationState } from "../../recoil/auth";
import { toast } from "react-toastify";
import DragAndDropSettings from "./DragAndDropSettings";
import {
  customFieldsMedicalFileSelector,
  encryptMedicalFile,
  groupedCustomFieldsMedicalFileSelector,
  medicalFileState,
  prepareMedicalFileForEncryption,
} from "../../recoil/medicalFiles";
import CustomFieldSetting from "../../components/CustomFieldSetting";
import { EditCustomField } from "../../components/TableCustomFields";
import api from "../../services/apiv2";

const sanitizeFields = (field) => {
  const sanitizedField = {};
  for (const key of Object.keys(field)) {
    if (![undefined, null].includes(field[key])) sanitizedField[key] = field[key];
  }
  return sanitizedField;
};

const MedicalFileSettings = () => {
  const [organisation, setOrganisation] = useRecoilState(organisationState);
  const flatCustomFieldsMedicalFile = useRecoilValue(customFieldsMedicalFileSelector);
  const groupedCustomFieldsMedicalFile = useRecoilValue(groupedCustomFieldsMedicalFileSelector);
  const dataFormatted = groupedCustomFieldsMedicalFile.map((group) => ({
    groupTitle: group.name,
    items: group.fields,
  }));

  const { refresh } = useDataLoader();

  const onAddGroup = async (name) => {
    const res = await api.put(`/organisation/${organisation._id}`, {
      groupedCustomFieldsMedicalFile: [...groupedCustomFieldsMedicalFile, { name, fields: [] }],
    });
    if (res.ok) {
      toast.success("Groupe ajouté", { autoclose: 2000 });
      setOrganisation(res.data);
    }
    refresh();
  };

  const onGroupTitleChange = async (oldName, newName) => {
    if (!newName) {
      toast.error("Vous devez saisir un nom pour le groupe de champs personnalisés");
      return;
    }
    const newCustomFieldsMedicalFile = groupedCustomFieldsMedicalFile.map((type) => {
      if (type.name !== oldName) return type;
      return {
        ...type,
        name: newName,
      };
    });

    const oldOrganisation = organisation;
    const response = await api.put(`/organisation/${organisation._id}`, { groupedCustomFieldsMedicalFile: newCustomFieldsMedicalFile });
    if (response.ok) {
      refresh();
      setOrganisation(response.data);
      toast.success("Groupe mise à jour. Veuillez notifier vos équipes pour qu'elles rechargent leur app ou leur dashboard");
    } else {
      setOrganisation(oldOrganisation);
      toast.error("Une erreur inattendue est survenue, l'équipe technique a été prévenue. Désolé !");
    }
  };

  const onDeleteGroup = async (name) => {
    const newCustomFieldsMedicalFile = groupedCustomFieldsMedicalFile.filter((type) => type.name !== name);

    const oldOrganisation = organisation;

    const response = await api.put(`/organisation/${organisation._id}`, { groupedCustomFieldsMedicalFile: newCustomFieldsMedicalFile });
    if (response.ok) {
      toast.success("Groupe de champs de dossier médical supprimé", { autoclose: 2000 });
      setOrganisation(response.data);
      refresh();
    } else {
      setOrganisation(oldOrganisation);
    }
  };

  const onDragAndDrop = useCallback(
    async (newCustomFieldsMedicalFile) => {
      newCustomFieldsMedicalFile = newCustomFieldsMedicalFile.map((group) => ({
        name: group.groupTitle,
        fields: group.items.map((customFieldName) => flatCustomFieldsMedicalFile.find((f) => f.name === customFieldName)),
      }));
      const res = await api.put(`/organisation/${organisation._id}`, { groupedCustomFieldsMedicalFile: newCustomFieldsMedicalFile });
      if (res.ok) {
        setOrganisation(res.data);
        refresh();
      }
    },
    [flatCustomFieldsMedicalFile, organisation._id, refresh, setOrganisation]
  );

  return (
    <DragAndDropSettings
      title={<h3 className="tw-mb-0 tw-text-xl tw-font-extrabold">Dossier médical</h3>}
      data={dataFormatted}
      dataItemKey={(cat) => cat.name}
      ItemComponent={MedicalFileCustomField}
      NewItemComponent={AddField}
      onDragAndDrop={onDragAndDrop}
      addButtonCaption="Ajouter un groupe de champs personnalisés"
      onAddGroup={onAddGroup}
      onGroupTitleChange={onGroupTitleChange}
      onDeleteGroup={onDeleteGroup}
    />
  );
};

const AddField = ({ groupTitle: typeName }) => {
  const groupedCustomFieldsMedicalFile = useRecoilValue(groupedCustomFieldsMedicalFileSelector);
  const flatCustomFieldsMedicalFile = useRecoilValue(customFieldsMedicalFileSelector);
  const [organisation, setOrganisation] = useRecoilState(organisationState);
  const [isAddingField, setIsAddingField] = useState(false);
  const { refresh } = useDataLoader();

  const onAddField = async (newField) => {
    try {
      if (flatCustomFieldsMedicalFile.map((e) => e.label).includes(newField.label)) {
        return toast.error(`Ce nom de champ existe déjà dans un autre groupe`);
      }

      const newCustomFieldsMedicalFile = groupedCustomFieldsMedicalFile.map((type) => {
        if (type.name !== typeName) return type;
        return {
          ...type,
          fields: [...type.fields, newField].map(sanitizeFields),
        };
      });
      const response = await api.put(`/organisation/${organisation._id}`, { groupedCustomFieldsMedicalFile: newCustomFieldsMedicalFile });
      if (response.ok) {
        toast.success("Mise à jour !");
        setOrganisation(response.data);
        refresh();
      }
    } catch (orgUpdateError) {
      console.log("error in updating organisation", orgUpdateError);
      toast.error(orgUpdateError.message);
    }
    setIsAddingField(false);
  };

  return (
    <>
      <button
        type="button"
        className="tw-mt-2 tw-block tw-break-normal tw-rounded tw-bg-transparent hover:tw-underline"
        onClick={() => {
          setIsAddingField(true);
        }}
      >
        Ajouter un champ
      </button>
      <EditCustomField
        isNewField
        open={isAddingField}
        onClose={() => {
          setIsAddingField(false);
        }}
        onSaveField={onAddField}
      />
    </>
  );
};

const replaceOldChoiceByNewChoice = (data, oldChoice, newChoice, field) => {
  return data
    .map((item) => {
      if (typeof item[field.name] === "string") {
        if (item[field.name] !== oldChoice) return null;
        return {
          ...item,
          [field.name]: newChoice,
        };
      }
      // if not string, then it's array
      if (!Array.isArray(item[field.name])) return null;
      if (!item[field.name]?.includes(oldChoice)) return null;
      return {
        ...item,
        [field.name]: item[field.name].map((_choice) => (_choice === oldChoice ? newChoice : _choice)),
      };
    })
    .filter(Boolean);
};

const MedicalFileCustomField = ({ item: customField, groupTitle: typeName }) => {
  const [isSelected, setIsSelected] = useState(false);
  const [isEditingField, setIsEditingField] = useState(false);
  const [organisation, setOrganisation] = useRecoilState(organisationState);
  const medicalFiles = useRecoilValue(medicalFileState);
  const groupedCustomFieldsMedicalFile = useRecoilValue(groupedCustomFieldsMedicalFileSelector);

  const { refresh } = useDataLoader();

  const onSaveField = async (editedField) => {
    try {
      const newCustomFieldsMedicalFile = groupedCustomFieldsMedicalFile.map((type) => {
        if (type.name !== typeName) return type;
        return {
          ...type,
          fields: type.fields.map((field) => (field.name !== editedField.name ? field : editedField)).map(sanitizeFields),
        };
      });
      const response = await api.put(`/organisation/${organisation._id}`, { groupedCustomFieldsMedicalFile: newCustomFieldsMedicalFile });
      if (response.ok) {
        toast.success("Mise à jour !");
        setOrganisation(response.data);
        refresh();
      }
    } catch (orgUpdateError) {
      console.log("error in updating organisation", orgUpdateError);
      toast.error(orgUpdateError.message);
    }
    setIsEditingField(false);
  };

  const onEditChoice = async ({ oldChoice, newChoice, field }) => {
    const newCustomFieldsMedicalFile = groupedCustomFieldsMedicalFile.map((type) => {
      if (type.name !== typeName) return type;
      return {
        ...type,
        fields: type.fields.map((_field) =>
          _field.name !== field.name
            ? _field
            : {
                ..._field,
                options: _field.options.map((option) => (option === oldChoice ? newChoice : option)),
              }
        ),
      };
    });
    setIsEditingField(false);
    const updatedMedicalFiles = replaceOldChoiceByNewChoice(medicalFiles, oldChoice, newChoice, field);

    const newCustomFieldsMedicalFileFlat = newCustomFieldsMedicalFile.reduce((acc, type) => [...acc, ...type.fields], []);

    const response = await api.post("/custom-field", {
      customFields: {
        groupedCustomFieldsMedicalFile: newCustomFieldsMedicalFile,
      },
      medicalFiles: await Promise.all(updatedMedicalFiles.map(encryptMedicalFile(newCustomFieldsMedicalFileFlat))),
    });
    if (response.ok) {
      toast.success("Choix mis à jour !");
      setOrganisation(response.data);
    }
    refresh();
  };

  const onDeleteField = async () => {
    try {
      const newCustomFieldsMedicalFile = groupedCustomFieldsMedicalFile.map((type) => {
        if (type.name !== typeName) return type;
        return {
          ...type,
          fields: type.fields.filter((field) => field.name !== customField.name),
        };
      });
      const response = await api.put(`/organisation/${organisation._id}`, { groupedCustomFieldsMedicalFile: newCustomFieldsMedicalFile });
      if (response.ok) {
        toast.success("Mise à jour !");
        setOrganisation(response.data);
        refresh();
      }
    } catch (orgUpdateError) {
      console.log("error in updating organisation", orgUpdateError);
      toast.error(orgUpdateError.message);
    }
    setIsEditingField(false);
  };

  return (
    <>
      <div
        key={customField.name}
        onMouseDown={() => setIsSelected(true)}
        onMouseUp={() => setIsSelected(false)}
        className={[
          "tw-group tw-flex tw-cursor-move tw-items-center tw-border-2 tw-border-transparent tw-pl-1",
          isSelected ? "tw-rounded tw-border-main" : "",
        ].join(" ")}
      >
        <CustomFieldSetting customField={customField} />
        <button
          type="button"
          aria-label={`Modifier le champ ${customField.label}`}
          className="tw-invisible tw-ml-auto tw-inline-flex tw-pl-2 group-hover:tw-visible"
          onClick={() => setIsEditingField(true)}
        >
          ✏️
        </button>
      </div>
      <EditCustomField
        open={isEditingField}
        editingField={customField}
        data={medicalFiles}
        onClose={() => {
          setIsEditingField(false);
        }}
        onDelete={onDeleteField}
        onSaveField={onSaveField}
        onEditChoice={onEditChoice}
      />
    </>
  );
};

export default MedicalFileSettings;
