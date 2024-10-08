import { useState } from "react";
import { toast } from "react-toastify";

import { useRecoilValue } from "recoil";
import { userState } from "../recoil/auth";
import { ModalBody, ModalContainer, ModalHeader, ModalFooter } from "./tailwind/Modal";
import type { UserInstance } from "../types/user";

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
  const user = useRecoilValue(userState);
  const [isDeleting, setIsDeleting] = useState(false);
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
      <ModalContainer open={open} onClose={() => setOpen(false)} size="3xl">
        <ModalHeader>
          <div className="tw-px-4">
            <h2 className="tw-block tw-text-center tw-text-xl tw-text-red-500 tw-mb-0">{title}</h2>
          </div>
        </ModalHeader>
        <ModalBody className="tw-py-4">
          {children}
          <p className="tw-mb-8 tw-block tw-w-full tw-text-center">
            Veuillez taper le texte ci-dessous pour confirmer
            <br />
            en respectant les majuscules, minuscules ou accents
            <br />
          </p>
          <p className="tw-flex tw-justify-center tw-break-all tw-text-center">
            <b className="tw-block tw-text-center tw-text-red-500">{textToConfirm}</b>
          </p>
          <form
            id={`delete-${textToConfirm}`}
            onSubmit={async (e) => {
              e.preventDefault();
              const _textToConfirm = String(Object.fromEntries(new FormData(e.currentTarget))?.textToConfirm);
              if (!_textToConfirm) return toast.error("Veuillez rentrer le texte demandé");
              if (_textToConfirm.trim().toLocaleLowerCase() !== textToConfirm.trim().toLocaleLowerCase()) {
                return toast.error("Le texte renseigné est incorrect");
              }
              if (_textToConfirm.trim() !== textToConfirm.trim()) {
                return toast.error("Veuillez respecter les minuscules/majuscules");
              }
              setIsDeleting(true);
              await onConfirm();
              setOpen(false);
              setIsDeleting(false);
            }}
            className="tw-flex tw-w-full tw-items-center tw-justify-center tw-px-12"
          >
            <input className="tailwindui tw-basis-1/2" name="textToConfirm" autoComplete="off" placeholder={textToConfirm} type="text" />
          </form>
        </ModalBody>
        <ModalFooter>
          <button type="button" name="cancel" className="button-cancel" onClick={() => setOpen(false)} disabled={isDeleting}>
            Annuler
          </button>
          <button
            type="submit"
            className="button-destructive"
            data-test-id={`button-delete-${textToConfirm}`}
            form={`delete-${textToConfirm}`}
            disabled={isDeleting}
          >
            Supprimer
          </button>
        </ModalFooter>
      </ModalContainer>
    </>
  );
};

export default DeleteButtonAndConfirmModal;
