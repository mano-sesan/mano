import { useState } from "react";
import logo from "../assets/logo-green-creux-plus-petit.png";
import { organisationState, userState } from "../atoms/auth";
import { useAtomValue } from "jotai";
import Notification from "./Notification";
import UnBugButton from "./UnBugButton";
import ModalCacheResetLoader from "./ModalCacheResetLoader";
import { clearCache } from "../services/dataManagement";
import { useDataLoader } from "../services/dataLoader";
import { logout } from "../services/logout";
import SessionCountDownLimiter from "./SessionCountDownLimiter";

const TopBar = ({ onLogoClick }) => {
  const [modalCacheOpen, setModalCacheOpen] = useState(false);
  const user = useAtomValue(userState);
  const organisation = useAtomValue(organisationState);

  const { refresh, isLoading } = useDataLoader();

  const handleRefresh = () => {
    if (onLogoClick) {
      onLogoClick();
    } else {
      refresh();
    }
  };

  function resetCacheAndLogout() {
    // On affiche une fenêtre pendant notre vidage du cache pour éviter toute manipulation de la part des utilisateurs.
    setModalCacheOpen(true);
    // Logout first, then clear cache:
    // clearing cache wipes IndexedDB for all tabs; other tabs might still be active and could refresh
    // during that window. Logging out first reduces the chance of another tab re-advancing the cursor
    // while the shared cache is empty.
    logout()
      .catch(() => {
        // Even if logout fails, we still want to clear local data to recover from corrupted cache.
      })
      .then(() => clearCache("resetCacheAndLogout"))
      .then(() => {
        // On met un timeout pour laisser le temps aux personnes de lire si jamais ça va trop vite.
        // Il n'a donc aucune utilité d'un point de vue code.
        setTimeout(() => {
          window.localStorage.removeItem("previously-logged-in");
          window.location.href = "/auth";
        }, 1000);
      });
  }

  return (
    <div className="tw-hidden tw-w-full sm:tw-block">
      <aside
        className="noprint tw-flex tw-w-full tw-shrink-0 tw-items-center tw-justify-between tw-bg-[#E1E3E3] tw-px-5 print:tw-relative print:tw-hidden tw-py-2"
        title="Choix de l'équipe et menu déroulant pour le Profil"
      >
        <div className="tw-flex tw-flex-1 tw-items-center tw-justify-start">
          <div className="tw-mr-4 tw-w-max tw-text-left tw-text-sm tw-font-semibold tw-tracking-tighter">
            {["superadmin"].includes(user.role) ? "🤖 Mano Superadmin Console" : organisation?.name}
          </div>
        </div>
        <div className="tw-flex tw-flex-col tw-justify-between tw-text-[0.65rem] tw-text-main">
          <SessionCountDownLimiter />
        </div>
        <div className="tw-hidden tw-flex-1 lg:tw-flex">
          <button
            className="tw-mx-auto tw-my-0 tw-h-9 tw-w-14 tw-bg-center tw-bg-no-repeat disabled:tw-opacity-30 tw-bg-contain"
            type="button"
            title="Cliquez ici pour rafraîchir les données"
            onClick={handleRefresh}
            disabled={isLoading}
            style={{
              backgroundImage: `url(${logo})`,
            }}
          />
        </div>
        <div className="tw-flex tw-flex-1 tw-justify-end tw-gap-x-4">
          {!["stats-only", "restricted-access"].includes(user.role) ? <Notification /> : null}
          <UnBugButton onResetCacheAndLogout={resetCacheAndLogout} />
        </div>
      </aside>
      {modalCacheOpen ? <ModalCacheResetLoader /> : null}
    </div>
  );
};

export default TopBar;
