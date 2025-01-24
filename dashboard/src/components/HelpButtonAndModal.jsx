import { useState } from "react";
import QuestionMarkButton from "./QuestionMarkButton";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "./tailwind/Modal";

const HelpButtonAndModal = ({ title, help, children = null, size = "lg" }) => {
  const [helpOpen, setHelpOpen] = useState(false);

  if (!help && !children) return null;

  return (
    <>
      <QuestionMarkButton title={help} aria-label={help} className="noprint tw-ml-2 tw-shrink-0" onClick={() => setHelpOpen(true)} />
      <HelpModal open={helpOpen} setOpen={setHelpOpen} title={title} help={help} size={size}>
        {children}
      </HelpModal>
    </>
  );
};

export const TimeModalButton = ({ title, help, children = null, size = "lg" }) => {
  const [helpOpen, setHelpOpen] = useState(false);

  if (!help && !children) return null;

  return (
    <>
      <div
        title={help}
        aria-label={help}
        className="tw-text-main tw-w-4 tw-h-4 hover:tw-scale-110 tw-cursor-pointer tw-rounded tw-flex tw-items-center tw-justify-center"
        onClick={() => setHelpOpen(true)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-history"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l4 2" />
        </svg>
      </div>
      <HelpModal open={helpOpen} setOpen={setHelpOpen} title={title} help={help} size={size}>
        {children}
      </HelpModal>
    </>
  );
};

const HelpModal = ({ open, setOpen, title, help, children, size = "lg" }) => {
  return (
    <ModalContainer open={open} size={size}>
      <ModalHeader title={title} />
      <ModalBody>
        <div className="tw-flex tw-flex-col tw-gap-4  tw-px-8 tw-py-4">
          {!!help && <p className="tw-mb-0" dangerouslySetInnerHTML={{ __html: help.split("\n").join("<br>") }} />}
          {children}
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          name="cancel"
          className="button-cancel"
          onClick={() => {
            setOpen(false);
          }}
        >
          Fermer
        </button>
      </ModalFooter>
    </ModalContainer>
  );
};

export default HelpButtonAndModal;
