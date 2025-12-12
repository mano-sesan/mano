import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import { useAtom, useAtomValue } from "jotai";
import structuredClone from "@ungap/structured-clone";
import { teamsState, usersState, userState } from "../../atoms/auth";
import API, { tryFetch, tryFetchExpectOk } from "../../services/api";
import { formatDateWithFullMonth } from "../../services/date";
import useTitle from "../../services/useTitle";
import { useLocalStorage } from "../../services/useLocalStorage";
import { ModalBody, ModalContainer, ModalHeader, ModalFooter } from "../../components/tailwind/Modal";
import SelectTeamMultiple from "../../components/SelectTeamMultiple";
import Loading from "../../components/loading";
import Table from "../../components/table";
import TagTeam from "../../components/TagTeam";
import SelectRole from "../../components/SelectRole";
import { emailRegex, errorMessage } from "../../utils";
import UserStatus from "../../components/UserStatus";

const getUserStatus = (user) => {
  if (user.disabledAt) return "Désactivé";
  if (user.decryptAttempts > 12 || user.loginAttempts > 12) return "Bloqué";
  if (!user.lastLoginAt) return "Pas encore actif";
  return "Actif";
};

const defaultSort = (a, b, sortOrder) => (sortOrder === "ASC" ? (a.name || "").localeCompare(b.name) : (b.name || "").localeCompare(a.name));

const sortUsers = (sortBy, sortOrder) => (a, b) => {
  if (sortBy === "status") {
    const statusA = getUserStatus(a);
    const statusB = getUserStatus(b);
    if (statusA === statusB) return defaultSort(a, b, sortOrder);
    return sortOrder === "ASC" ? statusA.localeCompare(statusB) : statusB.localeCompare(statusA);
  }
  if (sortBy === "email") {
    return sortOrder === "ASC" ? a.email.localeCompare(b.email) : b.email.localeCompare(a.email);
  }
  if (sortBy === "role") {
    if (a.role === b.role) return defaultSort(a, b, sortOrder);
    return sortOrder === "ASC" ? a.role.localeCompare(b.role) : b.role.localeCompare(a.role);
  }
  if (sortBy === "createdAt") {
    if (a.createdAt > b.createdAt) return sortOrder === "ASC" ? 1 : -1;
    if (a.createdAt < b.createdAt) return sortOrder === "ASC" ? -1 : 1;
    return defaultSort(a, b, sortOrder);
  }
  if (sortBy === "lastLoginAt") {
    if (!a.lastLoginAt && !b.lastLoginAt) return defaultSort(a, b, sortOrder);
    if (!a.lastLoginAt) return sortOrder === "ASC" ? -1 : 1;
    if (!b.lastLoginAt) return sortOrder === "ASC" ? 1 : -1;
    if (a.lastLoginAt > b.lastLoginAt) return sortOrder === "ASC" ? 1 : -1;
    if (a.lastLoginAt < b.lastLoginAt) return sortOrder === "ASC" ? -1 : 1;
    return defaultSort(a, b, sortOrder);
  }
  // default sort: name
  return defaultSort(a, b, sortOrder);
};

