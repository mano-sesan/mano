import React, { useCallback, useMemo, useRef } from "react";
import { Alert, Linking, Text } from "react-native";
import styled from "styled-components/native";
import * as Sentry from "@sentry/react-native";
import { useAtomValue, useSetAtom } from "jotai";
import dayjs from "dayjs";
import ScrollContainer from "../../components/ScrollContainer";
import Button from "../../components/Button";
import InputLabelled from "../../components/InputLabelled";
import ButtonsContainer from "../../components/ButtonsContainer";
import ActionRow from "../../components/ActionRow";
import CommentRow from "../Comments/CommentRow";
import PlaceRow from "../Places/PlaceRow";
import SubList from "../../components/SubList";
import DateAndTimeInput from "../../components/DateAndTimeInput";
import GenderSelect from "../../components/Selects/GenderSelect";
import Spacer from "../../components/Spacer";
import NewCommentInput from "../Comments/NewCommentInput";
import CheckboxLabelled from "../../components/CheckboxLabelled";
import TeamsMultiCheckBoxes from "../../components/MultiCheckBoxes/TeamsMultiCheckBoxes";
import colors from "../../utils/colors";
import PhoneIcon from "../../icons/PhoneIcon";
import { placesState } from "../../recoil/places";
import { organisationState, teamsState, userState } from "../../recoil/auth";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";
import RencontreRow from "./RencontreRow";
import { itemsGroupedByPersonSelector } from "../../recoil/selectors";
import { formatDateWithFullMonth, getRelativeTimeFrench } from "../../services/dateDayjs";
import { commentsState, prepareCommentForEncryption } from "../../recoil/comments";
import { groupsState } from "../../recoil/groups";
import API from "../../services/api";
import PassageRow from "./PassageRow";
import { actionsWithoutFutureRecurrences } from "../../utils/recurrence";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { PersonInstance } from "@/types/person";
import { PassageInstance } from "@/types/passage";
import { RencontreInstance } from "@/types/rencontre";
import { UUIDV4 } from "@/types/uuid";
import { PlaceInstance } from "@/types/place";
import { ActionInstance } from "@/types/action";

type PersonSummaryProps = NativeStackScreenProps<RootStackParamList, "PERSON_STACK"> & {
  person: Omit<PersonInstance, "_id">;
  personDB: PersonInstance;
  onUpdatePerson: (alert?: boolean, stateToMerge?: Partial<PersonInstance>) => Promise<boolean>;
  updating: boolean;
  editable: boolean;
  onEdit: () => void;
  isUpdateDisabled: boolean;
  backgroundColor: string;
  onCommentWrite: (comment: string) => void;
  onChange: (newPersonState: Partial<PersonInstance>, forceUpdate?: boolean) => void;
  onDelete: () => Promise<boolean>;
  onBack: () => void;
  onRemoveFromActiveList: () => void;
  onAddActionRequest: () => void;
};

