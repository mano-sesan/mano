import React from "react";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "./tailwind/Modal";
import { useRecoilValue } from "recoil";
import { organisationState } from "../recoil/auth";
import AgendaIcon from "../assets/icons/AgendaIcon";

export default function UnBugButton({ onResetCacheAndLogout }) {
  const organisation = useRecoilValue(organisationState);
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
            <ol className="tw-list-decimal tw-space-y-3 tw-ml-8">
              <li>
                <button className={"tw-text-main tw-underline tw-font-bold"} onClick={onResetCacheAndLogout}>
                  Videz le cache de mano
                </button>
              </li>
              <li>Essayez depuis un autre ordinateur</li>
              {organisation.responsible === "Melissa" ? (
                <>
                  <li>
                    Contactez votre chargée de déploiement&nbsp;:
                    <div className="tw-ml-4 tw-my-2 tw-font-bold">
                      <div>
                        <div>Melissa SAITER</div>
                        <div>melissa.saiter@sesan.fr</div>
                        <div>07&nbsp;49&nbsp;08&nbsp;27&nbsp;10</div>
                      </div>
                      <div className="-tw-ml-2">
                        <a
                          target="_blank"
                          rel="noreferrer"
                          className="tw-flex tw-gap-2 tw-my-2 tw-bg-sky-600 hover:tw-bg-sky-700 hover:tw-text-white hover:tw-no-underline tw-text-white tw-px-4 tw-py-2 tw-rounded tw-shadow tw-text-sm tw-max-w-64"
                          href="https://cal.com/msaiter/j-ai-besoin-d-une-nouvelle-formation-mano"
                        >
                          <div className="tw-text-left tw-grow">Reservez un temps de formation à l'outil MANO</div>
                          <AgendaIcon size={42} />
                        </a>
                      </div>
                    </div>
                  </li>
                  <li>
                    Votre référent n'est pas disponible&nbsp;?
                    <ul className="tw-list-disc  tw-space-y-1  tw-mt-2">
                      <li>Simon - 06&nbsp;62&nbsp;94&nbsp;76&nbsp;88 - simon.lesgourgues@sesan.fr@sesan.fr</li>
                      <li>Guillaume - 07&nbsp;68&nbsp;55&nbsp;81&nbsp;48 - guillaume.demirhan@sesan.fr</li>
                    </ul>
                  </li>
                </>
              ) : organisation.responsible === "Simon" ? (
                <>
                  <li>
                    Contactez votre chargée de déploiement&nbsp;:
                    <div className="tw-ml-4 tw-my-2 tw-font-bold">
                      <div>
                        <div>Simon LESGOURGUES</div>
                        <div>simon.lesgourgues@sesan.fr</div>
                        <div>06&nbsp;62&nbsp;94&nbsp;76&nbsp;88</div>
                      </div>
                      <div className="-tw-ml-2">
                        <a
                          target="_blank"
                          rel="noreferrer"
                          className="tw-flex tw-gap-2 tw-my-2 tw-bg-sky-600 hover:tw-bg-sky-700 hover:tw-text-white hover:tw-no-underline tw-text-white tw-px-4 tw-py-2 tw-rounded tw-shadow tw-text-sm tw-max-w-64"
                          href="https://cal.com/simon-lesgourgues/formation-de-mano"
                        >
                          <div className="tw-text-left tw-grow">Reservez un temps de formation à l'outil MANO</div>
                          <AgendaIcon size={42} />
                        </a>
                      </div>
                    </div>
                  </li>
                  <li>
                    Votre référent n'est pas disponible&nbsp;?
                    <ul className="tw-list-disc tw-space-y-1 tw-mt-2">
                      <li>Melissa - 07&nbsp;49&nbsp;08&nbsp;27&nbsp;10 - melissa.saiter@sesan.fr</li>
                      <li>Guillaume - 07&nbsp;68&nbsp;55&nbsp;81&nbsp;48 - guillaume.demirhan@sesan.fr</li>
                    </ul>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    Contactez votre chargé·e de déploiement&nbsp;:
                    <ul className="tw-list-disc  tw-space-y-1 tw-mt-2">
                      <li>Simon - 06&nbsp;62&nbsp;94&nbsp;76&nbsp;88 - simon.lesgourgues@sesan.fr</li>
                      <li>Melissa - 07&nbsp;49&nbsp;08&nbsp;27&nbsp;10 - melissa.saiter@sesan.fr</li>
                    </ul>
                  </li>
                </>
              )}
              <li>
                Un problème pendant le week-end&nbsp;?
                <div className="tw-ml-4 tw-my-2">Appelez Guillaume au 07&nbsp;68&nbsp;55&nbsp;81&nbsp;48</div>
              </li>
            </ol>
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
