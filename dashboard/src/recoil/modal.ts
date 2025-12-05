import { atom } from "jotai";
import { atomWithLocalStorage } from "../store";
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

export const modalActionState = atomWithLocalStorage<ModalActionState>("modalActionValue", defaultModalActionState());

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

export const modalObservationState = atomWithLocalStorage<ModalObservationState>("modalObservationValue", defaultModalObservationState());
