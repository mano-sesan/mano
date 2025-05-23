import { useCallback, useEffect, useState } from "react";
import API, { tryFetchExpectOk } from "../../services/api";
import { UserInstance } from "../../types/user";
import { TeamInstance } from "../../types/team";
import { OrganisationInstance } from "../../types/organisation";
import { formatDateWithFullMonth } from "../../services/date";
import { ModalContainer, ModalBody, ModalHeader, ModalFooter } from "../../components/tailwind/Modal";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";
import { toast } from "react-toastify";
import UserStatus from "../../components/UserStatus";

export default function SuperadminOrganisationUsers({
  organisation,
  setOpen,
  setOpenCreateUserModal,
  setOpenEditUserModal,
  setEditUser,
  open,
  openCreateUserModal,
  openEditUserModal,
}: {
  organisation: OrganisationInstance;
  setOpen: (open: boolean) => void;
  setOpenCreateUserModal: (open: boolean) => void;
  setEditUser: (user: UserInstance) => void;
  setOpenEditUserModal: (open: boolean) => void;
  open: boolean;
  openCreateUserModal: boolean;
  openEditUserModal: boolean;
}) {
  const [users, setUsers] = useState([]);
  const [isGeneratingLinkForUser, setIsGeneratingLinkForUser] = useState<false | string>(false);
  const [generatedLink, setGeneratedLink] = useState<[string, string] | undefined>();
  const [isReleasingUser, setIsReleasingUser] = useState<false | string>(false);
  const [isReactivatingUser, setIsReactivatingUser] = useState<false | string>(false);

  const onClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  useEffect(() => {
    if (organisation?._id && open) {
      if (!openCreateUserModal && !openEditUserModal) {
        tryFetchExpectOk(() => API.get({ path: `/user`, query: { organisation: organisation._id } })).then(([error, response]) => {
          if (!error) {
            setUsers(response.data);
          }
        });
      }
    } else {
      onClose();
    }
  }, [organisation?._id, open, openCreateUserModal, openEditUserModal, onClose]);

  return (
    <ModalContainer open={open} onClose={onClose} size="full">
      <ModalHeader title={`Utilisateurs de l'organisation ${organisation?.name}`} key={organisation?._id} onClose={onClose} />
      <ModalBody>
        <table className="table table-striped table-bordered tw-text-sm">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Statut</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Équipes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user: UserInstance & { teams: TeamInstance[] }) => (
              <tr key={user._id}>
                <td>
                  {user.name || "Pas de nom renseigné"}
                  <div className="tw-mt-1 tw-text-xs tw-text-gray-500">
                    Créé·e le {formatDateWithFullMonth(user.createdAt)} -{" "}
                    {user.lastLoginAt ? `Dernière connexion le ${formatDateWithFullMonth(user.lastLoginAt)}` : "Jamais connecté·e"}
                  </div>
                  <div className="tw-mt-1 tw-text-xs">
                    <div>
                      {isGeneratingLinkForUser === user._id ? (
                        <div className="tw-flex tw-animate-pulse tw-items-center tw-text-orange-700">Génération du lien de connexion en cours…</div>
                      ) : (
                        <>
                          {generatedLink && generatedLink[0] === user._id && (
                            <div className="tw-flex tw-cursor-default tw-items-center tw-text-green-700">✅ {generatedLink[1]}</div>
                          )}
                          <button
                            className="tw-cursor-pointer tw-text-main hover:tw-underline focus:tw-underline"
                            onClick={() => {
                              setIsGeneratingLinkForUser(user._id);
                              setGeneratedLink(undefined);
                              (async () => {
                                const [error, response] = await tryFetchExpectOk(async () =>
                                  API.post({ path: `/user/generate-link`, body: { _id: user._id } })
                                );
                                if (error) return toast.error("Erreur lors de la génération du lien de connexion");
                                setGeneratedLink([user._id, response.data.link]);
                                setIsGeneratingLinkForUser(false);
                              })();
                            }}
                          >
                            {generatedLink && generatedLink[0] === user._id ? "🔄 Régénérer" : "Générer un lien de connexion"}
                          </button>
                        </>
                      )}
                    </div>
                    <div>
                      {(user.loginAttempts > 12 || user.decryptAttempts > 12) && (
                        <>
                          {isReleasingUser === user._id ? (
                            <div className="tw-flex tw-animate-pulse tw-items-center tw-text-orange-700">Déblocage de l'utilisateur en cours…</div>
                          ) : (
                            <button
                              className="tw-cursor-pointer tw-text-main hover:tw-underline focus:tw-underline"
                              onClick={() => {
                                setIsReleasingUser(user._id);
                                (async () => {
                                  const [error] = await tryFetchExpectOk(async () =>
                                    API.post({ path: `/user/release-user`, body: { _id: user._id } })
                                  );
                                  if (error) return toast.error("Erreur lors de la déblocage de l'utilisateur");
                                  const [usersError, response] = await tryFetchExpectOk(() =>
                                    API.get({ path: `/user`, query: { organisation: organisation._id } })
                                  );
                                  if (!usersError) {
                                    setUsers(response.data);
                                  }
                                  toast.success("Utilisateur débloqué");
                                  setIsReleasingUser(false);
                                })();
                              }}
                            >
                              {"Débloquer l'utilisateur (mot de passe + clé de chiffrement)"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      {user.disabledAt && (
                        <>
                          {isReactivatingUser === user._id ? (
                            <div className="tw-flex tw-animate-pulse tw-items-center tw-text-orange-700">Réactivation de l'utilisateur en cours…</div>
                          ) : (
                            <button
                              className="tw-cursor-pointer tw-text-main hover:tw-underline focus:tw-underline"
                              onClick={() => {
                                setIsReactivatingUser(user._id);
                                (async () => {
                                  const [error] = await tryFetchExpectOk(async () =>
                                    API.post({ path: `/user/reactivate-user`, body: { _id: user._id } })
                                  );
                                  if (error) return toast.error("Erreur lors de la réactivation de l'utilisateur");
                                  toast.success("Utilisateur réactivé");
                                  setIsReactivatingUser(false);
                                  // Refresh user data
                                  const updatedUser = { ...user, disabledAt: null };
                                  setUsers(users.map((u) => (u._id === user._id ? updatedUser : u)));
                                })();
                              }}
                            >
                              Réactiver l'utilisateur
                            </button>
                          )}
                        </>
                      )}
                    </div>
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
                  {user.healthcareProfessional ? <div>🧑‍⚕️ professionnel·le de santé</div> : ""}
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
                        {team.nightSession && <span>🌒</span>}
                        {team.name}
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="tw-grid tw-gap-2">
                    <DeleteButtonAndConfirmModal
                      title={`Voulez-vous vraiment supprimer l'utilisateur ${user.name}`}
                      textToConfirm={user.email}
                      onConfirm={async () => {
                        const [error] = await tryFetchExpectOk(async () => API.delete({ path: `/user/${user._id}` }));
                        if (error) return;
                        toast.success("Suppression réussie");
                        setUsers(users.filter((u) => u._id !== user._id));
                      }}
                    >
                      <span className="tw-mb-7 tw-block tw-w-full tw-text-center">Cette opération est irréversible</span>
                    </DeleteButtonAndConfirmModal>
                    <button
                      className="button-submit"
                      onClick={() => {
                        setOpenEditUserModal(true);
                        setEditUser(user);
                      }}
                    >
                      Modifier
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ModalBody>
      <ModalFooter>
        <button className="button-cancel" onClick={onClose}>
          Fermer
        </button>
        <button className="button-submit" onClick={() => setOpenCreateUserModal(true)}>
          Ajouter un utilisateur
        </button>
      </ModalFooter>
    </ModalContainer>
  );
}
