import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const showDrawerState = atom({
  key: "showDrawerState",
  default: false,
});

export const isDrawerCollapsedState = atomWithStorage("drawer-collapsed", false);
