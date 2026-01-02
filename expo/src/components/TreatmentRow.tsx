import React, { useCallback } from "react";
import styled from "styled-components/native";

import ButtonRight from "./ButtonRight";
import RowContainer from "./RowContainer";
import { MyText } from "./MyText";
import DateAndTimeCalendarDisplay from "./DateAndTimeCalendarDisplay";
import { TreatmentInstance } from "@/types/treatment";
import { Dayjs } from "dayjs";

type TreatmentRowProps = {
  onTreatmentPress: (treatment: TreatmentInstance) => void;
  treatment: TreatmentInstance;
  testID?: string;
};

const TreatmentRow = ({ onTreatmentPress, treatment, testID = "treatment" }: TreatmentRowProps) => {
  const name = treatment?.name;
  const dosage = treatment?.dosage;
  const frequency = treatment?.frequency;

  const onRowPress = useCallback(() => {
    onTreatmentPress(treatment);
  }, [treatment, onTreatmentPress]);

  return (
    <RowContainer onPress={onRowPress} testID={`${testID}-row-${name?.split(" ").join("-").toLowerCase()}-button`}>
      <DateAndTimeCalendarDisplay date={treatment.startDate as unknown as Dayjs} topCaption={treatment.endDate ? "Du" : "À partir du"} />
      <DateAndTimeCalendarDisplay date={treatment.endDate as unknown as Dayjs} topCaption="au" />
      <CaptionsContainer>
        <Name bold>{name}</Name>
        <DosageContainer>
          <MyText>{dosage}</MyText>
          <MyText>{frequency}</MyText>
        </DosageContainer>
      </CaptionsContainer>
      <ButtonRight onPress={onRowPress} caption=">" />
    </RowContainer>
  );
};

const CaptionsContainer = styled.View`
  flex-grow: 1;
  flex-shrink: 1;
  align-items: center;
`;

const Name = styled(MyText)`
  font-weight: bold;
  font-size: 17px;
  text-align: center;
`;

const DosageContainer = styled.View`
  align-self: center;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  margin-top: 5px;
`;

export default TreatmentRow;
