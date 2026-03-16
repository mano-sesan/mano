import React, { useRef } from "react";
import { useAtomValue } from "jotai";
import { ScrollView, View } from "react-native";
import ScrollContainer from "../../components/ScrollContainer";
import SubHeader from "../../components/SubHeader";
import Spacer from "../../components/Spacer";
import ButtonsContainer from "../../components/ButtonsContainer";
import Button from "../../components/Button";
import colors from "../../utils/colors";
import CustomFieldInput from "../../components/CustomFieldInput";
import { currentTeamState } from "../../recoil/auth";
import { PersonInstance } from "@/types/person";
import { CustomField } from "@/types/field";
import { useEditButtonStatusOnFocused } from "@/utils/hide-edit-button";

type PersonSectionProps = {
  onBack: () => void;
  backgroundColor: string;
  onChange: (newPersonState: Partial<PersonInstance>, forceUpdate?: boolean) => void;
  onUpdatePerson: () => Promise<boolean>;
  onEdit: () => void;
  person: Omit<PersonInstance, "_id">;
  personDB: PersonInstance;
  isUpdateDisabled: boolean;
  editable: boolean;
  updating: boolean;
  fields: CustomField[];
  name: string;
};

const PersonSection = ({
  onBack,
  editable,
  onChange,
  onUpdatePerson,
  onEdit,
  isUpdateDisabled,
  updating,
  backgroundColor,
  person,
  fields,
  name: sectionName,
}: PersonSectionProps) => {
  const currentTeam = useAtomValue(currentTeamState)!;
  const scrollViewRef = useRef<ScrollView>(null);
  useEditButtonStatusOnFocused("show");
  return (
    <>
      <SubHeader backgroundColor={backgroundColor || colors.app.color} onBack={onBack} caption={sectionName} />
      <ScrollContainer noRadius ref={scrollViewRef} backgroundColor={backgroundColor || colors.app.color}>
        <View>
          {!editable && <Spacer />}
          {(fields || [])
            .filter((f) => f)
            .filter((f) => f.enabled || f.enabledTeams?.includes(currentTeam._id))
            .map((field) => {
              const { label, name } = field;
              return (
                <CustomFieldInput
                  label={label}
                  key={label}
                  field={field}
                  value={person[name]}
                  handleChange={(newValue) => onChange({ [name]: newValue })}
                  editable={editable}
                />
              );
            })}
          <ButtonsContainer>
            <Button
              caption={editable ? "Mettre à jour" : "Modifier"}
              onPress={editable ? onUpdatePerson : onEdit}
              disabled={editable ? isUpdateDisabled : false}
              loading={updating}
            />
          </ButtonsContainer>
        </View>
      </ScrollContainer>
    </>
  );
};

export default PersonSection;