const List = () => {
  useTitle("Utilisateurs");

  const [users, setUsers] = useAtom(usersState);
  const user = useAtomValue(userState);

  const history = useHistory();

  const [refresh, setRefresh] = useState(true);

  const [sortBy, setSortBy] = useLocalStorage("users-sortBy", "createdAt");
  const [sortOrder, setSortOrder] = useLocalStorage("users-sortOrder", "ASC");

  const data = useMemo(() => structuredClone(users).sort(sortUsers(sortBy, sortOrder)), [users, sortBy, sortOrder]);

  useEffect(() => {
    tryFetchExpectOk(async () => API.get({ path: "/user" })).then(([error, response]) => {
      if (error) {
        toast.error(errorMessage(error));
        return false;
      }
      setUsers(response.data);
      setRefresh(false);
    });
  }, [refresh, setUsers]);

  if (!users.length) return <Loading />;

  return (
    <>
      <div className="tw-flex tw-w-full tw-items-center tw-mt-8 tw-mb-12">
        <div className="tw-grow tw-text-xl">Utilisateurs ({users.length})</div>
        <div>{["admin"].includes(user.role) && <Create users={users} onChange={() => setRefresh(true)} />}</div>
      </div>
      <Table
        data={data}
        rowKey={"_id"}
        onRowClick={(user) => history.push(`/user/${user._id}`)}
        columns={[
          {
            title: "Nom",
            dataKey: "name",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortOrder,
            sortBy,
          },
          {
            title: "Email",
            dataKey: "email",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortOrder,
            sortBy,
            render: (user) => {
              return <div className="tw-hyphens-auto tw-max-w-52">{user.email}</div>;
            },
          },
          {
            title: "Téléphone",
            dataKey: "phone",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortOrder,
            sortBy,
          },
          {
            title: "Rôle",
            dataKey: "role",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortOrder,
            sortBy,
            render: (user) => {
              return (
                <>
                  <span>{user.role}</span>
                  {user.healthcareProfessional ? <span className="tw-text-xs">🧑‍⚕️&nbsp;pro.&nbsp;de&nbsp;santé</span> : ""}
                </>
              );
            },
          },
          {
            title: "Équipes",
            dataKey: "teams",
            render: (user) => {
              return (
                <div className="tw-flex tw-flex-col tw-gap-1">
                  {(user.teams || []).map((t) => (
                    <TagTeam teamId={t._id} key={t._id} />
                  ))}
                </div>
              );
            },
          },

          {
            title: "Créé le",
            dataKey: "createdAt",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortOrder,
            sortBy,
            style: { minWidth: "150px" },
            render: (i) => formatDateWithFullMonth(i.createdAt),
          },
          {
            title: "Dernière connexion",
            dataKey: "lastLoginAt",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortOrder,
            sortBy,
            render: (i) => {
              if (!i.lastLoginAt) return <div className="tw-text-gray-500">Jamais connecté·e</div>;
              return formatDateWithFullMonth(i.lastLoginAt);
            },
          },
          {
            title: "Statut du compte",
            dataKey: "status",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortOrder,
            sortBy,
            render: (i) => <UserStatus user={i} />,
          },
        ]}
      />
    </>
  );
};

