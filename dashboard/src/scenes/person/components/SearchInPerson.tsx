import React, { useMemo, useState } from "react";
import { useRecoilValue } from "recoil";
import { useHistory } from "react-router-dom";
import dayjs from "dayjs";
import TabsNav from "../../../components/tailwind/TabsNav";
import type { PersonPopulated } from "../../../types/person";
import type { ActionInstance } from "../../../types/action";
import Search from "../../../components/search";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../../../components/tailwind/Modal";
import DateBloc from "../../../components/DateBloc";
import Table from "../../../components/table";
import UserName from "../../../components/UserName";
import TagTeam from "../../../components/TagTeam";
import { organisationState, userState } from "../../../recoil/auth";
import { CANCEL, DONE, sortActionsOrConsultations } from "../../../recoil/actions";
import PersonName from "../../../components/PersonName";
import { formatDateWithFullMonth, formatTime } from "../../../services/date";
import ExclamationMarkButton from "../../../components/tailwind/ExclamationMarkButton";
import ConsultationButton from "../../../components/ConsultationButton";
import { useLocalStorage } from "../../../services/useLocalStorage";
import DescriptionIcon from "../../../components/DescriptionIcon";
import ActionStatusSelect from "../../../components/ActionStatusSelect";
import { filterBySearch } from "../../search/utils";

export default function SearchInPerson({ person }: { person: PersonPopulated }) {
  const [search, setSearch] = useLocalStorage("person-search", "");

  const open = search.length > 0;
  function onClose() {
    setSearch("");
  }

  return (
    <>
      <Search placeholder={`Rechercher dans le dossier de ${person.name}...`} value={search} onChange={setSearch} />
      <ModalContainer open={open} onClose={onClose} size="full">
        <ModalHeader title={`Résultats de la recherche dans le dossier de ${person.name}`} onClose={onClose} />
        <ModalBody className="tw-min-h-1/2">
          <div className="tw-w-full tw-flex tw-flex-col tw-items-center tw-justify-center">
            <div className="tw-w-full tw-flex tw-flex-col tw-items-center tw-justify-center [&>div]:tw-max-w-96">
              <Search placeholder={`Rechercher dans le dossier de ${person.name}...`} value={search} onChange={setSearch} />
            </div>
            <SearchResults person={person} search={search} />
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" name="cancel" className="button-cancel" onClick={onClose}>
            Fermer
          </button>
        </ModalFooter>
      </ModalContainer>
    </>
  );
}

