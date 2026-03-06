import { Link, NavLink } from "react-router-dom";
import { atom, useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { currentTeamState, organisationState, teamsState, userState } from "../atoms/auth";
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
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from "@heroicons/react/20/solid";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { getTeamColors } from "./TagTeam";
import MenuUser from "./MenuUser";

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
        <NavLink to={to} activeClassName="active" aria-current="page" title={collapsed ? label : undefined}>
          {linkContent}
        </NavLink>
      </li>
    );
  };

  return (
    <nav
      title="Navigation principale"
      className={[
        "noprint tw-absolute tw-flex tw-h-screen tw-w-screen tw-opacity-100 tw-transition-all sm:!tw-pointer-events-auto sm:!tw-visible sm:tw-relative sm:tw-h-auto sm:tw-w-auto sm:tw-translate-x-0 sm:tw-bg-transparent",
        showDrawer ? "tw-visible tw-z-30 tw-translate-x-0 tw-transition-all" : "tw-pointer-events-none tw-invisible tw-z-[-1] -tw-translate-x-full",
      ].join(" ")}
    >
      <div
        className={[
          "noprint tw-relative tw-max-h-full tw-min-w-min tw-shrink-0 tw-flex-col tw-justify-between tw-overflow-y-auto tw-border-opacity-10 tw-bg-[#E1E3E3] tw-drop-shadow-xl tw-transition-all tw-duration-300 sm:!tw-flex sm:tw-drop-shadow-none",
          isCollapsed && isDesktop ? "tw-w-16 tw-basis-16 tw-px-2" : "tw-w-64 tw-basis-52 tw-px-2",
          isOnboarding ? "[&_li:not(#show-on-onboarding)]:tw-pointer-events-none [&_li:not(#show-on-onboarding)]:tw-opacity-20" : "",
        ].join(" ")}
      >
        {!["superadmin"].includes(user.role) && <TeamSelector />}
        <div className="mt-2 [&_a.active]:tw-text-main [&_a.active]:tw-underline [&_a:hover]:tw-text-main [&_a]:tw-my-2 [&_a]:tw-block [&_a]:tw-rounded-lg [&_a]:tw-py-0.5 [&_a]:tw-text-sm [&_a]:tw-font-semibold [&_a]:tw-text-black75 [&_li]:tw-list-none tw-bg-white tw-rounded-xl tw-px-2">
          {["admin", "normal"].includes(role) && isDesktop && <NavItem to="/search" icon={MagnifyingGlassIcon} label="Recherche" />}
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
              <NavItem to="/structure" icon={BuildingOffice2Icon} label="Contacts" />
              <NavItem to="https://soliguide.fr/" icon={MapPinIcon} label="Soliguide" external />
            </>
          )}
          {["admin", "normal"].includes(role) && isDesktop && <NavItem to="/stats" icon={ChartBarIcon} label="Statistiques" />}
        </div>
        <div className="mt-2 [&_a.active]:tw-text-main [&_a.active]:tw-underline [&_a:hover]:tw-text-main [&_a]:tw-my-2 [&_a]:tw-block [&_a]:tw-rounded-lg [&_a]:tw-py-0.5 [&_a]:tw-text-sm [&_a]:tw-font-semibold [&_a]:tw-text-black75 [&_li]:tw-list-none tw-bg-white tw-rounded-xl tw-px-2">
          {["admin"].includes(role) && isDesktop && (
            <>
              <NavItem to={`/organisation/${organisation._id}`} icon={BuildingOfficeIcon} label="Organisation" id="show-on-onboarding" />
              <NavItem to="/team" icon={UsersIcon} label="Équipes" id="show-on-onboarding" />
              <NavItem to="/user" icon={UserCircleIcon} label="Utilisateurs" />
            </>
          )}
        </div>
        {import.meta.env.VITE_ADD_MULTIPLE_PERSONS_BUTTON === "true" && !onboardingForTeams && !collapsed && (
          <divx className="mt-2 [&_a.active]:tw-text-main [&_a.active]:tw-underline [&_a:hover]:tw-text-main [&_a]:tw-my-2 [&_a]:tw-block [&_a]:tw-rounded-lg [&_a]:tw-py-0.5 [&_a]:tw-text-sm [&_a]:tw-font-semibold [&_a]:tw-text-black75 [&_li]:tw-list-none tw-bg-white tw-rounded-xl tw-px-2">
            <li>
              <AddPersons />
            </li>
          </divx>
        )}
        <MenuUser isDrawerCollapsed={isCollapsed} className={["tw-mt-auto tw-mb-4", isCollapsed ? "tw-w-full" : ""].join(" ")} />
        {!collapsed && (
          <div className="tw-mb-4 tw-flex tw-flex-col tw-justify-between tw-text-[0.5rem] tw-text-main">
            <p className="m-0">Version&nbsp;: {deploymentCommit}</p>
            <p className="m-0">Accessibilité&nbsp;: partielle</p>
            <Link to="/plan-du-site" className="m-0 tw-text-main hover:tw-underline">
              Plan du site
            </Link>
          </div>
        )}
        <button
          type="button"
          aria-label="Cacher la navigation latérale"
          aria-expanded={showDrawer}
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
          aria-expanded={!isCollapsed}
          className="tw-absolute tw-top-12 tw-flex tw-h-10 tw-w-5 tw-items-center tw-justify-center tw-rounded-r-md tw-border tw-border-l-0 tw-border-gray-200 tw-bg-white tw-text-gray-400 tw-shadow-sm tw-transition-all hover:tw-bg-gray-50 hover:tw-text-gray-600"
          style={{ left: isCollapsed ? "4rem" : "14rem" }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronDoubleRightIcon className="tw-h-4 tw-w-4" /> : <ChevronDoubleLeftIcon className="tw-h-4 tw-w-4" />}
        </button>
      )}
    </nav>
  );
};

