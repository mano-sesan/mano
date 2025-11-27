import { useMemo } from "react";
import { useRecoilValue } from "recoil";
import { actionsState } from "../../recoil/actions";
import { usersState } from "../../recoil/auth";
import { personsState } from "../../recoil/persons";
import Table from "../../components/table";
import { formatDateWithFullMonth, formatAge } from "../../services/date";
import TagTeam from "../../components/TagTeam";
import ActionOrConsultationName from "../../components/ActionOrConsultationName";
import DateBloc, { TimeBlock } from "../../components/DateBloc";
import { DONE, CANCEL } from "../../recoil/actions";
import { useLocalStorage } from "../../services/useLocalStorage";

export default function ActionsWithoutPersons() {
  const actions = useRecoilValue(actionsState);
  const persons = useRecoilValue(personsState);
  const users = useRecoilValue(usersState);

  const [sortBy, setSortBy] = useLocalStorage("actions-without-persons-sortBy", "dueAt");
  const [sortOrder, setSortOrder] = useLocalStorage("actions-without-persons-sortOrder", "DESC");

  // Create a Set of existing person IDs for efficient lookup
  const existingPersonIds = useMemo(() => {
    return new Set(persons.map((person) => person._id));
  }, [persons]);

  // Filter actions that don't have a person or have a person that doesn't exist
  const actionsWithoutPersons = useMemo(() => {
    return actions.filter((action) => {
      // Action has no person field or person is null/undefined
      if (!action.person) return true;

      // Action has a person field but the person doesn't exist in the persons list
      return !existingPersonIds.has(action.person);
    });
  }, [actions, existingPersonIds]);

  // Sort actions
  const sortedActions = useMemo(() => {
    return [...actionsWithoutPersons].sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Handle date fields
      if (sortBy === "dueAt" || sortBy === "createdAt" || sortBy === "updatedAt") {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      }

      // Handle string fields
      if (typeof aValue === "string" && typeof bValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === "ASC") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [actionsWithoutPersons, sortBy, sortOrder]);

  return (
    <div>
      <Disclaimer />
      <div className="tw-mb-4">
        <p className="tw-text-lg tw-font-semibold">
          {actionsWithoutPersons.length} action{actionsWithoutPersons.length > 1 ? "s" : ""} sans personne associée
        </p>
      </div>

      <Table
        data={sortedActions}
        rowKey={"_id"}
        noData="Aucune action sans personne associée"
        columns={[
          {
            title: "Date",
            dataKey: "dueAt",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortBy,
            sortOrder,
            style: { width: "90px" },
            small: true,
            render: (action) => {
              return (
                <>
                  <DateBloc date={[DONE, CANCEL].includes(action.status) ? action.completedAt || action.dueAt : action.dueAt} />
                  {!action.dueAt || !action.withTime ? null : <TimeBlock time={action.dueAt} />}
                </>
              );
            },
          },
          {
            title: "Nom",
            dataKey: "name",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortBy,
            sortOrder,
            render: (action) => (
              <>
                <ActionOrConsultationName item={action} />
                <div className="tw-text-gray-500 tw-text-xs">{action.description}</div>
              </>
            ),
          },
          {
            title: "Statut",
            dataKey: "status",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortBy,
            sortOrder,
            render: (action) => (
              <span
                className={`tw-px-2 tw-py-1 tw-rounded tw-text-xs tw-font-medium ${
                  action.status === "FAIT"
                    ? "tw-bg-green-100 tw-text-green-800"
                    : action.status === "ANNULEE"
                      ? "tw-bg-red-100 tw-text-red-800"
                      : "tw-bg-yellow-100 tw-text-yellow-800"
                }`}
              >
                {action.status}
              </span>
            ),
          },
          {
            title: "Catégories",
            dataKey: "categories",
            render: (action) => (
              <div className="tw-flex tw-flex-wrap tw-gap-1">
                {action.categories?.length > 0 ? (
                  action.categories.map((category, index) => (
                    <span key={index} className="tw-px-2 tw-py-1 tw-bg-blue-100 tw-text-blue-800 tw-rounded tw-text-xs">
                      {category}
                    </span>
                  ))
                ) : (
                  <span className="tw-text-gray-500 tw-text-xs">Aucune catégorie</span>
                )}
              </div>
            ),
          },
          {
            title: "Équipe(s) en charge",
            dataKey: "teams",
            render: (action) => {
              if (!Array.isArray(action?.teams)) return <TagTeam teamId={action?.team} />;
              return (
                <div className="tw-flex tw-flex-col">
                  {action.teams.map((teamId) => (
                    <TagTeam key={teamId} teamId={teamId} />
                  ))}
                </div>
              );
            },
          },
          {
            title: "Personne associée",
            dataKey: "person",
            render: (action) => (
              <div className="tw-text-red-600 tw-font-medium">
                {action.person ? (
                  <>
                    <div>ID: {action.person}</div>
                    <div className="tw-text-xs tw-text-red-500">(Personne introuvable)</div>
                  </>
                ) : (
                  <div className="tw-text-xs">Aucune personne</div>
                )}
              </div>
            ),
          },
          {
            title: "Créé le",
            dataKey: "createdAt",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortBy,
            sortOrder,
            render: (action) => (
              <>
                <div>{formatDateWithFullMonth(action.createdAt)}</div>
                <div className="tw-text-gray-500 tw-text-xs">il y a {action.createdAt ? formatAge(action.createdAt) : "un certain temps"}</div>
                {action.user && (
                  <div className="tw-text-gray-500 tw-text-xs">par {users.find((u) => u._id === action.user)?.name || action.user}</div>
                )}
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="tw-mb-8 tw-border-l-4 tw-border-red-500 tw-bg-red-100 tw-p-4 tw-text-red-700" role="alert">
      <div className="tw-font-semibold tw-mb-2">Actions sans personne associée</div>
      <div>
        Vous retrouvez ici toutes les actions qui n'ont pas de personne associée ou dont la personne associée n'existe plus. Ces actions peuvent être
        le résultat de suppressions de personnes ou d'erreurs de données. Il est recommandé de vérifier et corriger ces incohérences pour maintenir
        l'intégrité des données.
      </div>
    </div>
  );
}
