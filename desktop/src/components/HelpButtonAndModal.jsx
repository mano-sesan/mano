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
