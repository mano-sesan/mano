import { Link } from "react-router-dom";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { userState } from "../atoms/auth";
import { useAtomValue } from "jotai";
import OpenNewWindowIcon from "./OpenNewWindowIcon";
import { logout } from "../services/logout";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { useDataLoader } from "../services/dataLoader";

const roles = [
  { value: "normal", label: "Normal" },
  { value: "admin", label: "Admin" },
  { value: "restricted-access", label: "Accès restreint" },
  { value: "stats-only", label: "Statistiques seulement" },
];

const MenuUser = ({ isDrawerCollapsed, className = "" }) => {
  const user = useAtomValue(userState);

  const { resetCacheAndLogout } = useDataLoader();

  return (
    <Menu as="div" className={["tw-relative tw-inline-block tw-text-left tw-z-50", className].join(" ")}>
      <MenuButton
        aria-label={isDrawerCollapsed ? user?.name || "Menu utilisateur" : undefined}
        className={[
          "tw-inline-flex tw-flex-1 tw-items-center tw-justify-start tw-gap-x-1.5 tw-rounded-xl tw-border tw-px-1.5 tw-text-sm tw-font-normal tw-text-white tw-text-left focus:tw-outline-none tw-py-2 tw-max-w-full tw-w-full",
          isDrawerCollapsed ? "tw-justify-center" : "",
          "tw-border-[#6c757d] tw-bg-[#6c757d] hover:tw-border-[#545b62] hover:tw-bg-[#5a6268] data-[open]:tw-border-[#545b62] data-[open]:tw-bg-[#5a6268]",
        ].join(" ")}
      >
        <div className="tw-flex tw-flex-col tw-items-start tw-justify-start">
          <UserCircleIcon className="tw-size-6" />
        </div>
        {!isDrawerCollapsed && <span className="tw-truncate tw-max-w-40">{user?.name}</span>}
      </MenuButton>
      <MenuItems
        anchor="bottom start"
        transition
        className="tw-z-50 -tw-mt-1 tw-max-w-max tw-origin-top tw-rounded tw-bg-white tw-shadow-lg tw-ring-1 tw-ring-black/5 focus:tw-outline-none data-[closed]:tw-opacity-0 data-[closed]:tw-pointer-events-none data-[closed]:tw-scale-95 tw-transition"
      >
        <div className="tw-flex tw-items-center tw-py-2 tw-px-4 tw-text-sm tw-font-medium tw-text-gray-900 tw-border-b tw-border-gray-200 tw-whitespace-nowrap">
          <div className="tw-grow tw-truncate tw-max-w-40">{user?.name}</div>
          <div className="tw-bg-gray-500 tw-text-xs tw-text-white tw-px-2 tw-py-1 tw-rounded-full tw-ml-2">
            {roles.find((r) => r.value === user?.role)?.label}
          </div>
        </div>
        <div className="tw-py-1">
          <MenuItem>
            <a
              href="/charte.pdf"
              target="_blank"
              rel="noreferrer"
              className="tw-flex tw-items-center tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap data-[focus]:tw-bg-gray-100 tw-text-gray-900"
            >
              Charte des Utilisateurs <OpenNewWindowIcon />
            </a>
          </MenuItem>
          <MenuItem>
            <a
              href="/legal.pdf"
              target="_blank"
              rel="noreferrer"
              className="tw-flex tw-items-center tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap data-[focus]:tw-bg-gray-100 tw-text-gray-900"
            >
              Mentions Légales <OpenNewWindowIcon />
            </a>
          </MenuItem>
          <MenuItem>
            <a
              href="/cgu.pdf"
              target="_blank"
              rel="noreferrer"
              className="tw-flex tw-items-center tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap data-[focus]:tw-bg-gray-100 tw-text-gray-900"
            >
              Conditions générales d'utilisation <OpenNewWindowIcon />
            </a>
          </MenuItem>
          <MenuItem>
            <a
              href="/privacy.pdf"
              target="_blank"
              rel="noreferrer"
              className="tw-flex tw-items-center tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap data-[focus]:tw-bg-gray-100 tw-text-gray-900"
            >
              Politique de Confidentialité <OpenNewWindowIcon />
            </a>
          </MenuItem>
        </div>
        <div className="tw-border-t tw-border-gray-200 tw-py-1 tw-flex tw-flex-col">
          <MenuItem>
            <Link
              to="/account"
              className="border-2 tw-flex tw-items-center tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap data-[focus]:tw-bg-gray-100 tw-text-gray-900"
            >
              Mon compte
            </Link>
          </MenuItem>
          <MenuItem>
            <button
              type="button"
              onClick={() => {
                logout().then(() => {
                  window.localStorage.removeItem("previously-logged-in");
                  window.location.href = "/auth";
                });
              }}
              className="tw-flex tw-items-center tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap data-[focus]:tw-bg-gray-100 tw-text-gray-900 data-[focus]:tw-underline"
            >
              Se déconnecter
            </button>
          </MenuItem>
          <MenuItem>
            <button
              type="button"
              onClick={resetCacheAndLogout}
              className="tw-flex tw-items-center tw-px-4 tw-py-2 tw-text-sm tw-whitespace-nowrap data-[focus]:tw-bg-gray-100 tw-text-gray-900 data-[focus]:tw-underline"
            >
              Se déconnecter et vider le cache
            </button>
          </MenuItem>
        </div>
      </MenuItems>
    </Menu>
  );
};

export default MenuUser;
