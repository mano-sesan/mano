import React, { useState } from "react";
import { Alert, Keyboard, View } from "react-native";
import dayjs from "dayjs";
import Button from "../../components/Button";
import InputMultilineAutoAdjust from "../../components/InputMultilineAutoAdjust";
import Spacer from "../../components/Spacer";
import ButtonsContainer from "../../components/ButtonsContainer";
import ButtonDelete from "../../components/ButtonDelete";
import { useAtomValue } from "jotai";
import { currentTeamState, organisationState, userState } from "../../recoil/auth";
import CheckboxLabelled from "../../components/CheckboxLabelled";
import { CommentInstance } from "@/types/comment";

type NewCommentInputBody = Pick<CommentInstance, "comment" | "urgent" | "group" | "type" | "date" | "team" | "user" | "organisation">;
type NewCommentInputProps = {
  forwardRef: React.RefObject<View | null>;
  onFocus?: () => void;
  onCommentWrite: (comment: string) => void;
  onCreate: (comment: NewCommentInputBody) => Promise<boolean>;
  canToggleUrgentCheck?: boolean;
  canToggleGroupCheck?: boolean;
};

const NewCommentInput = ({ forwardRef, onFocus, onCommentWrite, onCreate, canToggleUrgentCheck, canToggleGroupCheck }: NewCommentInputProps) => {
  const [comment, setComment] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [group, setGroup] = useState(false);
  const [posting, setPosting] = useState(false);
  const currentTeam = useAtomValue(currentTeamState)!;
  const organisation = useAtomValue(organisationState)!;
  const user = useAtomValue(userState)!;

  const onCreateComment = async () => {
    setPosting(true);

    const body: NewCommentInputBody = {
      comment,
      date: dayjs(),
      urgent,
      group,
      user: user._id,
      team: currentTeam._id,
      organisation: organisation._id,
    };
    await onCreate(body);
    Keyboard.dismiss();
    setPosting(false);
    setComment("");
    onCommentWrite?.("");
  };

  const onCancelRequest = () => {
    Alert.alert("Voulez-vous abandonner la création de ce commentaire ?", undefined, [
      {
        text: "Continuer la création",
      },
      {
        text: "Abandonner",
        onPress: () => {
          setPosting(false);
          setComment("");
        },
        style: "destructive",
      },
    ]);
  };

  const onChangeText = (newComment: string) => {
    setComment(newComment);
    onCommentWrite?.(newComment);
  };

  return (
    <>
      <InputMultilineAutoAdjust
        onChangeText={onChangeText}
        value={comment}
        placeholder="Ajouter un commentaire"
        viewRef={forwardRef}
        onFocus={onFocus}
      />
      {!!comment.length && (
        <>
          <Spacer />
          {!!canToggleUrgentCheck && (
            <CheckboxLabelled
              _id="urgent"
              label="Commentaire prioritaire (ce commentaire sera mis en avant par rapport aux autres)"
              alone
              onPress={() => setUrgent((u) => !u)}
              value={urgent}
            />
          )}
          {!!canToggleGroupCheck && (
            <CheckboxLabelled
              _id="group"
              label="Commentaire familial (ce commentaire sera visible pour toute la famille)"
              alone
              onPress={() => setGroup((g) => !g)}
              value={group ? true : false}
            />
          )}
          <ButtonsContainer>
            <ButtonDelete onPress={onCancelRequest} caption="Annuler" deleting={false} />
            <Button caption="Créer" onPress={onCreateComment} loading={posting} />
          </ButtonsContainer>
        </>
      )}
    </>
  );
};

export default NewCommentInput;
