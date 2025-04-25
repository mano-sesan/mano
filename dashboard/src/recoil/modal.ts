import { atom } from "recoil";
import { ActionInstance } from "../types/action";
import { TerritoryObservationInstance } from "../types/territoryObs";
import { RencontreInstance } from "../types/rencontre";

type ModalActionState = {
  open: boolean;
  from?: string;
  isForMultiplePerson?: boolean;
  isEditing?: boolean;
  isEditingAllNextOccurences?: boolean;
  action?: Partial<ActionInstance>;
};

export const defaultModalActionState = (): ModalActionState => ({
  open: false,
  from: "/reception",
  isEditing: false,
  isForMultiplePerson: false,
  isEditingAllNextOccurences: false,
  action: null,
});

const localStorageEffect =
  <T>(key: string) =>
  ({
    setSelf,
    onSet,
  }: {
    setSelf: (value: T) => void;
    onSet: (callback: (newValue: T, oldValue: T | undefined, isReset: boolean) => void) => void;
  }) => {
    const savedValue = localStorage.getItem(key);
    if (savedValue != null) {
      setSelf(JSON.parse(savedValue));
    }

    onSet((newValue, _, isReset) => {
      isReset ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(newValue));
    });
  };

export const modalActionState = atom<ModalActionState>({
  key: "modalAction",
  default: defaultModalActionState(),
  effects: [localStorageEffect("modalActionValue")],
});

type ModalObservationState = {
  open: boolean;
  from?: string;
  isEditing?: boolean;
  observation?: Partial<TerritoryObservationInstance>;
  rencontresInProgress?: RencontreInstance[];
};

export const defaultModalObservationState = (): ModalObservationState => ({
  open: false,
  from: "/territory",
  isEditing: false,
  observation: null,
  rencontresInProgress: [],
});

export const modalObservationState = atom<ModalObservationState>({
  key: "modalObservation",
  default: defaultModalObservationState(),
  effects: [localStorageEffect("modalObservationValue")],
});
