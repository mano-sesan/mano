import { atom } from "recoil";
import { ActionInstance } from "../types/action";

type ModalActionState = {
  open: boolean;
  from?: string;
  isForMultiplePerson?: boolean;
  isEditing?: boolean;
  shouldResetOnClose?: boolean;
  action?: Partial<ActionInstance>;
};

const defaultModalActionState = (): ModalActionState => ({
  open: false,
  from: "/reception",
  isEditing: false,
  isForMultiplePerson: false,
  shouldResetOnClose: false,
  action: null,
});

export const modalActionState = atom<ModalActionState>({
  key: "modalAction",
  default: defaultModalActionState(),
  effects_UNSTABLE: [
    ({ setSelf, onSet }) => {
      onSet((newState) => {
        setSelf({
          ...defaultModalActionState(),
          ...newState,
        });
      });
    },
  ],
});
