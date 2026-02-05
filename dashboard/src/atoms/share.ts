import { atom } from "jotai";
import type { PersonPopulated } from "../types/person";
import type { ShareOptions } from "../types/share";
import { getDefaultShareOptions } from "../types/share";

interface ShareModalState {
  open: boolean;
  person: PersonPopulated | null;
  options: ShareOptions;
}

export const shareModalState = atom<ShareModalState>({
  open: false,
  person: null,
  options: getDefaultShareOptions(),
});

export const openShareModal = atom(null, (_get, set, person: PersonPopulated) => {
  set(shareModalState, {
    open: true,
    person,
    options: getDefaultShareOptions(),
  });
});

export const closeShareModal = atom(null, (_get, set) => {
  set(shareModalState, {
    open: false,
    person: null,
    options: getDefaultShareOptions(),
  });
});

export const updateShareOptions = atom(null, (get, set, options: Partial<ShareOptions>) => {
  const currentState = get(shareModalState);
  set(shareModalState, {
    ...currentState,
    options: { ...currentState.options, ...options },
  });
});
