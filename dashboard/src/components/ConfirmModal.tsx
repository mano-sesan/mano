import { useState } from "react";
import { toast } from "react-toastify";
import { ModalBody, ModalContainer, ModalHeader, ModalFooter } from "./tailwind/Modal";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  textToConfirm: string;
  onConfirm: () => void;
}

const ConfirmModal = ({ open, onClose, title, children, textToConfirm, onConfirm }: ConfirmModalProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <ModalContainer open={open} onClose={onClose} size="3xl">
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
            onClose();
            setIsDeleting(false);
          }}
          className="tw-flex tw-w-full tw-items-center tw-justify-center tw-px-12"
        >
          <input className="tailwindui tw-basis-1/2" name="textToConfirm" autoComplete="off" placeholder={textToConfirm} type="text" />
        </form>
      </ModalBody>
      <ModalFooter>
        <button type="button" name="cancel" className="button-cancel" onClick={onClose} disabled={isDeleting}>
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
  );
};

export default ConfirmModal;
