import { atom } from "recoil";
import { ActionInstance } from "../types/action";

export const modalActionState = atom<{
  open: boolean;
  from?: "/reception" | "/action";
  isForMultiplePerson?: boolean;
  isEditing?: boolean;
  personsIds?: string[];
  shouldResetOnClose?: boolean;
  action?: Partial<ActionInstance>;
}>({
  key: "modalAction",
  default: {
    open: false,
    from: "/reception",
    isEditing: false,
    isForMultiplePerson: false,
    personsIds: [],
    shouldResetOnClose: false,
    action: null,
  },
});
