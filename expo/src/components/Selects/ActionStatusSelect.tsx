import React from "react";
import styled from "styled-components/native";
import { CANCEL, CHOOSE, DONE, mappedIdsToLabels, TODO } from "../../recoil/actions";
import colors from "../../utils/colors";
import Button from "../Button";
import SelectLabelled from "./SelectLabelled";
import { ActionStatus } from "@/types/action";

type ActionStatusSelectProps = {
  value?: string;
  onSelect: (value: ActionStatus) => void;
  onSelectAndSave: (value: ActionStatus) => void;
  editable?: boolean;
  testID?: string;
};

// prettier-ignore
const statuses = [
  TODO,
  DONE,
  CANCEL,
];

const ActionStatusSelect = ({ value = CHOOSE, onSelect, onSelectAndSave, editable, testID = "action-status" }: ActionStatusSelectProps) => {
  if (!editable) {
    return (
      <Container>
        <SelectLabelled
          label="Statut"
          values={statuses}
          mappedIdsToLabels={mappedIdsToLabels}
          value={value}
          // @ts-expect-error '(value: ActionStatus) => void' is not assignable to type '(value: string) => void'.
          onSelect={onSelect}
          editable={editable}
          testID={testID}
        />
        <ButtonsContainer>
          {value !== CANCEL && (
            <>
              <Button
                buttonSize={20}
                borderColor="#00F"
                color="#fff"
                backgroundColor="#00F"
                onPress={() => onSelectAndSave(CANCEL)}
                caption="ANNULER"
              />
              <Spacer />
            </>
          )}
          <Button
            borderColor={value === TODO ? colors.app.color : undefined}
            color={value === TODO ? "#fff" : colors.app.color}
            buttonSize={20}
            backgroundColor={value === TODO ? colors.app.color : undefined}
            onPress={() => onSelectAndSave(value === TODO ? DONE : TODO)}
            caption={value === TODO ? DONE : TODO}
          />
        </ButtonsContainer>
      </Container>
    );
  }
  return (
    <SelectLabelled
      label="Status"
      values={statuses}
      mappedIdsToLabels={mappedIdsToLabels}
      value={value}
      // @ts-expect-error '(value: ActionStatus) => void' is not assignable to type '(value: string) => void'.
      onSelect={onSelect}
      editable={editable}
      testID={testID}
    />
  );
};

const Container = styled.View`
  flex-direction: row;
`;

const ButtonsContainer = styled.View`
  margin-top: 20px;
  flex-direction: row;
`;

const Spacer = styled.View`
  width: 10px;
`;

export default ActionStatusSelect;
