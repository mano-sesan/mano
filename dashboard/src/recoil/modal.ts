import { atom } from "recoil";
import { ActionInstance } from "../types/action";
import { TerritoryObservationInstance } from "../types/territoryObs";

type ModalActionState = {
  open: boolean;
  from?: string;
  isForMultiplePerson?: boolean;
  isEditing?: boolean;
  isEditingAllNextOccurences?: boolean;
  action?: Partial<ActionInstance>;
};

const defaultModalActionState = (): ModalActionState => ({
  open: false,
  from: "/reception",
  isEditing: false,
  isForMultiplePerson: false,
  isEditingAllNextOccurences: false,
  action: null,
});

export const modalActionState = atom<ModalActionState>({
  key: "modalAction",
  default: defaultModalActionState(),
  effects: [({ onSet }) => onSet((newValue) => ({ ...defaultModalActionState(), ...newValue }))],
});

type ModalObservationState = {
  open: boolean;
  from?: string;
  isEditing?: boolean;
  observation?: Partial<TerritoryObservationInstance>;
};

const defaultModalObservationState = (): ModalObservationState => ({
  open: false,
  from: "/territory",
  isEditing: false,
  observation: null,
});

export const modalObservationState = atom<ModalObservationState>({
  key: "modalObservation",
  default: defaultModalObservationState(),
  effects: [({ onSet }) => onSet((newValue) => ({ ...defaultModalObservationState(), ...newValue }))],
});
