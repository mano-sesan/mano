import * as Sentry from "@sentry/react";
import picture from "../assets/MANO_livraison_elements-05.png";

function ErrorFallback() {
  return (
    <div className="tw-flex tw-h-screen tw-w-full tw-flex-col tw-items-center tw-justify-center tw-bg-gray-50">
      <img src={picture} alt="Mano" className="tw-mb-4 tw-h-64" />
      <h1 className="tw-mb-4 tw-text-2xl tw-font-bold tw-text-main">Une erreur inattendue est survenue</h1>
      <p className="tw-mb-8 tw-text-center tw-text-gray-600">L&apos;équipe technique a été informée. Vous pouvez essayer de recharger la page.</p>
      <button
        className="tw-rounded tw-bg-main tw-px-4 tw-py-2 tw-text-white tw-transition hover:tw-bg-opacity-90"
        onClick={() => {
          try {
            window.localStorage.removeItem("previously-logged-in");
            window.localStorage.removeItem("automaticReload");
          } catch (_e) {
            // ignore
          }
          window.location.href = "/auth";
        }}
      >
        Recharger la page
      </button>
    </div>
  );
}

export default function ErrorBoundary({ children }) {
  return <Sentry.ErrorBoundary fallback={ErrorFallback}>{children}</Sentry.ErrorBoundary>;
}