function TeamSelector() {
  const [currentTeam, setCurrentTeam] = useAtom(currentTeamState);
  const teams = useAtomValue(teamsState);
  const user = useAtomValue(userState);
  const availableTeams = user.role === "admin" ? teams : user.teams;
  const { backgroundColor, borderColor } = getTeamColors(
    currentTeam,
    availableTeams.findIndex((t) => t._id === currentTeam?._id)
  );
  const isDrawerCollapsed = useAtomValue(isDrawerCollapsedState);

  return (
    <Menu as="div" className="tw-relative tw-w-full">
      {({ open }) => (
        <>
          <MenuButton
            style={{
              backgroundColor: backgroundColor,
              borderColor: borderColor,
            }}
            className={[
              "tw-rounded-xl tw-border tw-px-3 tw-py-2 tw-text-white tw-flex tw-items-center tw-transition-colors tw-text-sm",
              isDrawerCollapsed ? "tw-w-full tw-justify-center" : "tw-w-52 tw-justify-between",
            ].join(" ")}
          >
            {!isDrawerCollapsed && <span className="tw-truncate">{currentTeam?.name}</span>}
            <ChevronDownIcon className={`tw-h-4 tw-w-4 tw-transition-transform ${open ? "tw-rotate-180" : ""}`} />
          </MenuButton>
          <MenuItems
            anchor="bottom start"
            className="tw-z-50 tw-rounded tw-bg-white tw-shadow-lg tw-ring-1 tw-ring-black/5 focus:tw-outline-none tw-max-h-60 tw-overflow-y-auto"
          >
            {availableTeams.map((team) => {
              const _teamColors = getTeamColors(
                team,
                availableTeams.findIndex((t) => t._id === team._id)
              );
              return (
                <MenuItem key={team._id}>
                  <button
                    type="button"
                    onClick={() => setCurrentTeam(team)}
                    className={[
                      "tw-block tw-w-full tw-px-4 tw-py-2 tw-text-sm tw-text-left tw-whitespace-nowrap",
                      currentTeam?._id === team._id ? "tw-bg-gray-100" : "",
                      currentTeam?._id === team._id ? "tw-font-semibold tw-text-main" : "tw-text-gray-700",
                    ].join(" ")}
                  >
                    <span className="tw-flex tw-items-center tw-gap-2">
                      <span
                        className="tw-inline-block tw-h-3 tw-w-3 tw-rounded-full tw-shrink-0"
                        style={{ backgroundColor: _teamColors.backgroundColor, border: `1px solid ${_teamColors.borderColor}` }}
                      />
                      {team.name}
                    </span>
                  </button>
                </MenuItem>
              );
            })}
          </MenuItems>
        </>
      )}
    </Menu>
  );
}

export default Drawer;
