import React from "react";
import { toast } from "react-toastify";
import { useRecoilState } from "recoil";
import SelectCustom from "../../components/SelectCustom";
import { organisationState } from "../../recoil/auth";
import API from "../../services/api";
import api from "../../services/apiv2";

const NoOptionsMessage = () => (
  <span style={{ fontSize: 14, textAlign: "center", color: "#808080", width: "100%", display: "block" }}>
    Pas d'option ? Créez une collaboration en tapant directement au-dessus ☝️
  </span>
);

const SelectAndCreateCollaboration = ({ values, onChange, className = "", inputId }) => {
  const [organisation, setOrganisation] = useRecoilState(organisationState);

  const onChangeRequest = (newCollabs) => {
    onChange({ currentTarget: { value: newCollabs || [], name: "collaborations" } });
  };

  const onCreateOption = async (collab) => {
    toast.info("Création de la nouvelle collaboration...");
    onChangeRequest([...(values || []), collab]);
    const response = await api.put(`/organisation/${organisation._id}`, {
      collaborations: [...(organisation.collaborations || []), collab].filter((e) => Boolean(e.trim())),
    });
    if (response.ok) {
      toast.dismiss();
      toast.success("Collaboration créée !");
      setOrganisation(response.data);
      onChangeRequest([...(values || []), collab]);
    } else {
      onChangeRequest(values || []);
    }
  };

  return (
    <SelectCustom
      creatable
      format
      onCreateOption={onCreateOption}
      options={(organisation.collaborations || []).map((collab) => ({ value: collab, label: collab }))}
      value={(values || []).map((opt) => ({ value: opt, label: opt }))}
      isSearchable
      isMulti
      name="collaborations"
      className={className}
      components={{ NoOptionsMessage }}
      onChange={(v) => onChangeRequest(v.map((v) => v.value))}
      placeholder={" -- Ajoutez une co-intervention -- "}
      formatOptionLabel={({ value: collab, __isNew__ }) => {
        if (__isNew__) return <span>Créer "{collab}"</span>;
        return <span>{collab}</span>;
      }}
      inputId={inputId}
      classNamePrefix={inputId}
    />
  );
};

export default SelectAndCreateCollaboration;
