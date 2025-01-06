import { ModalBody, ModalContainer } from "./tailwind/Modal";

export default function ModalCacheResetLoader() {
  return (
    <ModalContainer open={true}>
      <ModalBody>
        <div className="tw-text-center tw-animate-pulse tw-px-4 tw-py-4">Veuillez patienter pendant le vidage du cache…</div>
      </ModalBody>
    </ModalContainer>
  );
}
