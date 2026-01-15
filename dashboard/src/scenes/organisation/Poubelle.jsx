import { useEffect, useMemo, useState } from "react";
import { atom, useAtomValue } from "jotai";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import API, { tryFetchExpectOk } from "../../services/api";
import Table from "../../components/table";
import { useLocalStorage } from "../../services/useLocalStorage";
import { dayjsInstance, formatAge, formatDateWithFullMonth } from "../../services/date";
import { deletedUsersState, organisationState, userState, usersState } from "../../atoms/auth";
import TagTeam from "../../components/TagTeam";
import { useDataLoader } from "../../services/dataLoader";
import Loading from "../../components/loading";
import { decryptItem } from "../../services/encryption";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";
import { personsState, sortPersons } from "../../atoms/persons";
import { personsObjectSelector } from "../../atoms/selectors";
import PersonName from "../../components/PersonName";
import ActionOrConsultationName from "../../components/ActionOrConsultationName";
import DateBloc, { TimeBlock } from "../../components/DateBloc";
import { CANCEL, DONE } from "../../atoms/actions";
import UserName from "../../components/UserName";
import { UserGroupIcon } from "@heroicons/react/16/solid";

async function fetchPersons(organisationId) {
  const [error, response] = await tryFetchExpectOk(async () => API.get({ path: "/organisation/" + organisationId + "/deleted-data" }));
  if (error) {
    throw new Error(error);
  }
  const decryptedData = {};
  for (const [key, value] of Object.entries(response.data)) {
    const decryptedEntries = (await Promise.all(value.map((item) => decryptItem(item, { decryptDeleted: true, type: "persons poubelle" })))).filter(
      (e) => e
    );
    decryptedData[key] = decryptedEntries;
  }
  return decryptedData;
}

const mergedPersonIdsSelector = atom((get) => {
  const persons = get(personsState);
  const mergedIds = new Set();

  for (const person of persons) {
    if (!person.history) continue;

    for (const historyEntry of person.history) {
      if (historyEntry.data?.merge?._id) {
        mergedIds.add(historyEntry.data.merge._id);
      }
    }
  }

  return Array.from(mergedIds);
});