function SearchResults({ person, search }: { person: PersonPopulated; search: string }) {
  const user = useRecoilValue(userState);
  const initTabs = useMemo(() => {
    const defaultTabs = ["Actions", "Commentaires non médicaux", "Lieux"];
    if (!user.healthcareProfessional) return defaultTabs;
    return [...defaultTabs, "Consultations", "Traitements", "Dossiers médicaux"];
  }, [user.healthcareProfessional]);
  const [activeTab, setActiveTab] = useLocalStorage("person-search-tab", 0);

  const actions = useMemo(() => {
    if (!search?.length) return [];
    return filterBySearch(search, person.actions);
  }, [search, person.actions]);

  const treatments = useMemo(() => {
    if (!search?.length) return [];
    return filterBySearch(search, person.treatments);
  }, [search, person.treatments]);

  const consultations = useMemo(() => {
    if (!search?.length) return [];
    return filterBySearch(
      search,
      person.consultations.filter((c) => {
        if (!c.onlyVisibleBy?.length) return true;
        return c.onlyVisibleBy.includes(user._id);
      })
    );
  }, [search, person.consultations, user._id]);

  const places = useMemo(() => {
    if (!search?.length) return [];
    return filterBySearch(search, person.places);
  }, [search, person.places]);

  const comments = useMemo(() => {
    if (!search?.length) return [];
    return filterBySearch(search, person.comments);
  }, [search, person.comments]);

  const commentsMedical = useMemo(() => {
    if (!search?.length) return [];
    return filterBySearch(search, person.commentsMedical);
  }, [search, person.commentsMedical]);

  if (!search) return <>Pas de recherche, pas de résultat !</>;
  if (search.length < 3) return <>Recherche trop courte (moins de 3 caractères), pas de résultat !</>;

  return (
    <>
      <TabsNav
        className="tw-justify-center tw-px-3 tw-py-2"
        tabs={[
          `Actions (${actions.length})`,
          `Commentaires non médicaux (${comments.length})`,
          `Lieux (${places.length})`,
          !!user.healthcareProfessional && `Consultations (${consultations.length})`,
          !!user.healthcareProfessional && `Traitements (${treatments.length})`,
          !!user.healthcareProfessional && `Commentaires médicaux (${commentsMedical.length})`,
        ].filter(Boolean)}
        onClick={(tab) => {
          if (tab.includes("Actions")) setActiveTab("Actions");
          if (tab.includes("Commentaires non médicaux")) setActiveTab("Commentaires non médicaux");
          if (tab.includes("Lieux")) setActiveTab("Lieux");
          if (tab.includes("Consultations")) setActiveTab("Consultations");
          if (tab.includes("Traitements")) setActiveTab("Traitements");
          if (tab.includes("Commentaires médicaux")) setActiveTab("Commentaires médicaux");
        }}
        activeTabIndex={initTabs.findIndex((tab) => tab === activeTab)}
      />
      <div className="[&_table]:!tw-p0 tw-w-full tw-rounded-lg tw-bg-white tw-px-8 tw-py-4 print:tw-mb-4 [&_.title]:!tw-pb-5">
        {activeTab === "Actions" && <Actions actions={actions} />}
        {activeTab === "Commentaires non médicaux" && <Comments comments={comments} />}
        {activeTab === "Lieux" && <Places places={places} />}
        {activeTab === "Consultations" && <Consultations consultations={consultations} />}
        {activeTab === "Traitements" && <Treatments treatments={treatments} />}
        {activeTab === "Commentaires médicaux" && <Comments comments={commentsMedical} />}
      </div>
    </>
  );
}

const Actions = ({ actions }) => {
  const history = useHistory();
  const organisation = useRecoilValue(organisationState);
  const [sortBy, setSortBy] = useLocalStorage("actions-consultations-sortBy", "dueAt");
  const [sortOrder, setSortOrder] = useLocalStorage("actions-consultations-sortOrder", "ASC");

  const data = useMemo(() => {
    return [...actions].sort(sortActionsOrConsultations(sortBy, sortOrder));
  }, [actions, sortBy, sortOrder]);

  if (!actions.length) return <div />;

  const moreThanOne = data.length > 1;

  return (
    <Table
      className="Table"
      data={data.map((a) => {
        if (a.urgent) return { ...a, style: { backgroundColor: "#fecaca" } };
        return a;
      })}
      noData="Pas d'action"
      onRowClick={(action: ActionInstance) => {
        const searchParams = new URLSearchParams(history.location.search);
        searchParams.set("actionId", action._id);
        history.push(`?${searchParams.toString()}`);
      }}
      rowKey="_id"
      columns={[
        {
          title: "",
          dataKey: "urgentOrGroupOrConsultation",
          small: true,
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
          render: (actionOrConsult) => {
            return (
              <div className="tw-flex tw-items-center tw-justify-center tw-gap-1">
                {!!actionOrConsult.urgent && <ExclamationMarkButton />}
                {!!actionOrConsult.description && <DescriptionIcon />}
                {!!organisation.groupsEnabled && !!actionOrConsult.group && (
                  <span className="tw-text-3xl" aria-label="Action familiale" title="Action familiale">
                    👪
                  </span>
                )}
                {!!actionOrConsult.isConsultation && <ConsultationButton />}
              </div>
            );
          },
        },
        {
          title: "Date",
          dataKey: "dueAt",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
          render: (a) => <DateBloc date={[DONE, CANCEL].includes(a.status) ? a.completedAt : a.dueAt} />,
        },
        {
          title: "Heure",
          dataKey: "time",
          render: (action) => {
            if (!action.dueAt || !action.withTime) return null;
            return formatTime(action.dueAt);
          },
        },
        {
          title: "Nom",
          dataKey: "name",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
        },
        {
          title: "Personne suivie",
          dataKey: "person",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
          render: (action) => <PersonName item={action} />,
        },
        {
          title: "Statut",
          dataKey: "status",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
          render: (action) => <ActionStatusSelect action={action} />,
        },
        {
          title: "Équipe(s) en charge",
          dataKey: "team",
          render: (a) => (
            <div className="px-2 tw-flex tw-flex-shrink-0 tw-flex-col tw-gap-px">
              {Array.isArray(a?.teams) ? a.teams.map((e) => <TagTeam key={e} teamId={e} />) : <TagTeam teamId={a?.team} />}
            </div>
          ),
        },
      ]}
    />
  );
};

