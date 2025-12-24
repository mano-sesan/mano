import React, { useCallback, useMemo } from "react";
import styled from "styled-components/native";

import ButtonRight from "./ButtonRight";
import RowContainer from "./RowContainer";
import { MyText } from "./MyText";
import colors from "../utils/colors";

import { DONE, TODO } from "../recoil/actions";
import UserName from "./UserName";
import DateAndTimeCalendarDisplay from "./DateAndTimeCalendarDisplay";
import { useAtomValue } from "jotai";
import { userState } from "../recoil/auth";
import { StyleSheet } from "react-native";
import { consultationIsVisibleByMe, disableConsultationRow } from "../recoil/consultations";
import { itemsGroupedByPersonSelector } from "../recoil/selectors";
import { ConsultationInstance } from "@/types/consultation";
import { PersonInstance } from "@/types/person";
import { dayjsInstance } from "@/services/dateDayjs";

type ConsultationRowProps = {
  onConsultationPress: (consultation: ConsultationInstance, person: PersonInstance) => void;
  consultation: ConsultationInstance;
  testID?: string;
  withBadge?: boolean;
  showStatus?: boolean;
  showPseudo?: boolean;
  onPseudoPress?: (person: PersonInstance) => void;
};
const ConsultationRow = ({
  onConsultationPress,
  consultation,
  testID = "consultation",
  withBadge = false,
  showStatus,
  showPseudo,
  onPseudoPress,
}: ConsultationRowProps) => {
  const personsObject = useAtomValue(itemsGroupedByPersonSelector);

  const me = useAtomValue(userState)!;

  const name = disableConsultationRow(consultation, me) ? "" : consultation.name || `Consultation ${consultation.type}`;
  const type = disableConsultationRow(consultation, me) ? "" : consultation.type;
  const status = consultation.status;
  const user = consultation.user;
  const person = useMemo(() => (consultation?.person ? personsObject?.[consultation.person] : null), [personsObject, consultation.person]);
  const pseudo = person?.name;
  const visibleByMe = consultationIsVisibleByMe(consultation, me);

  const dueAt = consultation?.dueAt ? dayjsInstance(consultation?.dueAt) : null;
  const completedAt = consultation?.completedAt ? dayjsInstance(consultation?.completedAt) : null;

  const onRowPress = useCallback(() => {
    if (!visibleByMe) return;
    if (person) onConsultationPress(consultation, person);
  }, [consultation, onConsultationPress, visibleByMe, person]);

  const onPseudoContainerPress = useCallback(() => {
    if (person && onPseudoPress) onPseudoPress(person);
  }, [person, onPseudoPress]);

  return (
    <RowContainer
      styles={styles}
      disabled={!visibleByMe}
      onPress={onRowPress}
      testID={`${testID}-row-${name?.split(" ").join("-").toLowerCase()}-button`}
    >
      {!!withBadge && (
        <ConsultationBadge>
          <MyText>🩺</MyText>
        </ConsultationBadge>
      )}
      <DateAndTimeCalendarDisplay date={status === TODO ? dueAt : completedAt} withTime />
      <CaptionsContainer>
        <Name>{name}</Name>
        <Type>{type}</Type>
        {showStatus ? (
          <>
            <StatusContainer>
              <Status color={colors.app[status === DONE ? "color" : "secondary"]}>{status}</Status>
            </StatusContainer>
          </>
        ) : showPseudo && pseudo ? (
          <PseudoContainer onPress={onPseudoContainerPress} testID={`${testID}-row-person-${pseudo?.split(" ").join("-").toLowerCase()}-button`}>
            <Pseudo>Pour {pseudo}</Pseudo>
          </PseudoContainer>
        ) : null}
        <UserContainer>
          {!!user && (
            <UserName
              caption="Créée par"
              // @ts-expect-error user is a string
              id={user?._id || user}
            />
          )}
        </UserContainer>
      </CaptionsContainer>
      <ButtonRight onPress={onRowPress} caption=">" disabled={!visibleByMe} />
    </RowContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    // borderWidth: 2,
    // borderColor: '#0a69da',
    backgroundColor: "#ddf4ff",
  },
  subContainer: {},
});

const CaptionsContainer = styled.View`
  margin-horizontal: 15px;
  flex-grow: 1;
  flex-shrink: 1;
`;

const Name = styled(MyText)`
  font-weight: bold;
  font-size: 17px;
`;

const Type = styled(MyText)`
  font-size: 12px;
  opacity: 0.5;
`;

const StatusContainer = styled.View`
  margin-top: 15px;
  align-self: flex-start;
`;

const UserContainer = styled.View`
  margin-top: 15px;
  margin-bottom: -20px;
  align-self: flex-start;
`;

const Status = styled(MyText)`
  /* text-decoration: underline; */
  flex-grow: 0;
  align-self: flex-start;
  color: ${(props) => props.color};
`;

const ConsultationBadge = styled.View`
  position: absolute;
  top: 8px;
  right: 8px;

  background-color: #fef2f2;
  width: 30px;
  height: 30px;
  border-radius: 30px;
  font-size: 15px;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 2px solid #0a69da;
`;

const PseudoContainer = styled.TouchableOpacity`
  margin-top: 15px;
  align-self: flex-start;
`;

const Pseudo = styled(MyText)`
  /* text-decoration: underline; */
  flex-grow: 0;
  align-self: flex-start;
  color: ${colors.app.color};
`;
export default ConsultationRow;
