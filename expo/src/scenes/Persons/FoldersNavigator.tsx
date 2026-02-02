import React from "react";
import { createStackNavigator, StackScreenProps } from "@react-navigation/stack";
import Row from "../../components/Row";
import PersonSection from "./PersonSection";
import ScrollContainer from "../../components/ScrollContainer";
import Spacer from "../../components/Spacer";
import colors from "../../utils/colors";
import Documents from "./Documents";
import MedicalFile from "./MedicalFile";
import { useAtomValue } from "jotai";
import { organisationState, userState } from "../../recoil/auth";
import Group from "./Group";
import { customFieldsPersonsSelector } from "../../recoil/persons";
import { FoldersStackParams, RootStackParamList } from "@/types/navigation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PersonInstance } from "@/types/person";

const FoldersStack = createStackNavigator<FoldersStackParams>();

type FoldersNavigatorProps = NativeStackScreenProps<RootStackParamList, "PERSON_STACK"> & {
  backgroundColor: string;
  onChange: (newPersonState: Partial<PersonInstance>, forceUpdate?: boolean) => void;
  onUpdatePerson: () => Promise<boolean>;
  onEdit: () => void;
  person: Omit<PersonInstance, "_id">;
  personDB: PersonInstance;
  isUpdateDisabled: boolean;
  editable: boolean;
  updating: boolean;
};

const FoldersNavigator = (props: FoldersNavigatorProps) => {
  const user = useAtomValue(userState);
  const customFieldsPersons = useAtomValue(customFieldsPersonsSelector);
  return (
    <FoldersStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="FOLDERS_SUMMARY">
      <FoldersStack.Screen name="FOLDERS_SUMMARY">{(stackProps) => <FoldersSummary {...props} {...stackProps} />}</FoldersStack.Screen>
      {customFieldsPersons.map(({ name, fields }) => {
        return (
          <FoldersStack.Screen key={name} name={name}>
            {(stackProps) => <PersonSection name={name} fields={fields} onBack={() => stackProps.navigation.goBack()} {...props} {...stackProps} />}
          </FoldersStack.Screen>
        );
      })}
      <FoldersStack.Screen name="DOCUMENTS_MANO">{(stackProps) => <Documents {...props} {...stackProps} />}</FoldersStack.Screen>
      <FoldersStack.Screen name="GROUP">{(stackProps) => <Group {...props} {...stackProps} />}</FoldersStack.Screen>
      {!!user?.healthcareProfessional && (
        <FoldersStack.Screen name="MEDICAL_FILE">
          {(stackProps) => <MedicalFile {...props} onBack={() => stackProps.navigation.goBack()} />}
        </FoldersStack.Screen>
      )}
    </FoldersStack.Navigator>
  );
};

export default FoldersNavigator;

type FoldersSummaryProps = {
  navigation: StackScreenProps<FoldersStackParams, "FOLDERS_SUMMARY">["navigation"];
  backgroundColor: string;
};
const FoldersSummary = ({ navigation, backgroundColor }: FoldersSummaryProps) => {
  const user = useAtomValue(userState)!;
  const organisation = useAtomValue(organisationState)!;
  const customFieldsPersons = useAtomValue(customFieldsPersonsSelector)!;

  return (
    <ScrollContainer noPadding backgroundColor={backgroundColor || colors.app.color}>
      <Spacer />
      {customFieldsPersons.map(({ name }) => {
        return <Row key={name} withNextButton caption={name} onPress={() => navigation.navigate(name)} />;
      })}
      <Spacer />
      <Row withNextButton caption="📁   Documents" onPress={() => navigation.navigate("DOCUMENTS_MANO")} />
      {!!organisation.groupsEnabled && <Row withNextButton caption="👪   Liens Familiaux" onPress={() => navigation.navigate("GROUP")} />}
      {!!user?.healthcareProfessional && (
        <>
          <Spacer />
          <Row withNextButton caption="🩺   Dossier médical" onPress={() => navigation.navigate("MEDICAL_FILE")} />
        </>
      )}
    </ScrollContainer>
  );
};
