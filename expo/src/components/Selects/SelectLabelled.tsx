import React, { useState } from "react";
import styled, { css } from "styled-components/native";
import { Picker } from "@react-native-picker/picker";
import { Platform, TouchableOpacity, Modal, View } from "react-native";
import InputLabelled from "../InputLabelled";
import { MyText } from "../MyText";

type SelectLabelledProps = {
  editable?: boolean;
  allowCreateOption?: boolean;
  values: string[];
  value: string;
  onSelect: (value: string) => void;
  mappedIdsToLabels?: { _id: string; name: string }[];
  label?: string;
  row?: boolean;
  testID?: string;
};

const SelectLabelled = ({
  editable = true,
  allowCreateOption,
  values,
  value,
  onSelect,
  mappedIdsToLabels,
  label,
  row,
  testID,
}: SelectLabelledProps) => {
  const [saisieLibre, setSaisieLibre] = useState("");

  values = values.includes(value) ? values : [...values, value];

  if (!editable) {
    return <InputLabelled label={label} value={mappedIdsToLabels?.find(({ _id }) => _id === value)?.name || value} editable={false} />;
  }
  return (
    <>
      {Platform.OS === "android" && (
        <SelectAndroid
          value={value}
          values={values}
          onSelect={onSelect}
          mappedIdsToLabels={mappedIdsToLabels}
          label={label}
          row={row}
          testID={testID}
        />
      )}
      {Platform.OS === "ios" && (
        <SelectIos value={value} values={values} onSelect={onSelect} mappedIdsToLabels={mappedIdsToLabels} label={label} row={row} testID={testID} />
      )}
      {allowCreateOption && (
        <InputLabelled onChangeText={setSaisieLibre} value={saisieLibre} placeholder="Autre (précisez)" editable>
          <View className="absolute right-3 justify-center items-center self-center h-full">
            <TouchableOpacity
              onPress={() => {
                onSelect(saisieLibre);
                setSaisieLibre("");
              }}
              className="justify-center border-main75 border items-center self-center flex-row py-2 px-2 rounded-md"
            >
              <MyText className="self-center text-main75 justify-center text-xs">Ajouter</MyText>
            </TouchableOpacity>
          </View>
        </InputLabelled>
      )}
    </>
  );
};

// values has to be array of unique strings
//  -> ['yes', 'no', 'maybe']
//  -> ['55613213efd351de513f', '54321321fe21d2q3a32152', '54321321fe21d2dfbc23d4']
// an array of mapped ids to labels can be provided if necessary
/*
-> [
  { _id: '55613213efd351de513f', name: 'Hospital' },
  { _id: '54321321fe21d2q3a32152', name: 'Home' },
  { _id: '54321321fe21d2dfbc23d4', name: 'Playground' },
]
*/

type SelectAndroidProps = Pick<SelectLabelledProps, "value" | "values" | "onSelect" | "label" | "row" | "mappedIdsToLabels" | "testID">;
const SelectAndroid = ({ value, values, onSelect, label, row, mappedIdsToLabels, testID }: SelectAndroidProps) => (
  <InputContainer row={row} testID={testID}>
    {Boolean(label) && (
      <Label bold row={row}>
        {label}
      </Label>
    )}
    <PickerContainer row={row}>
      <Picker selectedValue={value} onValueChange={(newValue) => onSelect(newValue)}>
        {mappedIdsToLabels?.length
          ? mappedIdsToLabels.map((value, i) => <Picker.Item key={value._id + i} label={value.name} value={value._id} testID={value.name} />)
          : values.map((value, i) => <Picker.Item key={value} label={value} value={value} testID={value} />)}
      </Picker>
    </PickerContainer>
  </InputContainer>
);

const inputRow = css`
  flex-direction: row;
  flex-grow: 1;
  justify-content: space-between;
  align-items: center;
`;
const InputContainer = styled.View<{ row?: boolean }>`
  margin-bottom: 30px;
  ${(props) => props.row && inputRow}
`;

const labelRow = css`
  margin-bottom: 0px;
  margin-right: 40%;
`;
const Label = styled(MyText)<{ debug?: boolean; noMargin?: boolean; row?: boolean }>`
  margin-bottom: 10px;
  font-weight: bold;
  ${(props) => props.debug && "border: 1px solid #00f;"}
  ${(props) => props.noMargin && "margin-bottom: 0px;"}
  ${(props) => props.row && labelRow}
`;

const forModalCss = css`
  background-color: white;
  align-self: center;
  width: 75%;
  border-width: 0px;
`;
const pickerRow = css`
  flex-grow: 1;
  text-align: center;
`;
const PickerContainer = styled.View<{ forModal?: boolean; row?: boolean }>`
  border: 1px solid rgba(30, 36, 55, 0.1);
  border-radius: 12px;
  padding-horizontal: ${Platform.select({ ios: 12, android: 0 })}px;
  ${(props) => props.forModal && forModalCss}
  ${(props) => props.row && pickerRow}
`;

type SelectIosProps = Pick<SelectLabelledProps, "value" | "values" | "onSelect" | "label" | "row" | "mappedIdsToLabels" | "testID">;
const SelectIos = ({ label, value, values, onSelect, row, mappedIdsToLabels }: SelectIosProps) => {
  const [visible, setVisible] = React.useState(false);
  const initValue = React.useRef(value);

  const onSelectRequest = () => {
    setVisible(false);
    initValue.current = value;
  };

  const onCancelRequest = () => {
    setVisible(false);
    onSelect(initValue.current);
  };

  return (
    <>
      <InputContainer row={row} as={TouchableOpacity} onPress={() => setVisible(true)}>
        {Boolean(label) && (
          <Label bold row={row}>
            {label}
          </Label>
        )}
        <Input row={row}>{mappedIdsToLabels?.find(({ _id }) => _id === value)?.name || value}</Input>
      </InputContainer>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancelRequest}>
        <ModalContent>
          <PickerContainer forModal>
            <Picker selectedValue={value} onValueChange={onSelect}>
              {mappedIdsToLabels
                ? mappedIdsToLabels.map((value, i) => <Picker.Item key={value._id + i} label={value.name} value={value._id} />)
                : values.map((value, i) => <Picker.Item key={value} label={value} value={value} />)}
            </Picker>
            <ButtonsContainer>
              <Button withBorder onPress={onCancelRequest}>
                <ButtonText>Annuler</ButtonText>
              </Button>
              <Button onPress={onSelectRequest}>
                <ButtonText bold>OK</ButtonText>
              </Button>
            </ButtonsContainer>
          </PickerContainer>
        </ModalContent>
      </Modal>
    </>
  );
};

const ButtonsContainer = styled.View`
  width: 100%;
  height: 40px;
  border-top-color: #ddd;
  border-top-width: 1px;
  flex-direction: row;
`;

const Button = styled.TouchableOpacity<{ withBorder?: boolean }>`
  border-right-color: #ddd;
  flex-grow: 1;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 50%;
  ${(props) => props.withBorder && "border-right-width: 1px;"}
`;

const ButtonText = styled(MyText)`
  color: #057dff;
  font-size: 18px;
  ${(props) => props.bold && "font-weight: bold;"}
`;

const Input = styled(MyText)<{ row?: boolean }>`
  border: 1px solid rgba(30, 36, 55, 0.1);
  border-radius: 12px;
  padding-horizontal: 12px;
  padding-vertical: 16px;
  ${(props) => props.row && pickerRow}
`;

const ModalContent = styled.View`
  justify-content: center;
  height: 100%;
  background-color: #00000044;
`;

export default SelectLabelled;