const PersonSummary = ({
  navigation,
  person,
  personDB,
  onUpdatePerson,
  updating,
  editable,
  onEdit,
  isUpdateDisabled,
  backgroundColor,
  onCommentWrite,
  onChange,
  onDelete,
  onBack,
  onRemoveFromActiveList,
  onAddActionRequest,
}: PersonSummaryProps) => {
  const user = useAtomValue(userState)!;
  const organisation = useAtomValue(organisationState)!;
  const setComments = useSetAtom(commentsState);
  const groups = useAtomValue(groupsState)!;

  const scrollViewRef = useRef(null);
  const newCommentRef = useRef(null);

  const onAddRencontre = async () => navigation.push("RENCONTRE", { person: personDB });
  const onUpdateRencontre = async (rencontre: RencontreInstance) => navigation.push("RENCONTRE", { person: personDB, rencontre });

  const onAddPassage = async () => navigation.push("PASSAGE", { person: personDB });
  const onUpdatePassage = async (passage: PassageInstance) => navigation.push("PASSAGE", { person: personDB, passage });

  const onGetBackToActiveList = async () => {
    await onUpdatePerson(false, { outOfActiveListReasons: [], outOfActiveList: false });
  };

  const populatedPersons = useAtomValue(itemsGroupedByPersonSelector);
  const populatedPerson = useMemo(() => populatedPersons[personDB?._id] || {}, [populatedPersons, personDB?._id]);
  const { actions, comments, rencontres, passages, relsPersonPlace } = populatedPerson;

  const sortedActions = useMemo(
    () => [...(actionsWithoutFutureRecurrences(actions || []) || [])].sort((p1, p2) => (p1.dueAt! > p2.dueAt! ? -1 : 1)),
    [actions]
  );
  const sortedComments = useMemo(
    () => [...(comments || [])].sort((c1, c2) => ((c1.date || c1.createdAt) > (c2.date || c2.createdAt) ? -1 : 1)),
    [comments]
  );
  const sortedRencontres = useMemo(() => [...(rencontres || [])].sort((r1, r2) => (r1.date > r2.date ? -1 : 1)), [rencontres]);
  const sortedPassages = useMemo(() => [...(passages || [])].sort((r1, r2) => (r1.date > r2.date ? -1 : 1)), [passages]);
  const sortedRelPersonPlace = useMemo(
    () => [...(relsPersonPlace || [])].sort((r1, r2) => (r1.createdAt > r2.createdAt ? -1 : 1)),
    [relsPersonPlace]
  );

  const allPlaces = useAtomValue(placesState) as PlaceInstance[];
  const places = useMemo(() => {
    if (!relsPersonPlace) return [];
    const placesId: UUIDV4[] = relsPersonPlace.map((rel) => rel.place);
    return allPlaces.filter((pl) => placesId.includes(pl._id!));
  }, [allPlaces, relsPersonPlace]);
  const onAddPlaceRequest = () => navigation.push("PLACE_NEW", { person: personDB });

  const teams = useAtomValue(teamsState);

  const onActionPress = useCallback(
    (action: ActionInstance) => {
      Sentry.setContext("action", { _id: action._id });
      navigation.push("ACTION_STACK", { action });
    },
    [navigation]
  );

  return (
    <ScrollContainer ref={scrollViewRef} backgroundColor={backgroundColor || colors.app.color} testID="person-summary">
      {person.outOfActiveList && (
        <AlterOutOfActiveList>
          <Text style={{ color: colors.app.colorWhite }}>
            {person?.name} est en dehors de la file active, pour{" "}
            {person?.outOfActiveListReasons?.length > 1 ? "les motifs suivants" : "le motif suivant"} : {person.outOfActiveListReasons.join(", ")}
            {person?.outOfActiveListDate && `le ${formatDateWithFullMonth(person.outOfActiveListDate)}`}
          </Text>
        </AlterOutOfActiveList>
      )}
      <InputLabelled
        label="Nom prénom ou Pseudonyme"
        onChangeText={(name) => onChange({ name })}
        value={person.name}
        placeholder="Monsieur X"
        editable={editable}
      />
      <InputLabelled
        label="Autres pseudos"
        onChangeText={(otherNames) => onChange({ otherNames })}
        value={person.otherNames}
        placeholder="Mister X, ..."
        editable={editable}
      />
      <GenderSelect onSelect={(gender) => onChange({ gender })} value={person.gender} editable={editable} />
      {editable ? (
        <DateAndTimeInput
          label="Date de naissance"
          // @ts-expect-error Type 'PossibleDate' is not assignable to type 'Date | undefined'.
          setDate={(birthdate) => onChange({ birthdate })}
          date={person.birthdate}
          editable={editable}
          showYear
        />
      ) : (
        <InputLabelled label="Âge" value={populatedPerson.formattedBirthDate} placeholder="JJ-MM-AAAA" editable={false} />
      )}
      {editable ? (
        <DateAndTimeInput
          label="Suivi(e) depuis / Créé(e) le"
          // @ts-expect-error Type 'PossibleDate' is not assignable to type 'Date | undefined'.
          setDate={(followedSince) => onChange({ followedSince })}
          date={person.followedSince}
          editable={editable}
          showYear
        />
      ) : (
        <InputLabelled
          label="Suivi(e) depuis / Créé(e) il y a"
          value={`${getRelativeTimeFrench(dayjs(), person.followedSince)} (${dayjs(person.followedSince).format("DD/MM/YYYY")})`}
          placeholder="JJ-MM-AAAA"
          editable={false}
        />
      )}
      {editable ? (
        <DateAndTimeInput
          label="En rue depuis le"
          // @ts-expect-error Type 'PossibleDate' is not assignable to type 'Date | undefined'.
          setDate={(wanderingAt) => onChange({ wanderingAt })}
          date={person.wanderingAt}
          editable={editable}
          showYear
        />
      ) : (
        <InputLabelled
          label="En rue depuis"
          value={
            person.wanderingAt
              ? `${getRelativeTimeFrench(dayjs(), person.wanderingAt)} (${dayjs(person.wanderingAt).format("DD/MM/YYYY")})`
              : undefined
          }
          placeholder="JJ-MM-AAAA"
          editable={false}
        />
      )}
      <Row>
        <InputLabelled
          label="Téléphone"
          onChangeText={(phone) => onChange({ phone })}
          value={person.phone}
          placeholder="06 12 52 32 13"
          textContentType="telephoneNumber"
          keyboardType="phone-pad"
          autoCorrect={false}
          editable={editable}
          noMargin={editable || !!personDB?.phone?.length}
        />
        <Spacer />
        {!!personDB?.phone?.length && (
          <Button
            caption="Appeler"
            Icon={PhoneIcon}
            color={colors.app.secondary}
            onPress={() => Linking.openURL("tel:" + personDB?.phone?.split(" ").join(""))}
            noBorder
          />
        )}
      </Row>
      <InputLabelled
        label="Description"
        onChangeText={(description) => onChange({ description })}
        value={person.description}
        placeholder="Description"
        multiline
        editable={editable}
      />
      <CheckboxLabelled
        _id={personDB?._id}
        label="Personne vulnérable, ou ayant besoin d'une attention particulière"
        alone
        onPress={() => onChange({ alertness: !person.alertness }, true)}
        value={person.alertness}
      />
      <TeamsMultiCheckBoxes
        values={teams.filter((t) => (person.assignedTeams || []).includes(t._id)).map((t) => t.name)}
        onChange={(newAssignedTeams) =>
          onChange({
            assignedTeams: newAssignedTeams.map((teamName) => teams.find((t) => t.name === teamName)?._id!),
          })
        }
        editable={editable}
      />
      {!editable && <Spacer />}
      <ButtonsContainer>
        <DeleteButtonAndConfirmModal
          title={`Voulez-vous vraiment supprimer ${personDB?.name} ?`}
          onBack={onBack}
          textToConfirm={personDB?.name}
          roles={["normal", "admin"]}
          roleErrorMessage="Désolé, seules les personnes autorisées peuvent supprimer des personnes"
          onDelete={onDelete}
        >
          Cette opération est irréversible{"\n"}et entrainera la suppression définitive{"\n"}de toutes les données liées à la personne&nbsp;:{"\n\n"}
          actions, commentaires, lieux visités, passages, rencontres, documents...
        </DeleteButtonAndConfirmModal>
        <Button
          caption={editable ? "Mettre à jour" : "Modifier"}
          onPress={editable ? onUpdatePerson : onEdit}
          disabled={editable ? isUpdateDisabled : false}
          loading={updating}
        />
      </ButtonsContainer>
      <ButtonsContainer>
        <Button
          caption={person.outOfActiveList ? "Réintégrer dans la file active" : "Sortie de file active"}
          onPress={() => (person.outOfActiveList ? onGetBackToActiveList() : onRemoveFromActiveList())}
          color={colors.warning.color}
        />
      </ButtonsContainer>

      <SubList
        label="Actions"
        onAdd={onAddActionRequest}
        testID="person-actions-list"
        data={sortedActions}
        renderItem={(action, index: number) => (
          <ActionRow key={index} action={action} showStatus withTeamName testID="person-action" onActionPress={onActionPress} />
        )}
        ifEmpty="Pas encore d'action"
      />
      {["admin", "normal"].includes(user.role) && (
        <SubList
          label="Commentaires"
          data={sortedComments}
          renderItem={(comment) => (
            <CommentRow
              key={comment._id}
              comment={comment}
              canToggleGroupCheck={!!organisation.groupsEnabled && !!groups.find((group) => group.persons.includes(personDB?._id))}
              canToggleUrgentCheck
              onDelete={async () => {
                const response = await API.delete({ path: `/comment/${comment._id}` });
                if (response.error) {
                  Alert.alert(response.error);
                  return false;
                }
                setComments((comments) => comments.filter((p) => p._id !== comment._id));
                return true;
              }}
              onUpdate={
                comment.team
                  ? async (commentUpdated) => {
                      commentUpdated.person = personDB?._id;
                      const response = await API.put({
                        path: `/comment/${comment._id}`,
                        body: prepareCommentForEncryption(commentUpdated),
                      });
                      if (response.error) {
                        Alert.alert(response.error);
                        return false;
                      }
                      if (response.ok) {
                        setComments((comments) =>
                          comments.map((c) => {
                            if (c._id === comment._id) return response.decryptedData;
                            return c;
                          })
                        );
                        return true;
                      }
                      return false;
                    }
                  : undefined
              }
            />
          )}
          ifEmpty="Pas encore de commentaire"
        >
          <NewCommentInput
            forwardRef={newCommentRef}
            canToggleGroupCheck={!!organisation.groupsEnabled && !!groups.find((group) => group.persons.includes(personDB?._id))}
            canToggleUrgentCheck
            onCommentWrite={onCommentWrite}
            onCreate={async (newComment) => {
              const body = {
                ...newComment,
                person: personDB?._id,
              };
              const response = await API.post({ path: "/comment", body: prepareCommentForEncryption(body) });
              if (!response.ok) {
                Alert.alert(response.error || response.code);
                return false;
              }
              setComments((comments) => [response.decryptedData, ...comments]);
              return true;
            }}
          />
        </SubList>
      )}
      {organisation.rencontresEnabled && (
        <SubList
          label="Rencontres"
          onAdd={onAddRencontre}
          data={sortedRencontres}
          renderItem={(rencontre) => <RencontreRow key={rencontre._id} rencontre={rencontre} onUpdate={() => onUpdateRencontre(rencontre)} />}
          ifEmpty="Pas encore de rencontre"
        />
      )}
      {organisation.passagesEnabled && (
        <SubList
          label="Passages"
          onAdd={onAddPassage}
          data={sortedPassages}
          renderItem={(passage) => <PassageRow key={passage._id} passage={passage} onUpdate={() => onUpdatePassage(passage)} />}
          ifEmpty="Pas encore de passage"
        />
      )}
      {["admin", "normal"].includes(user.role) && (
        <SubList
          label="Lieux fréquentés"
          onAdd={onAddPlaceRequest}
          data={sortedRelPersonPlace}
          renderItem={(relPersonPlace, index) => {
            const place = places.find((pl) => pl._id === relPersonPlace.place)!;
            return <PlaceRow key={index} place={place} relPersonPlace={relPersonPlace} personDB={personDB} navigation={navigation} />;
          }}
          ifEmpty="Pas encore de lieu"
        />
      )}
    </ScrollContainer>
  );
};

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 30px;
`;

const AlterOutOfActiveList = styled.View`
  margin-bottom: 20px;
  border-radius: 10px;
  background-color: ${colors.app.colorGrey};
  padding: 10px;
`;

export default PersonSummary;
