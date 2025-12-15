import React, { useCallback, useMemo } from "react";
import styled from "styled-components/native";
import { View } from "react-native";
import { useAtomValue } from "jotai";
import ButtonRight from "./ButtonRight";
import RowContainer from "./RowContainer";
import { MyText } from "./MyText";
import colors from "../utils/colors";
import TeamsTags from "./TeamsTags";
import { DONE, TODO } from "../recoil/actions";
import DateAndTimeCalendarDisplay from "./DateAndTimeCalendarDisplay";
import { organisationState } from "../recoil/auth";
import { itemsGroupedByPersonSelector } from "../recoil/selectors";
import RepeatIcon from "../icons/RepeatIcon";
import UserName from "./UserName";
import { ActionInstance } from "@/types/action";
import { PersonInstance } from "@/types/person";
import { dayjsInstance } from "@/services/dateDayjs";

type ActionRowProps = {
  onActionPress: (action: ActionInstance) => void;
  onPseudoPress: (person: PersonInstance) => void;
  showStatus: boolean;
  action: ActionInstance;
  withTeamName: boolean;
  testID: string;
};

const ActionRow = ({ onActionPress, onPseudoPress, showStatus, action, withTeamName, testID = "action" }: ActionRowProps) => {
  const personsObject = useAtomValue(itemsGroupedByPersonSelector) as Record<string, PersonInstance>;
  const organisation = useAtomValue(organisationState)!;

  const name = action?.name?.trim() || action?.categories?.join(", ") || "Action";
  const status = action?.status;
  const withTime = action?.withTime;
  const urgent = action?.urgent;
  const user = action?.user;
  const person = useMemo(() => (action?.person ? personsObject[action.person] : null), [personsObject, action.person]);
  const pseudo = person?.name;
  const dueAt = action?.dueAt ? dayjsInstance(action?.dueAt) : null;
  const completedAt = action?.completedAt ? dayjsInstance(action?.completedAt) : null;

  const onPseudoContainerPress = useCallback(() => {
    if (person) onPseudoPress(person);
  }, [person, onPseudoPress]);

  const onRowPress = useCallback(() => {
    onActionPress(action);
  }, [action, onActionPress]);

  return (
    <RowContainer onPress={onRowPress} testID={`${testID}-row-${name?.split(" ").join("-").toLowerCase()}-button`}>
      <DateAndTimeCalendarDisplay date={status === TODO ? dueAt : completedAt} withTime={withTime} />
      <CaptionsContainer>
        <View className="flex-row items-center">
          {!!organisation.groupsEnabled && !!action.group && (
            <View className="mr-2 shrink-0">
              <MyText>👪</MyText>
            </View>
          )}
          {!!action.recurrence && (
            <View className="mr-2 shrink-0">
              <RepeatIcon className="w-5 h-5" />
            </View>
          )}
          <Name bold>{name}</Name>
        </View>
        {!!withTeamName && <TeamsTags teams={Array.isArray(action.teams) ? action.teams! : [action.team!]} />}
        {showStatus ? (
          <StatusContainer>
            <Status color={colors.app[status === DONE ? "color" : "secondary"]}>{status}</Status>
          </StatusContainer>
        ) : pseudo ? (
          <PseudoContainer onPress={onPseudoContainerPress} testID={`${testID}-row-person-${pseudo?.split(" ").join("-").toLowerCase()}-button`}>
            <Pseudo>Pour {pseudo}</Pseudo>
          </PseudoContainer>
        ) : null}
        {urgent ? <Urgent bold>❗ Action prioritaire</Urgent> : null}
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
      <ButtonRight onPress={onRowPress} caption=">" />
    </RowContainer>
  );
};

const CaptionsContainer = styled.View`
  margin-horizontal: 15px;
  flex-grow: 1;
  flex-shrink: 1;
`;

const Name = styled(MyText)`
  font-weight: bold;
  font-size: 17px;
`;

const Urgent = styled(MyText)`
  font-weight: bold;
  font-size: 17px;
  margin-top: 10px;
  color: red;
`;

const StatusContainer = styled.View`
  margin-top: 15px;
  align-self: flex-start;
`;

const Status = styled(MyText)`
  /* text-decoration: underline; */
  flex-grow: 0;
  align-self: flex-start;
  color: ${(props) => props.color};
`;

const PseudoContainer = styled.TouchableOpacity`
  margin-top: 15px;
  align-self: flex-start;
  flex-direction: row;
`;

const Pseudo = styled(MyText)`
  /* text-decoration: underline; */
  flex-grow: 0;
  align-self: flex-start;
  color: ${colors.app.color};
`;

const UserContainer = styled.View`
  margin-top: 15px;
  margin-bottom: -20px;
  align-self: flex-start;
`;

export default ActionRow;
