import React from "react";
import Button from "./Button";
import colors from "../utils/colors";

type ButtonDeleteProps = {
  onPress: () => void;
  caption?: string;
  deleting: boolean;
};

const ButtonDelete = ({ onPress, caption = "Supprimer", deleting }: ButtonDeleteProps) => (
  <Button caption={caption} onPress={onPress} color={colors.delete.color} outlined disabled={deleting} loading={deleting} />
);

export default ButtonDelete;
