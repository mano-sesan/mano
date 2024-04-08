import { useEffect, useState } from "react";
import API from "../../services/api";
import Table from "../../components/table";
import { useLocalStorage } from "../../services/useLocalStorage";
import ExclamationMarkButton from "../../components/tailwind/ExclamationMarkButton";
import { dayjsInstance, formatAge, formatDateWithFullMonth } from "../../services/date";
import { organisationState } from "../../recoil/auth";
import { useRecoilValue } from "recoil";
import TagTeam from "../../components/TagTeam";

async function fetchPersons() {
  const query = {
    // limit: String(10000),
    withDeleted: true,
    onlyDeleted: true,
  };

  const res = await API.get({ path: "/person", query: { ...query }, decryptDeleted: true });
  return res.decryptedData;
}

export default function Poubelle() {
  const organisation = useRecoilValue(organisationState);
  const [persons, setPersons] = useState([]);
  const [sortBy, setSortBy] = useLocalStorage("person-poubelle-sortBy", "name");
  const [sortOrder, setSortOrder] = useLocalStorage("person-poubelle-sortOrder", "ASC");

  useEffect(() => {
    fetchPersons().then((data) => {
      console.log(data);
      setPersons(data);
    });
  }, []);

  return (
    <div>
      <div className="tw-mb-8 tw-border-l-4 tw-border-orange-500 tw-bg-orange-100 tw-p-4 tw-text-orange-700" role="alert">
        Vous retrouvez ici les dossiers des personnes supprimeés, uniquement accessibles par les comptes administrateurs. Vous devez les supprimer
        définitivement après une période de rétention de 6 mois, conformément à la réglementation RGPD. Vous pouvez également restaurer les dossiers
        supprimés par erreur.
      </div>
      <div className="mt-8">
        <Table
          data={persons}
          rowKey={"_id"}
          onRowClick={(p) => history.push(`/person/${p._id}`)}
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
                    <span className="tw-text-3xl" aria-label="Personne avec des liens familiaux" title="Personne avec des liens familiaux">
                      👪
                    </span>
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
                return (
                  <>
                    <div
                      className={
                        dayjsInstance(p.deletedAt).isAfter(dayjsInstance().add(-6, "month")) ? "tw-font-bold" : "tw-font-bold tw-text-red-500"
                      }
                    >
                      {formatDateWithFullMonth(p.deletedAt)}
                    </div>
                    <div className="tw-text-gray-500 tw-text-xs">il y a {p.deletedAt ? formatAge(p.deletedAt) : "un certain temps"}</div>
                  </>
                );
              },
            },
            {
              title: "Restaurer",
              dataKey: "action",
              render: () => {
                return (
                  <>
                    <button className="button-classic ml-0">Restaurer</button>
                  </>
                );
              },
            },
            {
              title: "Supprimer",
              dataKey: "action",
              render: () => {
                return (
                  <>
                    <button className="button-destructive ml-0">Suppr. définitivement</button>
                  </>
                );
              },
            },
          ].filter((c) => organisation.groupsEnabled || c.dataKey !== "group")}
        />
      </div>
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
