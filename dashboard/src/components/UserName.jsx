import React from "react";
import { useAtomValue } from "jotai";
import { deletedUsersState, usersState } from "../recoil/auth";
import SelectUser from "./SelectUser";

const UserName = ({ id, wrapper = (name) => name, canAddUser = null, handleChange = null, className = "" }) => {
  const users = useAtomValue(usersState);
  const deletedUsers = useAtomValue(deletedUsersState);

  const user = users.find((u) => u._id === id);
  const deletedUser = deletedUsers.find((u) => u._id === id);
  const name = user?.name || deletedUser?.name;

  if (!name) {
    // Deux cas possibles :
    // 1. L'utilisateur n'existe plus et date de l'époque où on ne gardait pas les infos.
    // 2. L'utilisateur est tout frais et n'est pas encore ajouté dans la base.
    if (!canAddUser) return <span className="tw-text-gray-500 tw-italic">-</span>;
  }
  return (
    <span className={[className, "tw-text-left"].join(" ")}>
      {canAddUser ? (
        <>
          {wrapper()}
          <div className="tw-w-64 tw-min-w-max tw-text-base tw-font-normal">
            <SelectUser inputId="user" key={id} value={id} onChange={(userId) => handleChange(userId)} />
          </div>
        </>
      ) : (
        wrapper(name)
      )}
    </span>
  );
};

export default UserName;
