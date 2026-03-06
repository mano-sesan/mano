import { Fragment } from "react";
import { Link } from "react-router-dom";
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import { userState } from "../atoms/auth";
import { useAtomValue } from "jotai";
import OpenNewWindowIcon from "./OpenNewWindowIcon";
import { clearCache } from "../services/dataManagement";
import { logout } from "../services/logout";
import { UserCircleIcon } from "@heroicons/react/24/solid";

const MenuUser = () => {
  const user = useAtomValue(userState);

  function resetCacheAndLogout() {
    // On affiche une fenêtre pendant notre vidage du cache pour éviter toute manipulation de la part des utilisateurs.
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
    <Menu as="div" className="tw-relative tw-inline-block tw-text-left mt-auto tw-z-50">
      {({ open }) => (
        <>
          <MenuButton
            className={[
              "tw-inline-flex tw-flex-1 tw-items-center tw-justify-start tw-gap-x-1.5 tw-rounded-lg tw-border tw-px-1.5 tw-text-xs tw-font-normal tw-text-white tw-text-left focus:tw-outline-none tw-w-full py-2 tw-max-w-full",
              open
                ? "tw-border-[#545b62] tw-bg-[#5a6268]" // Keep this style when open
                : "tw-border-[#6c757d] tw-bg-[#6c757d] hover:tw-border-[#545b62] hover:tw-bg-[#5a6268]",
            ].join(" ")}
          >
            <div className="tw-flex tw-flex-col tw-items-start tw-justify-start">
              <UserCircleIcon className="tw-size-6" />
            </div>
            {/* one line only */}
            <span className="tw-truncate tw-max-w-40">{user?.name}</span>
            {/* <div className="tw-inline-flex tw-h-4 tw-w-4 tw-flex-1 tw-flex-col tw-justify-between">
              <div className="tw-block tw-h-px tw-w-full tw-bg-white" />
              <div className="tw-block tw-h-px tw-w-full tw-bg-white" />
              <div className="tw-block tw-h-px tw-w-full tw-bg-white" />
            </div> */}
          </MenuButton>
          <Transition
            as={Fragment}
            enter="tw-transition tw-ease-out tw-duration-100"
            enterFrom="tw-transform tw-opacity-0 tw-scale-95"
            enterTo="tw-transform tw-opacity-100 tw-scale-100"
            leave="tw-transition tw-ease-in tw-duration-75"
            leaveFrom="tw-transform tw-opacity-100 tw-scale-100"
            leaveTo="tw-transform tw-opacity-0 tw-scale-95"
          >
            <MenuItems
              anchor="bottom start"
              className="tw-z-50 tw-mt-2 tw-max-w-max tw-origin-top-right tw-rounded tw-bg-white tw-shadow-lg tw-ring-1 tw-ring-black/5 focus:tw-outline-none"
            >
              <div className="tw-py-2 tw-px-6 tw-text-base tw-font-normal tw-text-[#6c757d] tw-border-b tw-border-gray-200 tw-whitespace-nowrap">
                {user?.name} - {user.role}
              </div>
              <div className="tw-py-1">
                <MenuItem>
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
                </MenuItem>
                <MenuItem>
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
                </MenuItem>
                <MenuItem>
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
                </MenuItem>
                <MenuItem>
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
                </MenuItem>
              </div>
              <div className="tw-border-t tw-border-gray-200 tw-py-1">
                <MenuItem>
                  {({ active }) => (
                    <Link
                      to="/account"
                      className={`tw-block tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap ${active ? "tw-bg-gray-100 tw-text-gray-900" : "tw-text-gray-700"}`}
                    >
                      Mon compte
                    </Link>
                  )}
                </MenuItem>
                <MenuItem>
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
                </MenuItem>
                <MenuItem>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={resetCacheAndLogout}
                      className={`tw-block tw-w-full tw-text-left tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap ${active ? "tw-bg-gray-100 tw-text-gray-900" : "tw-text-gray-700"}`}
                    >
                      Se déconnecter et vider le cache
                    </button>
                  )}
                </MenuItem>
              </div>
            </MenuItems>
          </Transition>
        </>
      )}
    </Menu>
  );
};

export default MenuUser;
