import React, { useState } from "react";
import { useActionSheet } from "@expo/react-native-action-sheet";
import { Alert } from "react-native";
import { useAtomValue } from "jotai";
import { organisationState } from "../../recoil/auth";
import BubbleRow from "../../components/BubbleRow";
import CommentModal from "./CommentModal";
import { CommentInstance } from "@/types/comment";

type CommentRowProps = {
  onUpdate?: (comment: Partial<CommentInstance>) => Promise<boolean>;
  onDelete?: (comment: CommentInstance) => Promise<boolean>;
  comment: CommentInstance;
  itemName?: string;
  onItemNamePress?: () => void;
  canToggleUrgentCheck?: boolean;
  canToggleGroupCheck?: boolean;
};

const CommentRow = ({ onUpdate, onDelete, comment, itemName, onItemNamePress, canToggleUrgentCheck, canToggleGroupCheck }: CommentRowProps) => {
  const { showActionSheetWithOptions } = useActionSheet();
  const organisation = useAtomValue(organisationState)!;
  const [updateModalVisible, setUpdateModalVisible] = useState(false);

  const onMorePress = async () => {
    const options = ["Annuler"];
    if (onDelete) options.unshift("Supprimer");
    if (onUpdate) options.unshift("Modifier");
    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: options.findIndex((o) => o === "Supprimer"),
      },
      async (buttonIndex) => {
        if (options[buttonIndex!] === "Modifier") setUpdateModalVisible(true);
        if (options[buttonIndex!] === "Supprimer") onCommentDeleteRequest();
      }
    );
  };

  const onCommentDeleteRequest = () => {
    Alert.alert("Voulez-vous supprimer ce commentaire ?", "Cette opération est irréversible.", [
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => onDelete!(comment),
      },
      {
        text: "Annuler",
        style: "cancel",
      },
    ]);
  };

  return (
    <>
      <BubbleRow
        onMorePress={onDelete || onUpdate ? onMorePress : null}
        caption={comment.comment}
        date={comment.date || comment.createdAt}
        user={comment.user}
        urgent={comment.urgent}
        group={!!organisation.groupsEnabled && comment.group}
        itemName={itemName}
        onItemNamePress={onItemNamePress}
        metaCaption="Commentaire de"
      />
      <CommentModal
        visible={updateModalVisible}
        commentDB={comment}
        onClose={() => setUpdateModalVisible(false)}
        title="Commentaire"
        canToggleUrgentCheck={canToggleUrgentCheck}
        canToggleGroupCheck={canToggleGroupCheck}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </>
  );
};

export default CommentRow;
