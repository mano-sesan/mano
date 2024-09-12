import { atom } from "recoil";
import { ActionInstance } from "../types/action";

type ModalActionState = {
  open: boolean;
  from?: string;
  isForMultiplePerson?: boolean;
  isEditing?: boolean;
  action?: Partial<ActionInstance>;
};

const defaultModalActionState = (): ModalActionState => ({
  open: false,
  from: "/reception",
  isEditing: false,
  isForMultiplePerson: false,
  action: null,
});

export const modalActionState = atom<ModalActionState>({
  key: "modalAction",
  default: defaultModalActionState(),
  effects: [({ onSet }) => onSet((newValue) => ({ ...defaultModalActionState(), ...newValue }))],
});