export default function Poubelle() {
  const { refresh } = useDataLoader();
  const history = useHistory();
  const organisation = useAtomValue(organisationState);
  const user = useAtomValue(userState);
  const [persons, setPersons] = useState();
  const [data, setData] = useState(null);
  const [sortBy, setSortBy] = useLocalStorage("person-poubelle-sortBy", "name");
  const [sortOrder, setSortOrder] = useLocalStorage("person-poubelle-sortOrder", "ASC");
  const [refreshKey, setRefreshKey] = useState(0);
  const users = useAtomValue(usersState);
  const deletedUsers = useAtomValue(deletedUsersState);
  const personsObject = useAtomValue(personsObjectSelector);
  const mergedPersonIds = useAtomValue(mergedPersonIdsSelector);
  const canSeeTreatments = Boolean(user?.healthcareProfessional);

  useEffect(() => {
    fetchPersons(organisation._id).then((data) => {
      setData(data);
      setPersons(data.persons);
    });
  }, [organisation._id, refreshKey]);

  const deletedPersonsObject = useMemo(() => {
    const map = {};
    for (const p of data?.persons || []) map[p._id] = p;
    return map;
  }, [data?.persons]);

  const deletedTreatments = useMemo(() => {
    // Avoid mutating state arrays by sorting a copy.
    return (data?.treatments || []).slice().sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
  }, [data?.treatments]);

  const sortedPersons = useMemo(() => {
    if (!persons) return [];
    return persons.sort(sortPersons(sortBy, sortOrder));
  }, [persons, sortBy, sortOrder]);

  const treatmentDisplay = (treatment) => {
    let base = treatment?.name || "";
    if (treatment?.dosage) base += ` - ${treatment.dosage}`;
    if (treatment?.frequency) base += ` - ${treatment.frequency}`;
    if (treatment?.indication) base += ` - ${treatment.indication}`;
    return base || "-";
  };

  const restoreTreatment = async (treatment) => {
    const personExists = Boolean(personsObject?.[treatment.person]);
    const creatorIsActiveUser = Boolean(users?.find((u) => u._id === treatment.user));
    const creatorIsDeletedUser = Boolean(deletedUsers?.find((u) => u._id === treatment.user));
    const canRestore = personExists && creatorIsActiveUser;
    if (!canRestore) {
      if (!personExists) {
        toast.error("Impossible de restaurer le traitement : la personne suivie associée est supprimée (ou introuvable).");
        return;
      }
      if (!creatorIsActiveUser) {
        toast.error(
          creatorIsDeletedUser
            ? "Impossible de restaurer le traitement : l'utilisateur créateur a été supprimé."
            : "Impossible de restaurer le traitement : l'utilisateur créateur est introuvable."
        );
        return;
      }
      return;
    }

    if (!confirm("Voulez-vous restaurer ce traitement ?")) return;

    tryFetchExpectOk(() =>
      API.post({
        path: "/organisation/" + organisation._id + "/restore-deleted-data",
        body: {
          groups: [],
          persons: [],
          actions: [],
          comments: [],
          passages: [],
          rencontres: [],
          consultations: [],
          treatments: [treatment._id],
          medicalFiles: [],
          relsPersonPlaces: [],
          reports: [],
          places: [],
          territoryObservations: [],
          territories: [],
        },
      })
    ).then(([error]) => {
      if (!error) {
        refresh().then(() => {
          toast.success("Le traitement a été restauré avec succès !");
          setRefreshKey((k) => k + 1);
        });
      } else {
        toast.error("Impossible de restaurer le traitement");
      }
    });
  };

  const permanentDeleteTreatment = async (treatment) => {
    tryFetchExpectOk(() =>
      API.delete({
        path: "/organisation/" + organisation._id + "/permanent-delete-data",
        body: {
          groups: [],
          persons: [],
          actions: [],
          comments: [],
          passages: [],
          rencontres: [],
          consultations: [],
          treatments: [treatment._id],
          medicalFiles: [],
          relsPersonPlaces: [],
          reports: [],
          places: [],
          territoryObservations: [],
          territories: [],
        },
      })
    ).then(([error]) => {
      if (!error) {
        refresh().then(() => {
          toast.success("Le traitement a été supprimé définitivement avec succès !");
          setRefreshKey((k) => k + 1);
        });
      } else {
        toast.error("Impossible de supprimer définitivement le traitement");
      }
    });
  };

  const getAssociatedData = (id) => {
    const associatedData = {
      actions: data.actions.filter((c) => c.person === id).map((c) => c._id),
      comments: data.comments.filter((c) => c.person === id).map((c) => c._id),
      relsPersonPlaces: data.relsPersonPlace.filter((c) => c.person === id).map((c) => c._id),
      passages: data.passages.filter((c) => c.person === id).map((c) => c._id),
      rencontres: data.rencontres.filter((c) => c.person === id).map((c) => c._id),
      consultations: data.consultations.filter((c) => c.person === id).map((c) => c._id),
      treatments: data.treatments.filter((c) => c.person === id).map((c) => c._id),
      medicalFiles: data.medicalFiles.filter((c) => c.person === id).map((c) => c._id),
      groups: data.groups.filter((c) => c.persons?.includes(id)).map((c) => c._id),
      // Empty yet required by API
      reports: [],
      places: [],
      territoryObservations: [],
      territories: [],
    };
    associatedData.comments = associatedData.comments.concat(
      data.comments.filter((c) => associatedData.actions.includes(c.action)).map((c) => c._id)
    );
    return associatedData;
  };

  const getAssociatedDataAsText = (associatedData) => {
    const associatedDataAsText = [
      associatedData.actions.length + " actions",
      associatedData.comments.length + " commentaires",
      associatedData.relsPersonPlaces.length + " lieux fréquentés",
      associatedData.passages.length + " passages",
      associatedData.rencontres.length + " rencontres",
      associatedData.consultations.length + " consultations",
      associatedData.treatments.length + " traitements",
      associatedData.medicalFiles.length + " dossiers médicaux",
      associatedData.groups.length + " groupes",
    ];
    return associatedDataAsText;
  };

  const restorePerson = async (id) => {
    const associatedData = getAssociatedData(id);
    const associatedDataAsText = getAssociatedDataAsText(associatedData);

    if (confirm("Voulez-vous restaurer cette personne ? Les données associées seront également restaurées :\n" + associatedDataAsText.join(", "))) {
      tryFetchExpectOk(() =>
        API.post({
          path: "/organisation/" + organisation._id + "/restore-deleted-data",
          body: { ...associatedData, persons: [id] },
        })
      ).then(([error]) => {
        if (!error) {
          refresh().then(() => {
            toast.success("La personne a été restaurée avec succès, ainsi que ses données associées !");
            history.push(`/person/${id}`);
          });
        } else {
          toast.error("Impossible de restaurer la personne");
        }
      });
    }
  };

  const permanentDeletePerson = async (id) => {
    const associatedData = getAssociatedData(id);

    tryFetchExpectOk(() =>
      API.delete({
        path: "/organisation/" + organisation._id + "/permanent-delete-data",
        body: { ...associatedData, persons: [id] },
      })
    ).then(([error]) => {
      if (!error) {
        refresh().then(() => {
          toast.success("La personne a été supprimée définitivement avec succès, ainsi que ses données associées !");
          setRefreshKey(refreshKey + 1);
        });
      } else {
        toast.error("Impossible de supprimer définitivement la personne");
      }
    });
  };

  if (!persons)
    return (
      <>
        <Disclaimer />
        <Loading />
      </>
    );

  return (
    <div>
      <Disclaimer />
      <div className="tw-flex tw-justify-end tw-items-center tw-mb-4">
        <DeleteButtonAndConfirmModal
          title={`Supprimer définitivement ${persons.length} personnes`}
          buttonText="Supprimer définitivement toute la liste"
          textToConfirm={String(
            persons.length +
              data.actions.length +
              data.comments.length +
              data.relsPersonPlace.length +
              data.passages.length +
              data.rencontres.length +
              data.consultations.length +
              data.treatments.length +
              data.medicalFiles.length +
              data.groups.length
          )}
          onConfirm={async () => {
            for (const p of persons) {
              await permanentDeletePerson(p._id);
            }
          }}
        >
          <p className="tw-mb-7 tw-block tw-w-full tw-text-center">
            Voulez-vous supprimer DÉFINITIVEMENT ces {persons.length} personnes ?<br />
            <br />
            L'équipe de Mano sera
            <br />
            <strong className="tw-text-xl">INCAPABLE DE RÉCUPÉRER LES DONNÉES</strong>.<br />
            <br />
          </p>
          <div className="tw-mb-7 tw-flex tw-flex-col tw-w-full tw-px-8 tw-text-center">
            Les données associées seront également supprimées&nbsp;:{" "}
            <ul className="tw-text-center tw-font-semibold">
              <li>{data.actions.length} actions</li>
              <li>{data.comments.length} commentaires</li>
              <li>{data.relsPersonPlace.length} lieux fréquentés</li>
              <li>{data.passages.length} passages</li>
              <li>{data.rencontres.length} rencontres</li>
              <li>{data.consultations.length} consultations</li>
              <li>{data.treatments.length} traitements</li>
              <li>{data.medicalFiles.length} dossiers médicaux</li>
              <li>{data.groups.length} groupes</li>
            </ul>
          </div>
        </DeleteButtonAndConfirmModal>
      </div>
      <div className="mt-8">
        <Table
          data={sortedPersons}
          rowKey={"_id"}
          noData="Aucune personne supprimée"
          columns={[
            {
              title: "",
              dataKey: "group",
              small: true,
              onSortOrder: setSortOrder,
              onSortBy: setSortBy,
              sortOrder,
              sortBy,
              render: (person) => {
                if (!person.group) return null;
                return (
                  <div className="tw-flex tw-items-center tw-justify-center tw-gap-1">
                    <UserGroupIcon
                      className="tw-w-6 tw-h-6 tw-text-main"
                      aria-label="Personne avec des liens familiaux"
                      title="Personne avec des liens familiaux"
                    />
                  </div>
                );
              },
            },
            {
              title: "Nom",
              dataKey: "name",
              onSortOrder: setSortOrder,
              onSortBy: setSortBy,
              sortOrder,
              sortBy,
              render: (p) => {
                if (p.outOfActiveList)
                  return (
                    <div className="tw-max-w-md tw-text-black50">
                      <p className="tw-mb-0 tw-items-center tw-gap-1 tw-font-bold [overflow-wrap:anywhere]">
                        {p.name}
                        {p.otherNames ? <small className="tw-inline tw-text-main"> - {p.otherNames}</small> : null}
                      </p>
                      <div>Sortie de file active&nbsp;: {p.outOfActiveListReasons?.join(", ")}</div>
                    </div>
                  );
                return (
                  <p className="tw-mb-0 tw-max-w-md tw-items-center tw-gap-1 tw-font-bold [overflow-wrap:anywhere]">
                    {p.name}
                    {p.otherNames ? <small className="tw-inline tw-text-main"> - {p.otherNames}</small> : null}
                  </p>
                );
              },
            },
            {
              title: "Équipe(s) en charge",
              dataKey: "assignedTeams",
              render: (person) => <Teams person={person} />,
            },
            {
              title: "Suivi(e) depuis le",
              dataKey: "followedSince",
              onSortOrder: setSortOrder,
              onSortBy: setSortBy,
              sortOrder,
              sortBy,
              render: (p) => {
                return (
                  <>
                    {formatDateWithFullMonth(p.followedSince || p.createdAt || "")}
                    <div className="tw-text-gray-500 tw-text-xs">il y a {p.createdAt ? formatAge(p.createdAt) : "un certain temps"}</div>
                  </>
                );
              },
            },
            {
              title: "Suppression le",
              dataKey: "deletedAt",
              onSortOrder: setSortOrder,
              onSortBy: setSortBy,
              sortOrder,
              sortBy,
              render: (p) => {
                const isMerged = mergedPersonIds.includes(p._id);
                return (
                  <>
                    <div
                      className={
                        dayjsInstance(p.deletedAt).isAfter(dayjsInstance().add(-2, "year")) ? "tw-font-bold" : "tw-font-bold tw-text-red-500"
                      }
                    >
                      {formatDateWithFullMonth(p.deletedAt)}
                    </div>
                    <div className="tw-text-gray-500 tw-text-xs">il y a {p.deletedAt ? formatAge(p.deletedAt) : "un certain temps"}</div>
                    {p.deletedBy ? (
                      <div className="tw-text-gray-500 tw-text-xs">par {users.find((e) => e._id === p.deletedBy)?.name || p.deletedBy}</div>
                    ) : null}
                    {isMerged && <small className="tw-block tw-text-orange-700">Cette personne a été fusionnée</small>}
                  </>
                );
              },
            },
            {
              title: "Restaurer",
              dataKey: "action-restore",
              render: (p) => {
                return (
                  <>
                    <button className="button-classic ml-0" onClick={() => restorePerson(p._id)}>
                      Restaurer
                    </button>
                  </>
                );
              },
            },
            {
              title: "Supprimer",
              dataKey: "action-delete",
              render: (p) => {
                const associatedData = getAssociatedData(p._id);
                const associatedDataAsText = getAssociatedDataAsText(associatedData);
                return (
                  <>
                    <DeleteButtonAndConfirmModal
                      title={`Supprimer définitivement ${p.name}`}
                      buttonText="Suppr.&nbsp;définitivement"
                      textToConfirm={p.name}
                      onConfirm={() => permanentDeletePerson(p._id)}
                    >
                      <p className="tw-mb-7 tw-block tw-w-full tw-text-center">
                        Voulez-vous supprimer DÉFINITIVEMENT cette personne ?<br />
                        <br />
                        L'équipe de Mano sera
                        <br />
                        <strong className="tw-text-xl">INCAPABLE DE RÉCUPÉRER LES DONNÉES</strong>.<br />
                        <br />
                        Les données associées seront également supprimées&nbsp;:
                        <ul className="tw-text-center tw-font-semibold">
                          {associatedDataAsText.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      </p>
                    </DeleteButtonAndConfirmModal>
                  </>
                );
              },
            },
          ].filter((c) => organisation.groupsEnabled || c.dataKey !== "group")}
        />
      </div>
      <div className="tw-mt-8">
        <h2 className="tw-text-xl tw-font-bold tw-mb-4">Actions supprimées</h2>
        <DisclaimerActions />
        <Table
          data={data?.actions || []}
          rowKey={"_id"}
          noData="Aucune action supprimée"
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
              render: (action) => (
                <>
                  <ActionOrConsultationName item={action} />
                  <div className="tw-text-gray-500 tw-text-xs">{action.description}</div>
                </>
              ),
            },
            {
              title: "Personne suivie",
              dataKey: "person",
              render: (action) => <PersonName item={action} />,
            },
            {
              title: "Équipe(s) en charge",
              dataKey: "team",
              render: (a) => {
                if (!Array.isArray(a?.teams)) return <TagTeam teamId={a?.team} />;
                return (
                  <div className="tw-flex tw-flex-col">
                    {a.teams.map((e) => (
                      <TagTeam key={e} teamId={e} />
                    ))}
                  </div>
                );
              },
            },
            {
              title: "Date de suppression",
              dataKey: "deletedAt",
              render: (action) => (
                <>
                  <div
                    className={
                      dayjsInstance(action.deletedAt).isAfter(dayjsInstance().add(-2, "year")) ? "tw-font-bold" : "tw-font-bold tw-text-red-500"
                    }
                  >
                    {formatDateWithFullMonth(action.deletedAt)}
                  </div>
                  <div className="tw-text-gray-500 tw-text-xs">il y a {action.deletedAt ? formatAge(action.deletedAt) : "un certain temps"}</div>
                  {action.deletedBy ? (
                    <div className="tw-text-gray-500 tw-text-xs">par {users.find((e) => e._id === action.deletedBy)?.name || action.deletedBy}</div>
                  ) : null}
                </>
              ),
            },
          ]}
        />
      </div>
      {canSeeTreatments ? (
        <div className="tw-mt-8">
          <h2 className="tw-text-xl tw-font-bold tw-mb-4">Traitements supprimés</h2>
          <DisclaimerTreatments />
          <Table
            data={deletedTreatments}
            rowKey={"_id"}
            noData="Aucun traitement supprimé"
            columns={[
              {
                title: "Dates",
                dataKey: "dates",
                small: true,
                style: { width: "190px" },
                render: (t) => {
                  if (t.startDate && t.endDate) {
                    return (
                      <div className="tw-text-sm">
                        <div>Du {formatDateWithFullMonth(t.startDate)}</div>
                        <div>au {formatDateWithFullMonth(t.endDate)}</div>
                      </div>
                    );
                  }
                  if (t.startDate && !t.endDate) return <div className="tw-text-sm">À partir du {formatDateWithFullMonth(t.startDate)}</div>;
                  if (!t.startDate && t.endDate) return <div className="tw-text-sm">Jusqu'au {formatDateWithFullMonth(t.endDate)}</div>;
                  return <div className="tw-text-sm tw-text-gray-500">Aucune date</div>;
                },
              },
              {
                title: "Traitement",
                dataKey: "name",
                render: (t) => (
                  <>
                    <div className="tw-font-semibold [overflow-wrap:anywhere]">{treatmentDisplay(t)}</div>
                    <div className="tw-text-gray-500 tw-text-xs">
                      Créé par <UserName id={t.user} />
                    </div>
                  </>
                ),
              },
              {
                title: "Personne suivie",
                dataKey: "person",
                render: (t) => {
                  const activePerson = personsObject?.[t.person];
                  const deletedPerson = deletedPersonsObject?.[t.person];
                  if (activePerson) return <PersonName item={t} />;
                  if (deletedPerson)
                    return (
                      <span className="tw-text-gray-600">
                        {deletedPerson.name}
                        {deletedPerson.otherNames ? <em className="tw-inline tw-text-main"> - {deletedPerson.otherNames}</em> : null}
                        <span className="tw-ml-1 tw-text-xs tw-text-gray-400">(personne supprimée)</span>
                      </span>
                    );
                  return <span className="tw-text-gray-500 tw-italic">-</span>;
                },
              },
              {
                title: "Suppression le",
                dataKey: "deletedAt",
                small: true,
                style: { width: "140px" },
                render: (t) => (
                  <>
                    <div
                      className={
                        dayjsInstance(t.deletedAt).isAfter(dayjsInstance().add(-2, "year")) ? "tw-font-bold" : "tw-font-bold tw-text-red-500"
                      }
                    >
                      {formatDateWithFullMonth(t.deletedAt)}
                    </div>
                    <div className="tw-text-gray-500 tw-text-xs">il y a {t.deletedAt ? formatAge(t.deletedAt) : "un certain temps"}</div>
                  </>
                ),
              },
              {
                title: "Restaurer",
                dataKey: "action-restore",
                small: true,
                style: { width: "110px" },
                render: (t) => {
                  const personExists = Boolean(personsObject?.[t.person]);
                  const creatorIsActiveUser = Boolean(users?.find((u) => u._id === t.user));
                  const creatorIsDeletedUser = Boolean(deletedUsers?.find((u) => u._id === t.user));
                  const canRestore = personExists && creatorIsActiveUser;
                  if (!canRestore) {
                    const reason = !personExists
                      ? "Impossible : la personne suivie associée est supprimée (restaurez d'abord la personne)."
                      : creatorIsDeletedUser
                        ? "Impossible : l'utilisateur créateur a été supprimé."
                        : "Impossible : l'utilisateur créateur est introuvable.";
                    return (
                      <button className="button-classic ml-0" disabled title={reason}>
                        Restaurer
                      </button>
                    );
                  }
                  return (
                    <button className="button-classic ml-0" onClick={() => restoreTreatment(t)}>
                      Restaurer
                    </button>
                  );
                },
              },
              {
                title: "Supprimer",
                dataKey: "action-delete",
                small: true,
                style: { width: "170px" },
                render: (t) => (
                  <DeleteButtonAndConfirmModal
                    title="Supprimer définitivement ce traitement"
                    buttonText="Suppr.&nbsp;définitivement"
                    textToConfirm={treatmentDisplay(t)}
                    onConfirm={() => permanentDeleteTreatment(t)}
                  >
                    <p className="tw-mb-7 tw-block tw-w-full tw-text-center">
                      Voulez-vous supprimer DÉFINITIVEMENT ce traitement ?<br />
                      <br />
                      L'équipe de Mano sera
                      <br />
                      <strong className="tw-text-xl">INCAPABLE DE RÉCUPÉRER LES DONNÉES</strong>.<br />
                    </p>
                  </DeleteButtonAndConfirmModal>
                ),
              },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="tw-mb-8 tw-border-l-4 tw-border-orange-500 tw-bg-orange-100 tw-p-4 tw-text-orange-700" role="alert">
      Vous retrouvez ici les dossiers des personnes supprimeés, uniquement accessibles par les comptes administrateurs. Vous devez les supprimer
      définitivement après une période de rétention de 2 ans, conformément à la réglementation RGPD. Vous pouvez également restaurer les dossiers
      supprimés par erreur.
    </div>
  );
}

function DisclaimerActions() {
  return (
    <div className="tw-mb-8 tw-border-l-4 tw-border-orange-500 tw-bg-orange-100 tw-p-4 tw-text-orange-700" role="alert">
      Vous retrouvez ici toutre les actions supprimées à titre d'information. Les actions sont définitivement supprimées lors de la suppression
      définitive de la personne suivie associée. Vous ne pouvez ni les restaurer, ni les supprimer définitivement depuis cette liste.
    </div>
  );
}

function DisclaimerTreatments() {
  return (
    <div className="tw-mb-8 tw-border-l-4 tw-border-orange-500 tw-bg-orange-100 tw-p-4 tw-text-orange-700" role="alert">
      Vous retrouvez ici les traitements supprimés. Vous pouvez les restaurer si besoin. Si la personne suivie associée est aussi supprimée, vous
      devez restaurer la personne (ce qui restaurera également les données associées).
    </div>
  );
}

const Teams = ({ person: { _id, assignedTeams } }) => (
  <div key={_id} className="tw-grid tw-gap-px">
    {assignedTeams?.map((teamId) => (
      <TagTeam key={teamId} teamId={teamId} />
    ))}
  </div>
);
