import React from "react";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "./tailwind/Modal";

export default function UnBugButton({ onResetCacheAndLogout }) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        className="button-link !tw-ml-0"
        onClick={() => {
          setIsModalOpen(true);
        }}
      >
        Besoin d'aide&nbsp;?
      </button>
      {isModalOpen && (
        <ModalContainer open={isModalOpen} onClose={() => setIsModalOpen(false)} size="xl">
          <ModalHeader toggle={() => setIsModalOpen(false)} title="Besoin d'aide ? 🪲" />
          <ModalBody className="tw-p-4 tw-text-gray-700">
            <p>Vous avez un problème ? Nous vous conseillons les étapes suivantes&nbsp;:</p>
            <ul className="tw-list-disc tw-space-y-3">
              <li>
                <button className={"tw-text-main tw-underline tw-font-bold"} onClick={onResetCacheAndLogout}>
                  Videz le cache de mano
                </button>{" "}
                et vérifiez si le problème persiste.
              </li>
              <li>
                <b>Essayez depuis un autre ordinateur</b>
              </li>
              <li>
                Contactez votre chargée de déploiement&nbsp;:
                <ul className="tw-list-disc  tw-space-y-1">
                  <li>
                    Melissa - <b>melissa.saiter@sesan.fr</b> (07&nbsp;49&nbsp;08&nbsp;27&nbsp;10)
                  </li>
                </ul>
              </li>
              <li>
                Un problème pendant le week-end&nbsp;?
                <ul className="tw-list-disc">
                  <li>Appelez Guillaume au 07&nbsp;68&nbsp;55&nbsp;81&nbsp;48</li>
                </ul>
              </li>
            </ul>
          </ModalBody>
          <ModalFooter>
            <button type="button" className="button-cancel" onClick={() => setIsModalOpen(false)}>
              Fermer
            </button>
          </ModalFooter>
        </ModalContainer>
      )}
    </>
  );
}
