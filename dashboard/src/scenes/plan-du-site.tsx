import { Link } from "react-router-dom";
import { useAtomValue } from "jotai";
import { organisationState, userState } from "../atoms/auth";
import useTitle from "../services/useTitle";

export default function PlanDuSite() {
  useTitle("Plan du site");
  const user = useAtomValue(userState);
  const organisation = useAtomValue(organisationState);
  const role = user?.role;

  return (
    <>
      <h1 className="tw-text-xl tw-my-8 tw-font-normal">Plan du site</h1>
      <nav aria-label="Plan du site">
        <ul className="tw-list-none tw-space-y-6 tw-p-0">
          {["admin", "normal", "restricted-access"].includes(role) && (
            <li>
              <h2 className="tw-text-lg tw-font-semibold tw-mb-2">Suivi</h2>
              <ul className="tw-list-none tw-space-y-1 tw-pl-4">
                {!!organisation.receptionEnabled && (
                  <li>
                    <Link to="/reception" className="tw-text-main hover:tw-underline">
                      Accueil
                    </Link>
                  </li>
                )}
                <li>
                  <Link to="/action" className="tw-text-main hover:tw-underline">
                    Agenda
                  </Link>
                </li>
                <li>
                  <Link to="/person" className="tw-text-main hover:tw-underline">
                    Personnes suivies
                  </Link>
                </li>
                {!!organisation.territoriesEnabled && (
                  <li>
                    <Link to="/territory" className="tw-text-main hover:tw-underline">
                      Territoires
                    </Link>
                  </li>
                )}
                <li>
                  <Link to="/report" className="tw-text-main hover:tw-underline">
                    Comptes rendus
                  </Link>
                </li>
              </ul>
            </li>
          )}
          {["admin", "normal", "restricted-access"].includes(role) && (
            <li>
              <h2 className="tw-text-lg tw-font-semibold tw-mb-2">Ressources</h2>
              <ul className="tw-list-none tw-space-y-1 tw-pl-4">
                <li>
                  <Link to="/structure" className="tw-text-main hover:tw-underline">
                    Contacts
                  </Link>
                </li>
              </ul>
            </li>
          )}
          {["admin", "normal"].includes(role) && (
            <li>
              <h2 className="tw-text-lg tw-font-semibold tw-mb-2">Analyse</h2>
              <ul className="tw-list-none tw-space-y-1 tw-pl-4">
                <li>
                  <Link to="/search" className="tw-text-main hover:tw-underline">
                    Recherche
                  </Link>
                </li>
                <li>
                  <Link to="/stats" className="tw-text-main hover:tw-underline">
                    Statistiques
                  </Link>
                </li>
              </ul>
            </li>
          )}
          {["admin"].includes(role) && (
            <li>
              <h2 className="tw-text-lg tw-font-semibold tw-mb-2">Administration</h2>
              <ul className="tw-list-none tw-space-y-1 tw-pl-4">
                <li>
                  <Link to={`/organisation/${organisation._id}`} className="tw-text-main hover:tw-underline">
                    Organisation
                  </Link>
                </li>
                <li>
                  <Link to="/team" className="tw-text-main hover:tw-underline">
                    Équipes
                  </Link>
                </li>
                <li>
                  <Link to="/user" className="tw-text-main hover:tw-underline">
                    Utilisateurs
                  </Link>
                </li>
              </ul>
            </li>
          )}
          <li>
            <h2 className="tw-text-lg tw-font-semibold tw-mb-2">Mon compte</h2>
            <ul className="tw-list-none tw-space-y-1 tw-pl-4">
              <li>
                <Link to="/account" className="tw-text-main hover:tw-underline">
                  Paramètres du compte
                </Link>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </>
  );
}
