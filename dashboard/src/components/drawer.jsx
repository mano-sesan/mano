import { NavLink } from "react-router-dom";
import { atom, useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { organisationState, teamsState, userState } from "../atoms/auth";
import OpenNewWindowIcon from "./OpenNewWindowIcon";
import SessionCountDownLimiter from "./SessionCountDownLimiter";
import useMinimumWidth from "../services/useMinimumWidth";
import { deploymentShortCommitSHAState } from "../atoms/version";
import AddPersons from "./AddPersons";
import {
  MagnifyingGlassIcon,
  HomeIcon,
  CalendarDaysIcon,
  UserCircleIcon,
  MapIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  BuildingOfficeIcon,
  UsersIcon,
  UserIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from "@heroicons/react/20/solid";

export const showDrawerState = atom({
  key: "showDrawerState",
  default: false,
});

export const isDrawerCollapsedState = atomWithStorage("drawer-collapsed", false);

const Drawer = () => {
  const user = useAtomValue(userState);
  const organisation = useAtomValue(organisationState);
  const teams = useAtomValue(teamsState);
  const deploymentCommit = useAtomValue(deploymentShortCommitSHAState);

  const onboardingForEncryption = !organisation.encryptionEnabled;
  const onboardingForTeams = !teams.length;
  const role = user.role;

  const isOnboarding = onboardingForEncryption || onboardingForTeams;
  const [showDrawer, setShowDrawer] = useAtom(showDrawerState);
  const [isCollapsed, setIsCollapsed] = useAtom(isDrawerCollapsedState);

  const isDesktop = useMinimumWidth("sm");

  const collapsed = isCollapsed && isDesktop;

  const NavItem = ({ to, icon: Icon, label, external, id }) => {
    const linkContent = (
      <span
        className={["tw-flex tw-items-center tw-transition-all", collapsed ? "tw-justify-center" : "tw-gap-2"].join(" ")}
        title={collapsed ? label : undefined}
      >
        <Icon className={["tw-shrink-0 tw-transition-all", collapsed ? "tw-h-6 tw-w-6" : "tw-h-4 tw-w-4"].join(" ")} />
        {!collapsed && <span>{label}</span>}
        {!collapsed && external && <OpenNewWindowIcon />}
      </span>
    );

    if (external) {
      return (
        <li id={id}>
          <a href={to} target="_blank" rel="noreferrer" title={collapsed ? label : undefined}>
            {linkContent}
          </a>
        </li>
      );
    }

    return (
      <li id={id}>
        <NavLink to={to} activeClassName="active" title={collapsed ? label : undefined}>
          {linkContent}
        </NavLink>
      </li>
    );
  };

  return (
    <nav
      title="Navigation principale"
      className={[
        "noprint tw-absolute tw-flex tw-h-screen tw-w-screen tw-bg-gray-900/80 tw-opacity-100 tw-transition-all sm:!tw-pointer-events-auto sm:!tw-visible sm:tw-relative sm:!tw-z-30 sm:tw-h-auto sm:tw-w-auto sm:tw-translate-x-0 sm:tw-bg-transparent",
        showDrawer ? "tw-visible tw-z-30 tw-translate-x-0 tw-transition-all" : "tw-pointer-events-none tw-invisible tw-z-[-1] -tw-translate-x-full",
      ].join(" ")}
    >
      <div
        className={[
          "noprint tw-relative tw-max-h-full tw-min-w-min tw-shrink-0 tw-flex-col tw-justify-between tw-overflow-y-auto tw-border-r tw-border-black tw-border-opacity-10 tw-bg-white tw-drop-shadow-xl tw-transition-all tw-duration-300 sm:!tw-flex sm:tw-drop-shadow-none",
          isCollapsed && isDesktop ? "tw-w-16 tw-basis-16 tw-p-2" : "tw-w-64 tw-basis-52 tw-p-4",
          isOnboarding ? "[&_li:not(#show-on-onboarding)]:tw-pointer-events-none [&_li:not(#show-on-onboarding)]:tw-opacity-20" : "",
        ].join(" ")}
      >
        <div className="tw-pl-0 [&_a.active]:tw-text-main [&_a.active]:tw-underline [&_a:hover]:tw-text-main [&_a]:tw-my-2 [&_a]:tw-block [&_a]:tw-rounded-lg [&_a]:tw-py-0.5 [&_a]:tw-text-sm [&_a]:tw-font-semibold [&_a]:tw-text-black75 [&_li]:tw-list-none">
          {["admin", "normal"].includes(role) && isDesktop && (
            <>
              <NavItem to="/search" icon={MagnifyingGlassIcon} label="Recherche" />
              <hr />
            </>
          )}
          {["admin", "normal", "restricted-access"].includes(role) && !!organisation.receptionEnabled && !!isDesktop && (
            <NavItem to="/reception" icon={HomeIcon} label="Accueil" />
          )}
          {["admin", "normal", "restricted-access"].includes(role) && <NavItem to="/action" icon={CalendarDaysIcon} label="Agenda" />}
          {["admin", "normal", "restricted-access"].includes(role) && <NavItem to="/person" icon={UserIcon} label="Personnes suivies" />}
          {["admin", "normal", "restricted-access"].includes(role) && !!organisation.territoriesEnabled && (
            <NavItem to="/territory" icon={MapIcon} label="Territoires" />
          )}
          {["admin", "normal", "restricted-access"].includes(role) && <NavItem to="/report" icon={DocumentTextIcon} label="Comptes rendus" />}
          {["admin", "normal", "restricted-access"].includes(role) && (
            <>
              <hr />
              <NavItem to="/structure" icon={BuildingOffice2Icon} label="Contacts" />
              <NavItem to="https://soliguide.fr/" icon={MapPinIcon} label="Soliguide" external />
              <hr />
            </>
          )}
          {["admin", "normal"].includes(role) && isDesktop && <NavItem to="/stats" icon={ChartBarIcon} label="Statistiques" />}
          {["admin"].includes(role) && isDesktop && (
            <>
              <hr />
              <NavItem to={`/organisation/${organisation._id}`} icon={BuildingOfficeIcon} label="Organisation" id="show-on-onboarding" />
              <NavItem to="/team" icon={UsersIcon} label="Équipes" id="show-on-onboarding" />
              <NavItem to="/user" icon={UserCircleIcon} label="Utilisateurs" />
              {import.meta.env.VITE_ADD_MULTIPLE_PERSONS_BUTTON === "true" && !onboardingForTeams && !collapsed && (
                <>
                  <hr />
                  <li>
                    <AddPersons />
                  </li>
                </>
              )}
            </>
          )}
        </div>
        {!collapsed && (
          <div className="tw-mb-4 tw-mt-auto tw-flex tw-flex-col tw-justify-between tw-text-[0.65rem] tw-text-main">
            <p className="m-0">Version&nbsp;: {deploymentCommit}</p>
            <p className="m-0">Accessibilité&nbsp;: partielle</p>
            <SessionCountDownLimiter />
          </div>
        )}
        <button
          type="button"
          aria-label="Cacher la navigation latérale"
          className="tw-absolute tw-right-2 tw-top-2 tw-text-gray-900 sm:tw-hidden sm:tw-px-6"
          onClick={() => setShowDrawer(!showDrawer)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="tw-h-6 tw-w-6">
            <path
              fillRule="evenodd"
              d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      {isDesktop && (
        <button
          type="button"
          aria-label={isCollapsed ? "Déplier la navigation" : "Replier la navigation"}
          className="tw-absolute tw-top-3 tw-flex tw-h-10 tw-w-5 tw-items-center tw-justify-center tw-rounded-r-md tw-border tw-border-l-0 tw-border-gray-200 tw-bg-white tw-text-gray-400 tw-shadow-sm tw-transition-all hover:tw-bg-gray-50 hover:tw-text-gray-600"
          style={{ left: isCollapsed ? "4rem" : "13rem" }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronDoubleRightIcon className="tw-h-4 tw-w-4" /> : <ChevronDoubleLeftIcon className="tw-h-4 tw-w-4" />}
        </button>
      )}
    </nav>
  );
};

export default Drawer;
