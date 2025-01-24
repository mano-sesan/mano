import picture1 from "../assets/MANO_livraison_elements-05.png";

export default function OrganisationDesactivee() {
  return (
    <div className="tw-flex tw-h-screen tw-w-full tw-flex-col tw-items-center tw-justify-center tw-bg-gray-50">
      <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-rounded-lg tw-bg-white tw-p-8 tw-shadow-lg tw-max-w-xl">
        <img src={picture1} alt="Logo Mano" className="tw-mb-4 tw-h-64" />
        <h1 className="tw-mb-4 tw-text-2xl tw-font-bold tw-text-main">Organisation désactivée</h1>
        <p className="tw-mb-8 tw-text-center tw-text-gray-600">
          Cette organisation a été temporairement désactivée. Veuillez contacter votre administrateur pour plus d'informations.
        </p>
        <button
          className="tw-rounded tw-bg-main tw-px-4 tw-py-2 tw-text-white tw-transition hover:tw-bg-opacity-90"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
}
