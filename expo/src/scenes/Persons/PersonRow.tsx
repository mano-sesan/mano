import React from "react";
import styled from "styled-components/native";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useActionSheet } from "@expo/react-native-action-sheet";
import * as Sentry from "@sentry/react-native";
import ButtonTopPlus from "../../components/ButtonTopPlus";
import { MyText } from "../../components/MyText";
import RowContainer from "../../components/RowContainer";
import TeamsTags from "../../components/TeamsTags";
import colors from "../../utils/colors";
import { useAtomValue } from "jotai";
import { organisationState, userState } from "../../recoil/auth";
import { PersonInstance } from "@/types/person";
import { RootStackParamList } from "@/types/navigation";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type PersonRowProps = {
  onPress: () => void;
  person: PersonInstance;
  isPersonsSearchRow?: boolean;
  children?: React.ReactNode;
};

export default function PersonRow({ onPress, person, isPersonsSearchRow = false, children }: PersonRowProps) {
  const { outOfActiveList, formattedBirthDate, alertness } = person;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const organisation = useAtomValue(organisationState)!;
  const user = useAtomValue(userState)!;
  const { showActionSheetWithOptions } = useActionSheet();

  const onMorePress = async () => {
    const options = [
      "Ajouter une action",
      ...(user.healthcareProfessional ? ["Ajouter une consultation"] : []),
      ...(["admin", "normal"].includes(user.role) ? ["Ajouter un commentaire", "Ajouter un lieu fréquenté"] : []),
      "Annuler",
    ];

    if (organisation.rencontresEnabled) {
      options.unshift("Ajouter une rencontre");
    }
    if (organisation.passagesEnabled) {
      options.unshift("Ajouter un passage");
    }

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
      },
      async (buttonIndex) => {
        Sentry.setContext("person", { _id: person._id });
        if (options[buttonIndex!] === "Ajouter une rencontre") {
          navigation.push("RENCONTRE", { person });
        }
        if (options[buttonIndex!] === "Ajouter un passage") {
          navigation.push("PASSAGE", { person });
        }
        if (options[buttonIndex!] === "Ajouter une action") {
          navigation.push("ACTION_NEW_STACK", { person });
        }
        if (user.healthcareProfessional && options[buttonIndex!] === "Ajouter une consultation") {
          navigation.push("CONSULTATION_STACK", { personDB: person });
        }
        if (options[buttonIndex!] === "Ajouter un commentaire") {
          navigation.push("COMMENT", { person, commentTitle: person.name });
        }
        if (options[buttonIndex!] === "Ajouter un lieu fréquenté") {
          navigation.push("PLACE_NEW", { person });
        }
      }
    );
  };

  return (
    <RowContainer onPress={onPress}>
      <CaptionsContainer>
        <CaptionsFirstLine>
          {Boolean(alertness) && (
            <ExclamationMarkButton>
              <ExclamationMark>!</ExclamationMark>
            </ExclamationMarkButton>
          )}
          {!!organisation.groupsEnabled && !!person.group && (
            <View className="mr-2 shrink-0">
              <MyText>👪</MyText>
            </View>
          )}
          <PersonName person={person} />
          {!isPersonsSearchRow && <ButtonTopPlus onPress={onMorePress} />}
        </CaptionsFirstLine>
        {formattedBirthDate && !outOfActiveList && <Birthdate>{formattedBirthDate}</Birthdate>}
        {formattedBirthDate && outOfActiveList && <BirthdateMuted>{formattedBirthDate}</BirthdateMuted>}
        {children}
        <TeamsTags teams={person.assignedTeams || []} />
      </CaptionsContainer>
    </RowContainer>
  );
}

type PersonNameProps = { person: Pick<PersonInstance, "name" | "outOfActiveList" | "outOfActiveListReasons" | "otherNames"> };

export const PersonName = ({ person: { name, outOfActiveList, outOfActiveListReasons, otherNames } }: PersonNameProps) => {
  if (outOfActiveList) {
    return (
      <OutOfActiveListContainer>
        {Boolean(otherNames) ? (
          <PseudoNameContainer>
            <NameMuted>{name}</NameMuted>
            <PseudoMuted>{otherNames}</PseudoMuted>
          </PseudoNameContainer>
        ) : (
          <NameMuted>{name}</NameMuted>
        )}
        <ActiveListReasonText>Sortie de file active : {outOfActiveListReasons?.join(", ")}</ActiveListReasonText>
      </OutOfActiveListContainer>
    );
  }
  if (otherNames) {
    return (
      <PseudoNameContainer>
        <Name>{name}</Name>
        <Pseudo>{otherNames}</Pseudo>
      </PseudoNameContainer>
    );
  }
  return <Name>{name}</Name>;
};

const OutOfActiveListContainer = styled.View`
  flex-grow: 1;
  flex-shrink: 1;
`;

const CaptionsContainer = styled.View`
  margin: 0 12px;
  flex-grow: 1;
`;

const CaptionsFirstLine = styled.View`
  flex-direction: row;
  width: 100%;
  max-width: 100%;
  align-items: center;
`;

const Birthdate = styled(MyText)`
  margin-top: 10px;
  color: ${colors.app.color};
`;

const BirthdateMuted = styled(Birthdate)`
  color: ${colors.app.colorGrey};
`;

const Name = styled(MyText)`
  font-weight: bold;
  font-size: 20px;
  flex-grow: 1;
  flex-shrink: 1;
`;

const Pseudo = styled(MyText)`
  color: #666;
  font-size: 16px;
  flex-grow: 1;
  flex-shrink: 1;
`;

const PseudoMuted = styled(Pseudo)`
  color: #aaa;
`;

const PseudoNameContainer = styled.View`
  flex-direction: col;
`;

const NameMuted = styled(Name)`
  color: ${colors.app.colorGrey};
`;

const ActiveListReasonText = styled(MyText)`
  font-size: 16px;
  color: ${colors.app.colorGrey};
`;

const ExclamationMarkButton = styled.View`
  width: 20px;
  height: 20px;
  border-radius: 20px;
  margin-right: 10px;
  box-shadow: none;
  border: 2px solid #dc2626;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #fef2f2;
  flex-shrink: 0;
`;

const ExclamationMark = styled(MyText)`
  font-size: 14px;
  line-height: 16px;
  font-weight: bold;
  color: #dc2626;
`;