const Create = ({ onChange, users }) => {
  const [open, setOpen] = useState(false);
  const emailInputRef = React.useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const teams = useAtomValue(teamsState);
  const initialState = useMemo(() => {
    return {
      name: "",
      email: "",
      phone: "",
      role: "normal",
      team: teams.map((t) => t._id),
      healthcareProfessional: false,
    };
  }, [teams]);
  useEffect(() => {
    if (open) setData(initialState);
  }, [open, initialState]);
  const [data, setData] = useState(initialState);
  const handleChange = (event) => {
    const target = event.currentTarget || event.target;
    const { name, value } = target;
    setData((data) => ({ ...data, [name]: value }));
  };

  const handleSubmit = async (closeOnSubmit = false) => {
    try {
      if (data.role === "restricted-access") data.healthcareProfessional = false;
      if (!data.email) {
        toast.error("L'email est obligatoire");
        return false;
      }
      if (!emailRegex.test(data.email)) {
        toast.error("L'email est invalide");
        return false;
      }
      if (!data.role) {
        toast.error("Le rôle est obligatoire");
        return false;
      }
      if (!data.team?.length) {
        toast.error("Veuillez sélectionner une équipe");
        return false;
      }
      setIsSubmitting(true);
      const [error] = await tryFetch(async () => API.post({ path: "/user", body: data }));
      if (error) {
        toast.error(errorMessage(error));
        setIsSubmitting(false);
        return false;
      }
      toast.success("Création réussie !");
      if (closeOnSubmit) {
        setOpen(false);
      } else {
        setIsSubmitting(false);
        onChange();
        setData(initialState);
        // Focus email field to make it clear we're ready for a new entry
        setTimeout(() => emailInputRef.current?.focus(), 100);
      }
      return true;
    } catch (errorCreatingUser) {
      toast.error(errorCreatingUser.message);
      setIsSubmitting(false);
      return false;
    }
  };

  return (
    <div className="tw-flex tw-w-full tw-justify-end">
      <button type="button" className="button-submit" onClick={() => setOpen(true)}>
        Créer un utilisateur
      </button>
      <ModalContainer
        open={open}
        onClose={() => setOpen(false)}
        size="full"
        onAfterLeave={() => {
          setIsSubmitting(false);
        }}
      >
        <ModalHeader onClose={() => setOpen(false)} title="Créer de nouveaux utilisateurs" />
        <ModalBody>
          <form
            id="create-user-form"
            className="tw-p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const success = await handleSubmit(true);
              if (success) setOpen(false);
            }}
          >
            <div className="tw-flex tw-w-full tw-flex-wrap">
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <label htmlFor="email">Email</label>
                <input
                  ref={emailInputRef}
                  className="tailwindui"
                  autoComplete="off"
                  placeholder="email@truc.fr"
                  name="email"
                  id="email"
                  value={data.email}
                  onChange={handleChange}
                />
              </div>
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <label htmlFor="phone">Téléphone</label>
                <input
                  className="tailwindui"
                  autoComplete="off"
                  placeholder="0612345678"
                  name="phone"
                  id="phone"
                  value={data.phone}
                  onChange={handleChange}
                />
              </div>
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <label htmlFor="role">Role</label>
                <div className="tw-mt-1 tw-w-full">
                  <SelectRole handleChange={handleChange} value={data.role} />
                </div>
              </div>
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <label htmlFor="team">Équipe(s)</label>
                <div className="tw-mt-1 tw-w-full">
                  <SelectTeamMultiple
                    onChange={(teamIds) => handleChange({ target: { value: teamIds, name: "team" } })}
                    value={data.team}
                    inputId="team"
                    name="team"
                  />
                </div>
              </div>
              {/* <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <label htmlFor="email">Nom</label>
                <input
                  className="tailwindui"
                  placeholder="Le nom est optionnel"
                  name="name"
                  id="name"
                  type="search"
                  value={data.name}
                  onChange={handleChange}
                />
              </div> */}
              {data.role !== "restricted-access" && data.role !== "stats-only" && (
                <div className="tw-flex tw-basis-full tw-flex-col tw-px-4 tw-py-2">
                  <label htmlFor="healthcareProfessional" style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      style={{ marginRight: "0.5rem" }}
                      name="healthcareProfessional"
                      id="healthcareProfessional"
                      checked={data.healthcareProfessional}
                      onChange={() => {
                        handleChange({
                          target: {
                            name: "healthcareProfessional",
                            checked: Boolean(!data.healthcareProfessional),
                            value: Boolean(!data.healthcareProfessional),
                          },
                        });
                      }}
                    />
                    Professionnel·le de santé
                  </label>
                  <div>
                    <small className="text-muted">Un professionnel·le de santé a accès au dossier médical complet des personnes.</small>
                  </div>
                </div>
              )}
            </div>
            <details className="tw-mt-8">
              <summary>Utilisateurs existants ({users?.length ?? 0})</summary>
              <ul className="tw-mt-4 tw-grid tw-grid-cols-2 tw-flex-col tw-gap-2">
                {users.map((user) => {
                  return (
                    <React.Fragment key={user._id}>
                      <div className="tw-font-bold">{user.name}</div>
                      <div className="tw-text-sm tw-text-gray-500">{user.email}</div>
                    </React.Fragment>
                  );
                })}
              </ul>
            </details>
          </form>
        </ModalBody>
        <ModalFooter>
          <button name="Fermer" type="button" className="button-cancel" onClick={() => setOpen(false)}>
            Fermer
          </button>
          <button
            type="button"
            name="Créer et ajouter un autre"
            className="button-classic"
            onClick={async () => {
              await handleSubmit(false);
            }}
            disabled={isSubmitting}
          >
            Créer et ajouter un autre
          </button>
          <button type="submit" className="button-submit" form="create-user-form" disabled={isSubmitting}>
            Créer et fermer
          </button>
        </ModalFooter>
      </ModalContainer>
    </div>
  );
};

export default List;