const Consultations = ({ consultations }) => {
  const history = useHistory();
  const organisation = useRecoilValue(organisationState);
  const [sortBy, setSortBy] = useLocalStorage("actions-consultations-sortBy", "dueAt");
  const [sortOrder, setSortOrder] = useLocalStorage("actions-consultations-sortOrder", "ASC");

  const data = useMemo(() => {
    return [...consultations].sort(sortActionsOrConsultations(sortBy, sortOrder));
  }, [consultations, sortBy, sortOrder]);

  if (!consultations.length) return <div />;

  const moreThanOne = data.length > 1;

  return (
    <Table
      className="Table"
      data={data.map((a) => {
        if (a.urgent) return { ...a, style: { backgroundColor: "#fecaca" } };
        return a;
      })}
      noData="Pas de consultation"
      onRowClick={(consultation) => {
        const searchParams = new URLSearchParams(history.location.search);
        searchParams.set("consultationId", consultation._id);
        history.push(`?${searchParams.toString()}`);
      }}
      rowKey="_id"
      columns={[
        {
          title: "",
          dataKey: "urgentOrGroupOrConsultation",
          small: true,
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
          render: (actionOrConsult) => {
            return (
              <div className="tw-flex tw-items-center tw-justify-center tw-gap-1">
                {!!actionOrConsult.urgent && <ExclamationMarkButton />}
                {!!actionOrConsult.description && <DescriptionIcon />}
                {!!organisation.groupsEnabled && !!actionOrConsult.group && (
                  <span className="tw-text-3xl" aria-label="Action familiale" title="Action familiale">
                    👪
                  </span>
                )}
                {!!actionOrConsult.isConsultation && <ConsultationButton />}
              </div>
            );
          },
        },
        {
          title: "Date",
          dataKey: "dueAt",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
          render: (consult) => <DateBloc date={[DONE, CANCEL].includes(consult.status) ? consult.completedAt : consult.dueAt} />,
        },
        {
          title: "Heure",
          dataKey: "time",
          render: (consultation) => {
            if (!consultation.dueAt || !consultation.withTime) return null;
            return formatTime(consultation.dueAt);
          },
        },
        {
          title: "Nom",
          dataKey: "name",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
        },
        {
          title: "Personne suivie",
          dataKey: "person",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
          render: (consultation) => <PersonName item={consultation} />,
        },
        {
          title: "Statut",
          dataKey: "status",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortBy,
          sortOrder,
          render: (consultation) => <ActionStatusSelect action={consultation} />,
        },
        {
          title: "Équipe(s) en charge",
          dataKey: "team",
          render: (consult) => (
            <div className="px-2 tw-flex tw-flex-shrink-0 tw-flex-col tw-gap-px">
              {Array.isArray(consult?.teams) ? consult.teams.map((e) => <TagTeam key={e} teamId={e} />) : <TagTeam teamId={consult?.team} />}
            </div>
          ),
        },
      ]}
    />
  );
};

