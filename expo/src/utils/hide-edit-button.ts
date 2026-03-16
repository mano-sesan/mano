import { useIsFocused } from "@react-navigation/native";
import { atom, useSetAtom } from "jotai";
import { useEffect } from "react";

export const hideEditButtonAtom = atom<boolean>(false);

export function useEditButtonStatusOnFocused(string: "hide" | "show") {
  const focused = useIsFocused();
  const setHideEditButton = useSetAtom(hideEditButtonAtom);
  useEffect(() => {
    if (focused) {
      setHideEditButton(string === "hide");
    }
  }, [focused, setHideEditButton, string]);
}
