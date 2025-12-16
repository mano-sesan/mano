import React from "react";
import { atom, useAtomValue } from "jotai";
import BellIcon from "../../icons/BellIcon";
import { urgentItemsSelector } from "./Notifications";

export const notificationsNumberSelector = atom((get) => {
  const { actionsFiltered, commentsFiltered } = get(urgentItemsSelector);

  return actionsFiltered?.length + commentsFiltered?.length;
});

const BellWithNotifications = ({ color, size }: { color: string; size: number }) => {
  const notificationsNumber = useAtomValue(notificationsNumberSelector);
  return <BellIcon color={color} size={size} notificationsNumber={notificationsNumber} />;
};

export default BellWithNotifications;
