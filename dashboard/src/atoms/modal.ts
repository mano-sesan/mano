import { atomWithLocalStorage } from "../store";
import { ActionInstance } from "../types/action";
import { TerritoryObservationInstance } from "../types/territoryObs";
import { RencontreInstance } from "../types/rencontre";
import { ConsultationInstance } from "../types/consultation";

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

type ModalConsultationState = {
  open: boolean;
  from?: string;
  isEditing?: boolean;
  consultation?: Partial<ConsultationInstance>;
};

export const defaultModalConsultationState = (): ModalConsultationState => ({
  open: false,
  from: "/action",
  isEditing: false,
  consultation: undefined,
});

export const modalConsultationState = atomWithLocalStorage<ModalConsultationState>("modalConsultationValue", defaultModalConsultationState());
