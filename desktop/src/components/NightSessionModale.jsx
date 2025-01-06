import { useState } from "react";
import { ModalBody, ModalContainer, ModalHeader } from "./tailwind/Modal";
import QuestionMarkButton from "./QuestionMarkButton";

const NightSessionModale = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <QuestionMarkButton onClick={() => setOpen(true)} />
      <ModalContainer open={open} onClose={() => setOpen(false)} size="3xl">
        <ModalHeader onClose={() => setOpen(false)} title="Équipe de nuit" />
        <ModalBody>
          <div className="tw-p-4">
            <p>
              Si vous choisissez le mode <u>Équipe de nuit</u> pour cette équipe, le rapport pour une journée affichera les commentaires, actions et
              observations qui auront été créées entre midi de ce jour et midi du jour suivant.
            </p>
            <p>
              Par exemple, le rapport du 10 septembre affichera les commentaires, actions et observations entre le 10 septembre midi et le 11
              septembre midi.
            </p>
            <p>
              Si vous ne choisissez PAS le mode <u>Équipe de nuit</u> pour cette équipe, le rapport pour une journée affichera les commentaires,
              actions et observations qui auront été créées entre ce jour là entre minuit et minuit.
            </p>
          </div>
        </ModalBody>
      </ModalContainer>
    </>
  );
};

export default NightSessionModale;
