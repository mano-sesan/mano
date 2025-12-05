import { useState } from "react";
import { toast } from "react-toastify";
import { useAtomValue } from "jotai";
import { userState } from "../recoil/auth";
import type { UserInstance } from "../types/user";
import ConfirmModal from "./ConfirmModal";

interface DeleteButtonAndConfirmModalProps {
  title: string;
  buttonText?: string;
  children: React.ReactNode;
  textToConfirm: string;
  onConfirm: () => void;
  buttonWidth?: string;
  roles?: Array<UserInstance["role"]>;
  roleErrorMessage?: string;
  className?: string;
  disabled?: boolean;
  disabledTitle?: string;
}

const DeleteButtonAndConfirmModal = ({
  title,
  children,
  textToConfirm,
  onConfirm,
  buttonText = "Supprimer",
  buttonWidth = null,
  roles = ["admin", "superadmin"],
  roleErrorMessage = "Désolé, seul un admin peut supprimer ce type d'élément",
  disabled = false,
  className = "",
  disabledTitle = "Vous n'avez pas le droit de supprimer cet élément",
}: DeleteButtonAndConfirmModalProps) => {
  const user = useAtomValue(userState);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        title={disabled ? disabledTitle : title}
        className={["button-destructive", disabled ? "tw-cursor-not-allowed" : "", className].join(" ")}
        onClick={() => {
          if (!roles.includes(user.role)) return toast.error(roleErrorMessage);
          setOpen(true);
        }}
        disabled={disabled}
        aria-disabled={disabled}
        style={buttonWidth ? { width: buttonWidth } : {}}
      >
        {buttonText}
      </button>
      <ConfirmModal open={open} onClose={() => setOpen(false)} title={title} textToConfirm={textToConfirm} onConfirm={onConfirm}>
        {children}
      </ConfirmModal>
    </>
  );
};

export default DeleteButtonAndConfirmModal;
