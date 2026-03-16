import { useState, Fragment } from "react";
import { Link } from "react-router-dom";
import { Menu, Transition } from "@headlessui/react";
import logo from "../assets/logo-green-creux-plus-petit.png";
import SelectTeam from "./SelectTeam";

import { currentTeamState, organisationState, teamsState, userState } from "../atoms/auth";
import { useAtom, useAtomValue } from "jotai";
import Notification from "./Notification";
import OpenNewWindowIcon from "./OpenNewWindowIcon";
import ColorHeaderBand from "./ColorHeaderBand";
import UnBugButton from "./UnBugButton";
import ModalCacheResetLoader from "./ModalCacheResetLoader";
import { clearCache } from "../services/dataManagement";
import { useDataLoader } from "../services/dataLoader";
import { logout } from "../services/logout";

const TopBar = ({ onLogoClick }) => {
  const [modalCacheOpen, setModalCacheOpen] = useState(false);
  const user = useAtomValue(userState);
  const organisation = useAtomValue(organisationState);
  const teams = useAtomValue(teamsState);
  const [currentTeam, setCurrentTeam] = useAtom(currentTeamState);

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
        className="noprint tw-flex tw-w-full tw-shrink-0 tw-items-center tw-justify-between tw-bg-white tw-px-5 tw-py-3 print:tw-relative print:tw-hidden"
        title="Choix de l'équipe et menu déroulant pour le Profil"
      >
        <div className="tw-flex tw-flex-1 tw-items-center tw-justify-start">
          <div className="tw-mr-4 tw-w-max tw-text-left tw-text-sm tw-font-semibold tw-tracking-tighter">
            {["superadmin"].includes(user.role) ? "🤖 Mano Superadmin Console" : organisation?.name}
          </div>
          {!["superadmin"].includes(user.role) && (
            <SelectTeam
              style={{ maxWidth: "250px", fontSize: "13px" }}
              onChange={setCurrentTeam}
              teamId={currentTeam?._id}
              teams={user.role === "admin" ? teams : user.teams}
              inputId="team-selector-topBar"
            />
          )}
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
          <Menu as="div" className="tw-relative tw-inline-block tw-text-left">
            {({ open }) => (
              <>
                <Menu.Button className={`tw-ml-2.5 tw-inline-flex tw-flex-1 tw-items-center tw-justify-between tw-gap-x-2.5 tw-rounded-full tw-border tw-px-5 tw-py-2.5 tw-text-base tw-font-normal tw-text-white focus:tw-outline-none ${
                  open
                    ? 'tw-border-[#545b62] tw-bg-[#5a6268]' // Keep this style when open
                    : 'tw-border-[#6c757d] tw-bg-[#6c757d] hover:tw-border-[#545b62] hover:tw-bg-[#5a6268]'
                }`}>
              <span>{user?.name} </span>
              <div className="tw-inline-flex tw-h-4 tw-w-4 tw-flex-1 tw-flex-col tw-justify-between">
                <div className="tw-block tw-h-px tw-w-full tw-bg-white" />
                <div className="tw-block tw-h-px tw-w-full tw-bg-white" />
                <div className="tw-block tw-h-px tw-w-full tw-bg-white" />
              </div>
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="tw-transition tw-ease-out tw-duration-100"
              enterFrom="tw-transform tw-opacity-0 tw-scale-95"
              enterTo="tw-transform tw-opacity-100 tw-scale-100"
              leave="tw-transition tw-ease-in tw-duration-75"
              leaveFrom="tw-transform tw-opacity-100 tw-scale-100"
              leaveTo="tw-transform tw-opacity-0 tw-scale-95"
            >
              <Menu.Items className="tw-absolute tw-right-0 tw-z-20 tw-mt-2 tw-w-auto tw-min-w-max tw-origin-top-right tw-rounded tw-bg-white tw-shadow-lg tw-ring-1 tw-ring-black/5 focus:tw-outline-none">
                <div className="tw-py-2 tw-px-6 tw-text-base tw-font-normal tw-text-[#6c757d] tw-border-b tw-border-gray-200 tw-whitespace-nowrap">
                  {user?.name} - {user.role}
                </div>
                <div className="tw-py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <a
                        href="/charte.pdf"
                        target="_blank"
                        rel="noreferrer"
                        className={`tw-flex tw-items-center tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap ${active ? "tw-bg-gray-100 tw-text-gray-900" : "tw-text-gray-700"}`}
                      >
                        Charte des Utilisateurs <OpenNewWindowIcon />
                      </a>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <a
                        href="/legal.pdf"
                        target="_blank"
                        rel="noreferrer"
                        className={`tw-flex tw-items-center tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap ${active ? "tw-bg-gray-100 tw-text-gray-900" : "tw-text-gray-700"}`}
                      >
                        Mentions Légales <OpenNewWindowIcon />
                      </a>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <a
                        href="/cgu.pdf"
                        target="_blank"
                        rel="noreferrer"
                        className={`tw-flex tw-items-center tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap ${active ? "tw-bg-gray-100 tw-text-gray-900" : "tw-text-gray-700"}`}
                      >
                        Conditions générales d'utilisation <OpenNewWindowIcon />
                      </a>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <a
                        href="/privacy.pdf"
                        target="_blank"
                        rel="noreferrer"
                        className={`tw-flex tw-items-center tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap ${active ? "tw-bg-gray-100 tw-text-gray-900" : "tw-text-gray-700"}`}
                      >
                        Politique de Confidentialité <OpenNewWindowIcon />
                      </a>
                    )}
                  </Menu.Item>
                </div>
                <div className="tw-border-t tw-border-gray-200 tw-py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        to="/account"
                        className={`tw-block tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap ${active ? "tw-bg-gray-100 tw-text-gray-900" : "tw-text-gray-700"}`}
                      >
                        Mon compte
                      </Link>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        type="button"
                        onClick={() => {
                          logout().then(() => {
                            window.localStorage.removeItem("previously-logged-in");
                            window.location.href = "/auth";
                          });
                        }}
                        className={`tw-block tw-w-full tw-text-left tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap ${active ? "tw-bg-gray-100 tw-text-gray-900" : "tw-text-gray-700"}`}
                      >
                        Se déconnecter
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        type="button"
                        onClick={resetCacheAndLogout}
                        className={`tw-block tw-w-full tw-text-left tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap ${active ? "tw-bg-gray-100 tw-text-gray-900" : "tw-text-gray-700"}`}
                      >
                        Se déconnecter et vider le cache
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
              </>
            )}
          </Menu>
        </div>
      </aside>
      <div className="tw-w-full">
        <ColorHeaderBand teamId={currentTeam?._id} />
      </div>
      {modalCacheOpen ? <ModalCacheResetLoader /> : null}
    </div>
  );
};

export default TopBar;
