import { useCallback, useEffect, useState } from "react";
import API, { tryFetchExpectOk } from "../../services/api";
import { UserInstance } from "../../types/user";
import { TeamInstance } from "../../types/team";
import { OrganisationInstance } from "../../types/organisation";
import { formatDateWithFullMonth } from "../../services/date";
import { ModalContainer, ModalBody, ModalHeader, ModalFooter } from "../../components/tailwind/Modal";
import { toast } from "react-toastify";
import { errorMessage } from "../../utils";
import Search from "../../components/search";
import UserStatus from "../../components/UserStatus";
import { MoonIcon } from "@heroicons/react/24/outline";
import StethoscopeIcon from "../../components/StethoscopeIcon";

export default function SuperadminUsersSearch({
  open,
  setOpen,
  setSelectedOrganisation,
  refresh,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  setSelectedOrganisation: (organisation: OrganisationInstance) => void;
  refresh: boolean;
}) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const onClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  useEffect(() => {
    if (!search?.length || search.length < 3) {
      setUsers([]);
      return;
    }
    setIsLoading(true);
    tryFetchExpectOk(() => API.get({ path: `/user/search`, query: { search } })).then(([error, response]) => {
      if (error) {
        return toast.error(errorMessage(error));
      }
      setUsers(response.data);
      setIsLoading(false);
    });
  }, [open, search, refresh]);

  return (
    <ModalContainer
      open={open}
      onClose={onClose}
      size="full"
      onAfterLeave={() => {
        setIsLoading(false);
        setSearch("");
        setUsers([]);
      }}
    >
      <ModalHeader title={"Rechercher un utilisateur"} onClose={onClose} />
      <ModalBody>
        <div className="tw-w-full tw-flex tw-flex-col tw-items-center tw-justify-center">
          <div className="tw-w-full tw-flex tw-flex-col tw-items-center tw-justify-center [&>div]:tw-max-w-96 tw-my-4">
            <Search placeholder={`Rechercher par nom ou email...`} value={search} onChange={setSearch} />
          </div>
          {users.length === 0 && (
            <div>
              <div className="tw-p-4 tw-text-center">
                Aucun résultat
                {search.length < 3 ? " (minimum 3 caractères)" : ""}
                {isLoading ? <span className="tw-animate-pulse"> (recherche en cours...)</span> : ""}
              </div>
              <img src="https://gifsec.com/wp-content/uploads/2022/09/waiting-gif-13-1.gif" className="tw-h-72 tw-w-96 tw-m-4 tw-object-cover" />
            </div>
          )}
          {users.length > 0 && (
            <div className="tw-p-4 tw-w-full">
              {users.length} utilisateur(rice){users.length > 1 ? "s" : ""} trouvé{users.length > 1 ? "s" : ""}
              <div className="tw-text-sm tw-opacity-70 tw-font-normal">
                <b>Cliquez sur un utilisateur</b> pour pouvoir faire des actions (modifier, supprimer, activer, lien de connexion, etc.) depuis son
                organisation.
              </div>
            </div>
          )}
          {users.length > 0 && (
            <table className="table table-striped table-bordered tw-text-sm">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Statut</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Équipes</th>
                  <th>Organisation</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: UserInstance & { teams: TeamInstance[] }) => (
                  <tr
                    key={user._id}
                    className="tw-hover:tw-bg-gray-100"
                    onClick={() => {
                      setSelectedOrganisation(user.organisationPopulated);
                      setOpen(true);
                    }}
                  >
                    <td>
                      {user.name || "Pas de nom renseigné"}
                      <div className="tw-mt-1 tw-text-xs tw-text-gray-500">Créé·e le {formatDateWithFullMonth(user.createdAt)}</div>
                      <div className="tw-mt-1 tw-text-xs tw-text-gray-500">
                        {user.lastLoginAt ? `Dernière connexion le ${formatDateWithFullMonth(user.lastLoginAt)}` : "Jamais connecté·e"}
                      </div>
                    </td>
                    <td>
                      <UserStatus user={user} />
                    </td>
                    <td>
                      {user.email}
                      {user.phone ? <div>{user.phone}</div> : ""}
                    </td>
                    <td>
                      <div>{user.role}</div>
                      {user.healthcareProfessional ? (
                        <div className="tw-text-xs tw-flex tw-items-center">
                          <StethoscopeIcon className="tw-w-3 tw-h-3 tw-text-sky-700" />
                          &nbsp;pro.&nbsp;santé
                        </div>
                      ) : (
                        ""
                      )}
                    </td>
                    <td>
                      <div className="tw-grid tw-gap-1">
                        {user.teams.map((team: TeamInstance) => (
                          <div
                            key={team?._id}
                            style={{
                              backgroundColor: "#255c99cc",
                              borderColor: "#255c99",
                            }}
                            className="tw-inline-flex tw-justify-center tw-gap-4 tw-rounded tw-border tw-px-2.5 tw-py-0.5 tw-text-center tw-text-xs tw-text-white"
                          >
                            {team.nightSession && <MoonIcon className="tw-h-3.5 tw-w-3.5" />}
                            {team.name}
                          </div>
                        ))}
                      </div>
                    </td>

                    <td>
                      <button
                        onClick={() => {
                          setSelectedOrganisation(user.organisationPopulated);
                          setOpen(true);
                        }}
                        type="button"
                        className="hover:tw-underline focus:tw-underline tw-text-left"
                      >
                        {user.organisationPopulated?.name}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <button className="button-cancel" onClick={onClose}>
          Fermer
        </button>
      </ModalFooter>
    </ModalContainer>
  );
}
