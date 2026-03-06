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
import { ArrowPathIcon } from "@heroicons/react/24/outline";

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
        className="noprint tw-flex tw-w-full tw-shrink-0 tw-items-center tw-justify-between tw-bg-[#E1E3E3] print:tw-relative print:tw-hidden tw-py-2"
        title="Rafraîchir les données, afficher les notifications, nom de l'organisation, compteur de session, bouton de déconnexion"
      >
        <div className="tw-flex tw-items-center tw-justify-start tw-w-52 tw-bg-white tw-ml-2 tw-min-h-12 tw-px-2 tw-rounded-xl tw-border-2 tw-border-main25">
          <div className="tw-w-max tw-text-left tw-text-sm tw-font-semibold tw-tracking-tighter">
            {["superadmin"].includes(user.role) ? "🤖 Mano Superadmin Console" : <span className="tw-line-clamp-2">{organisation?.name}</span>}
          </div>
        </div>
        <div className="tw-ml-2 tw-flex tw-items-center tw-justify-center">
          <SessionCountDownLimiter />
        </div>
        <div className="tw-hidden tw-flex-1 lg:tw-flex tw-items-center tw-justify-center">
          <div className="tw-flex tw-items-center tw-justify-center tw-bg-white tw-rounded-full tw-p-0.5 tw-border-2 tw-border-main tw-relative">
            <button
              className="tw-my-0 tw-size-9 tw-bg-center tw-bg-no-repeat disabled:tw-opacity-30 tw-bg-contain"
              type="button"
              title="Cliquez ici pour rafraîchir les données"
              aria-label="Cliquez ici pour rafraîchir les données"
              onClick={handleRefresh}
              disabled={isLoading}
              style={{
                backgroundImage: `url(${logo})`,
              }}
            />
            <div className="tw-absolute -tw-top-1 -tw-right-1 tw-bg-white tw-rounded-full tw-border-2 tw-border-main tw-p-0.5">
              <ArrowPathIcon className={["tw-size-2 tw-text-main", isLoading ? "tw-animate-spin" : ""].join(" ")} />
            </div>
          </div>
        </div>
        <div className="tw-flex tw-justify-end tw-gap-x-4">
          {!["stats-only", "restricted-access"].includes(user.role) ? <Notification /> : null}
          <UnBugButton onResetCacheAndLogout={resetCacheAndLogout} />
        </div>
      </aside>
      {modalCacheOpen ? <ModalCacheResetLoader /> : null}
    </div>
  );
};

export default TopBar;
