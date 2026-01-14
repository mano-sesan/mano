import React from "react";
import { useAtomValue } from "jotai";
import { deletedUsersState, usersState } from "../recoil/auth";
import { MyText } from "./MyText";
import { UUIDV4 } from "@/types/uuid";
import { View } from "react-native";

type UserNameProps = {
  id: UUIDV4;
  caption: string;
  classNameProp?: string;
  textClassNameProp?: string;
};

const UserName = ({ id, caption, classNameProp = "-mt-2.5 mb-5 ml-auto", textClassNameProp = "italic" }: UserNameProps) => {
  const users = useAtomValue(usersState);
  const deletedUsers = useAtomValue(deletedUsersState);

  const user = users.find((u) => u._id === id) || deletedUsers.find((u) => u._id === id);

  if (!user?.name) return null;
  return (
    <View className={classNameProp}>
      <MyText className={textClassNameProp}>
        {caption} {user.name}
      </MyText>
    </View>
  );
};

export default UserName;
