import React from "react";
import { useAtomValue } from "jotai";
import styled from "styled-components/native";
import { deletedUsersState, usersState } from "../recoil/auth";
import { MyText } from "./MyText";
import { UUIDV4 } from "@/types/uuid";

type UserNameProps = {
  id: UUIDV4;
  caption: string;
};

const UserName = ({ id, caption }: UserNameProps) => {
  const users = useAtomValue(usersState);
  const deletedUsers = useAtomValue(deletedUsersState);

  const user = users.find((u) => u._id === id) || deletedUsers.find((u) => u._id === id);

  if (!user?.name) return null;
  return (
    <FromUser>
      {caption} {user.name}
    </FromUser>
  );
};

export default UserName;

const FromUser = styled(MyText)`
  font-style: italic;
  margin-top: -10px;
  margin-bottom: 20px;
  margin-left: auto;
`;