const Treatments = ({ treatments }) => {
  const history = useHistory();

  const moreThanOne = treatments.length > 1;

  return (
    <Table
      className="Table"
      data={treatments}
      noData="Pas de traitement"
      onRowClick={(consultation) => {
        const searchParams = new URLSearchParams(history.location.search);
        searchParams.set("consultationId", consultation._id);
        history.push(`?${searchParams.toString()}`);
      }}
      rowKey="_id"
      columns={[
        {
          title: "Début",
          dataKey: "startDate",
          render: (treatment) => <DateBloc date={treatment.startDate} />,
        },
        {
          title: "Fin",
          dataKey: "endDate",
          render: (treatment) => <DateBloc date={treatment.endDate} />,
        },
        {
          title: "Nom",
          dataKey: "name",
        },
        {
          title: "Dosage",
          dataKey: "dosage",
        },
        {
          title: "Fréquence",
          dataKey: "frequency",
        },
        {
          title: "Indication",
          dataKey: "indication",
        },
        {
          title: "Personne suivie",
          dataKey: "person",
          render: (consultation) => <PersonName item={consultation} />,
        },
      ]}
    />
  );
};

const Comments = ({ comments }) => {
  const history = useHistory();
  const organisation = useRecoilValue(organisationState);

  if (!comments?.length) return <div />;
  const moreThanOne = comments.length > 1;

  return (
    <Table
      className="Table"
      data={comments}
      noData="Pas de commentaire"
      onRowClick={(comment) => {
        history.push(`/${comment.type}/${comment[comment.type]._id}`);
      }}
      rowKey="_id"
      columns={[
        {
          title: "",
          dataKey: "urgentOrGroup",
          small: true,
          render: (comment) => {
            return (
              <div className="tw-flex tw-items-center tw-justify-center tw-gap-1">
                {!!comment.urgent && <ExclamationMarkButton />}
                {!!organisation.groupsEnabled && !!comment.group && (
                  <span className="tw-text-3xl" aria-label="Commentaire familial" title="Commentaire familial">
                    👪
                  </span>
                )}
              </div>
            );
          },
        },
        {
          title: "Date",
          dataKey: "date",
          render: (comment) => (
            <span>
              {dayjs(comment.date || comment.createdAt).format("ddd DD/MM/YY")}
              <br />à {dayjs(comment.date || comment.createdAt).format("HH:mm")}
            </span>
          ),
        },
        {
          title: "Utilisateur",
          dataKey: "user",
          render: (comment) => <UserName id={comment.user} />,
        },
        {
          title: "Type",
          dataKey: "type",
          render: (comment) => (
            <span>
              {comment.type === "treatment" && "Traitement"}
              {comment.type === "consultation" && "Consultation"}
              {comment.type === "action" && "Action"}
              {comment.type === "passage" && "Passage"}
              {comment.type === "rencontre" && "Rencontre"}
              {comment.type === "medical-file" && "Dossier médical"}
            </span>
          ),
        },
        {
          title: "Nom",
          dataKey: "person",
          render: (comment) => (
            <>
              <b></b>
              <b>{comment[comment.type]?.name}</b>
              {comment.type === "action" && (
                <>
                  <br />
                  <i>(pour {comment.person?.name || ""})</i>
                </>
              )}
            </>
          ),
        },
        {
          title: "Commentaire",
          dataKey: "comment",
          render: (comment) => {
            return (
              <p>
                {comment.comment
                  ? comment.comment.split("\n").map((c, i, a) => {
                      if (i === a.length - 1) return c;
                      return (
                        <React.Fragment key={i}>
                          {c}
                          <br />
                        </React.Fragment>
                      );
                    })
                  : ""}
              </p>
            );
          },
        },
      ]}
    />
  );
};

const Places = ({ places }) => {
  if (!places?.length) return <div />;
  const moreThanOne = places.length > 1;

  return (
    <Table
      className="Table"
      noData="Pas de lieu fréquenté"
      data={places}
      rowKey="_id"
      columns={[
        { title: "Nom", dataKey: "name" },
        { title: "Créée le", dataKey: "createdAt", render: (place) => formatDateWithFullMonth(place.createdAt) },
      ]}
    />
  );
};
