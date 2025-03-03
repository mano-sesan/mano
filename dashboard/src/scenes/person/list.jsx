import { useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { selector, selectorFamily, useRecoilValue } from "recoil";
import { useLocalStorage } from "../../services/useLocalStorage";
import Page from "../../components/pagination";
import Search from "../../components/search";
import Loading from "../../components/loading";
import Table from "../../components/table";
import CreatePerson from "./CreatePerson";
import {
  fieldsPersonsCustomizableOptionsSelector,
  filterPersonsBaseSelector,
  flattenedCustomFieldsPersonsSelector,
  sortPersons,
} from "../../recoil/persons";
import TagTeam from "../../components/TagTeam";
import Filters, { filterData } from "../../components/Filters";
import { dayjsInstance, formatDateWithFullMonth } from "../../services/date";
import { personsWithMedicalFileAndConsultationsMergedSelector } from "../../recoil/selectors";
import { currentTeamState, organisationState, userState } from "../../recoil/auth";
import { placesState } from "../../recoil/places";
import { filterBySearch } from "../search/utils";
import useTitle from "../../services/useTitle";
import useSearchParamState from "../../services/useSearchParamState";
import { useDataLoader } from "../../services/dataLoader";
import ExclamationMarkButton from "../../components/tailwind/ExclamationMarkButton";
import { customFieldsMedicalFileSelector } from "../../recoil/medicalFiles";
import useMinimumWidth from "../../services/useMinimumWidth";
import { flattenedCustomFieldsConsultationsSelector } from "../../recoil/consultations";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../../components/tailwind/Modal";
import { toast } from "react-toastify";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";
import PersonName from "../../components/PersonName";
import { useDeletePerson } from "../../services/useDeletePerson";
import { getPersonInfo } from "../../utils/get-person-infos";
import { useRestoreScrollPosition } from "../../utils/useRestoreScrollPosition";
const limit = 20;

const personsFilteredSelector = selectorFamily({
  key: "personsFilteredSelector",
  get:
    ({ viewAllOrganisationData, filters, alertness }) =>
    ({ get }) => {
      const personsWithBirthDate = get(personsWithMedicalFileAndConsultationsMergedSelector);
      const currentTeam = get(currentTeamState);
      let pFiltered = personsWithBirthDate;
      if (filters?.filter((f) => Boolean(f?.value)).length) pFiltered = filterData(pFiltered, filters);
      if (alertness) pFiltered = pFiltered.filter((p) => !!p.alertness);
      if (viewAllOrganisationData) return pFiltered;
      return pFiltered.filter((p) => p.assignedTeams?.includes(currentTeam._id));
    },
});

const personsFilteredBySearchSelector = selectorFamily({
  key: "personsFilteredBySearchSelector",
  get:
    ({ viewAllOrganisationData, filters, alertness, search, sortBy, sortOrder }) =>
    ({ get }) => {
      const personsFiltered = get(personsFilteredSelector({ viewAllOrganisationData, filters, alertness }));
      const personsSorted = [...personsFiltered].sort(sortPersons(sortBy, sortOrder));
      const user = get(userState);

      if (!search?.length) {
        return personsSorted;
      }

      const excludeFields = user.healthcareProfessional ? [] : ["consultations", "treatments", "commentsMedical", "medicalFile"];
      const restrictedFields =
        user.role === "restricted-access" ? ["name", "phone", "otherNames", "gender", "formattedBirthDate", "assignedTeams", "email"] : null;

      const personsfilteredBySearch = filterBySearch(search, personsSorted, excludeFields, restrictedFields);

      return personsfilteredBySearch;
    },
});

const filterPersonsWithAllFieldsSelector = selector({
  key: "filterPersonsWithAllFieldsSelector",
  get: ({ get }) => {
    const places = get(placesState);
    const user = get(userState);
    const team = get(currentTeamState);
    const fieldsPersonsCustomizableOptions = get(fieldsPersonsCustomizableOptionsSelector);
    const flattenedCustomFieldsPersons = get(flattenedCustomFieldsPersonsSelector);
    const customFieldsMedicalFile = get(customFieldsMedicalFileSelector);
    const consultationFields = get(flattenedCustomFieldsConsultationsSelector);
    const filterPersonsBase = get(filterPersonsBaseSelector);

    const filterBase = [
      ...filterPersonsBase,
      ...fieldsPersonsCustomizableOptions.filter((a) => a.enabled || a.enabledTeams?.includes(team._id)).map((a) => ({ field: a.name, ...a })),
      ...flattenedCustomFieldsPersons.filter((a) => a.enabled || a.enabledTeams?.includes(team._id)).map((a) => ({ field: a.name, ...a })),
      {
        label: "Lieux fréquentés",
        field: "places",
        options: [...new Set(places.map((place) => place.name))],
      },
    ];
    if (user.healthcareProfessional) {
      filterBase.push(
        ...customFieldsMedicalFile.filter((a) => a.enabled || a.enabledTeams?.includes(team._id)).map((a) => ({ field: a.name, ...a }))
      );
      filterBase.push(...consultationFields.filter((a) => a.enabled || a.enabledTeams?.includes(team._id)).map((a) => ({ field: a.name, ...a })));
    }
    return filterBase;
  },
});

const List = () => {
  useTitle("Personnes");
  useDataLoader({ refreshOnMount: true });
  const isDesktop = useMinimumWidth("sm");
  const filterPersonsWithAllFields = useRecoilValue(filterPersonsWithAllFieldsSelector);

  const [search, setSearch] = useSearchParamState("search", "");
  const [lastPersonsViewed, setLastPersonsViewed] = useLocalStorage("lastPersonsViewed", []);
  const [alertness, setFilterAlertness] = useLocalStorage("person-alertness", false);
  const [viewAllOrganisationDataChecked, setViewAllOrganisationData] = useLocalStorage("person-allOrg", true);
  const [sortBy, setSortBy] = useLocalStorage("person-sortBy", "name");
  const [sortOrder, setSortOrder] = useLocalStorage("person-sortOrder", "ASC");
  const [filters, setFilters] = useLocalStorage("person-filters", []);
  const [page, setPage] = useSearchParamState("page", 0);
  const currentTeam = useRecoilValue(currentTeamState);
  const organisation = useRecoilValue(organisationState);
  const user = useRecoilValue(userState);
  const [deleteMultiple, setDeleteMultiple] = useState(false);
  const [checkedForDelete, setCheckedForDelete] = useState([]);
  const deletePerson = useDeletePerson();
  const { refresh } = useDataLoader();
  const viewAllOrganisationData = organisation.checkboxShowAllOrgaPersons && viewAllOrganisationDataChecked;

  const personsFilteredBySearch = useRecoilValue(
    personsFilteredBySearchSelector({ search, viewAllOrganisationData, filters, alertness, sortBy, sortOrder })
  );

  const data = useMemo(() => {
    return personsFilteredBySearch.filter((_, index) => index < (page + 1) * limit && index >= page * limit);
  }, [personsFilteredBySearch, page]);
  const total = useMemo(() => personsFilteredBySearch.length, [personsFilteredBySearch]);

  const history = useHistory();

  useRestoreScrollPosition();

  function onDeleteMultiple() {
    setDeleteMultiple(true);
  }

  if (!personsFilteredBySearch) return <Loading />;

  return (
    <>
      <div className={`tw-flex tw-w-full tw-items-center tw-mt-8 ${lastPersonsViewed.length > 0 ? "" : "tw-mb-12"}`}>
        <div className="tw-grow tw-text-xl">
          Personnes suivies par{" "}
          {viewAllOrganisationData ? (
            <>
              l’organisation <b>{organisation.name}</b>
            </>
          ) : (
            <>
              l’équipe <b>{currentTeam?.name || ""}</b>
            </>
          )}
        </div>
        <div>
          <CreatePerson />
        </div>
      </div>
      {lastPersonsViewed.length > 0 && (
        <div className="tw-flex tw-w-full tw-items-center tw-mb-8 tw-gap-2 tw-text-xs">
          <div className="tw-text-slate-400 tw-w-4 tw-h-4 tw-flex tw-items-center tw-justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-history"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l4 2" />
            </svg>
          </div>
          {lastPersonsViewed.map((personId) => (
            <div key={personId} className="tw-bg-slate-100 tw-border tw-border-slate-300 tw-rounded-md tw-px-1.5 tw-py-0.5">
              <PersonName item={{ person: personId }} />
              <button
                className="tw-text-xs tw-border-slate-300 tw-border-l tw-pl-1 tw-ml-1"
                onClick={() => setLastPersonsViewed(lastPersonsViewed.filter((id) => id !== personId))}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
      <details open={isDesktop} className="-tw-mx-4 tw-px-4 tw-mb-4 tw-py-2 tw-rounded-lg tw-border tw-border-zinc-100  tw-shadow">
        <summary className="tw-text-main">
          <span className="tw-ml-2">Recherche et filtres...</span>
        </summary>
        <hr className="tw-m-0 tw-mt-2" />
        <div className="tw-mb-4 tw-flex tw-flex-wrap tw-mt-8">
          <div className="tw-flex tw-w-full tw-items-start tw-justify-start">
            <label htmlFor="search" className="tw-shrink-0 tw-w-[100px] tw-m-0 tw-mt-2.5">
              Recherche
            </label>
            <div className="tw-flex-grow-1 tw-flex-col tw-items-stretch tw-gap-2 tw-w-full">
              <Search
                placeholder="Par mot clé, présent dans le nom, la description, un commentaire, une action, ..."
                value={search}
                onChange={(value) => {
                  if (page) {
                    setPage(0);
                    setSearch(value, { sideEffect: ["page", 0] });
                  } else {
                    setSearch(value);
                  }
                }}
              />
              <div className="tw-flex tw-w-full tw-items-center">
                <label htmlFor="alertness" className="tw-m-0 tw-text-sm tw-mt-0.5">
                  <input
                    type="checkbox"
                    className="tw-mr-2.5"
                    id="alertness"
                    checked={alertness}
                    value={alertness}
                    onChange={() => setFilterAlertness(!alertness)}
                  />
                  N'afficher que les personnes vulnérables ou ayant besoin d'une attention particulière
                </label>
              </div>
              <div className="tw-flex tw-w-full tw-items-center">
                <label htmlFor="viewAllOrganisationData" className="tw-m-0 tw-text-sm">
                  <input
                    type="checkbox"
                    id="viewAllOrganisationData"
                    className="tw-mr-2.5"
                    checked={viewAllOrganisationData}
                    value={viewAllOrganisationData}
                    onChange={() => setViewAllOrganisationData(!viewAllOrganisationData)}
                  />
                  Afficher les personnes de toute l'organisation
                </label>
              </div>
            </div>
          </div>
        </div>
        {user.role !== "restricted-access" && (
          <Filters base={filterPersonsWithAllFields} title="" filters={filters} onChange={setFilters} saveInURLParams />
        )}
      </details>
      <PersonsTable
        data={data}
        setSortOrder={setSortOrder}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        sortBy={sortBy}
        history={history}
        organisation={organisation}
      />
      <div className="tw-flex tw-justify-between tw-items-center">
        <Page page={page} limit={limit} total={total} onChange={({ page }) => setPage(page, true)} />
        {["admin", "superadmin"].includes(user.role) && total > 0 && (
          <button type="button" className="button-destructive" onClick={onDeleteMultiple}>
            Supprimer plusieurs dossiers
          </button>
        )}
      </div>
      <ModalContainer open={deleteMultiple} onClose={() => setDeleteMultiple(false)} size="full">
        <ModalHeader title="Supprimer plusieurs dossiers" onClose={() => setDeleteMultiple(false)} />
        <ModalBody>
          <PersonsTable
            data={personsFilteredBySearch}
            setSortOrder={setSortOrder}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            sortBy={sortBy}
            history={history}
            organisation={organisation}
            withCheckbox
            checked={checkedForDelete}
            onCheck={setCheckedForDelete}
          />
        </ModalBody>
        <ModalFooter>
          <button type="button" className="button-cancel" onClick={() => setDeleteMultiple(false)}>
            Annuler
          </button>
          <DeleteButtonAndConfirmModal
            title={`Voulez-vous vraiment supprimer les dossiers de ${checkedForDelete?.length} personnes ?`}
            textToConfirm={String(checkedForDelete?.length)}
            onConfirm={async () => {
              let errors = [];
              for (const personId of checkedForDelete) {
                const [_error] = await deletePerson(personId);
                if (_error) {
                  toast.error(`Erreur lors de la suppression de la personne ${personsFilteredBySearch.find((p) => p._id === personId).name}`);
                  errors.push(personId);
                }
              }
              await refresh();
              if (errors.length === 0) {
                toast.success("Suppression réussie");
                setCheckedForDelete([]);
              } else {
                toast.error(`Il y a eu ${errors.length} erreurs lors de la suppression`);
                setCheckedForDelete(errors);
              }
            }}
          >
            <div className="tw-mb-7 tw-flex tw-flex-col tw-w-full tw-font-semibold tw-px-8">
              {checkedForDelete.map((personId) => (
                <PersonName item={{ person: personId }} key={personId} disabled />
              ))}
            </div>
            <p className="tw-mb-7 tw-block tw-w-full tw-text-center">
              Cette opération est irréversible
              <br />
              et entrainera la suppression définitive de toutes les données liées à la personne&nbsp;:
              <br />
              actions, commentaires, lieux visités, passages, rencontres, documents...
            </p>
          </DeleteButtonAndConfirmModal>
        </ModalFooter>
      </ModalContainer>
    </>
  );
};

const PersonsTable = ({ data, setSortOrder, setSortBy, sortOrder, sortBy, history, organisation, withCheckbox, checked, onCheck }) => {
  return (
    <Table
      data={data}
      rowKey={"_id"}
      withCheckbox={withCheckbox}
      checked={checked}
      onCheck={onCheck}
      onRowClick={(p) => {
        if (!withCheckbox) return history.push(`/person/${p._id}`);
        if (checked.includes(p._id)) {
          onCheck(checked.filter((c) => c !== p._id));
        } else {
          onCheck([...checked, p._id]);
        }
      }}
      renderCellSmallDevices={(p) => {
        return (
          <tr className="tw-my-3 tw-block tw-rounded-md tw-bg-[#f4f5f8] tw-p-4 tw-px-2">
            <td className="tw-flex tw-flex-col tw-items-start tw-gap-1">
              <div className="tw-flex tw-items-center tw-gap-x-2">
                {!!p.group && (
                  <span aria-label="Personne avec des liens familiaux" title="Personne avec des liens familiaux">
                    👪
                  </span>
                )}
                {!!p.alertness && (
                  <ExclamationMarkButton
                    aria-label="Personne très vulnérable, ou ayant besoin d'une attention particulière"
                    title="Personne très vulnérable, ou ayant besoin d'une attention particulière"
                  />
                )}
                {p.outOfActiveList ? (
                  <div className="tw-max-w-md tw-text-black50">
                    <div className="tw-items-center tw-gap-1 tw-font-bold [overflow-wrap:anywhere]">
                      {p.name}
                      {p.otherNames ? <small className="tw-inline tw-text-main"> - {p.otherNames}</small> : null}
                    </div>
                    <div>Sortie de file active&nbsp;: {p.outOfActiveListReasons?.join(", ")}</div>
                  </div>
                ) : (
                  <div className="tw-max-w-md tw-items-center tw-gap-1 tw-font-bold [overflow-wrap:anywhere]">
                    {p.name}
                    {p.otherNames ? <small className="tw-inline tw-text-main"> - {p.otherNames}</small> : null}
                  </div>
                )}
              </div>
              <span className="tw-opacity-50">{p.formattedBirthDate}</span>
              <div className="tw-flex tw-w-full tw-flex-wrap tw-gap-2">
                {p.assignedTeams?.map((teamId) => (
                  <TagTeam key={teamId} teamId={teamId} />
                ))}
              </div>
            </td>
          </tr>
        );
      }}
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
                <div className="tw-max-w-md tw-text-black50 my-tooltip" data-tooltip={getPersonInfo(p)}>
                  <p className="tw-mb-0 tw-items-center tw-gap-1 tw-font-bold [overflow-wrap:anywhere]">
                    {p.name}
                    {p.otherNames ? <small className="tw-inline tw-text-main"> - {p.otherNames}</small> : null}
                  </p>
                  <div>Sortie de file active&nbsp;: {p.outOfActiveListReasons?.join(", ")}</div>
                </div>
              );
            return (
              <p
                className="tw-mb-0 tw-max-w-md tw-items-center tw-gap-1 tw-font-bold [overflow-wrap:anywhere] my-tooltip"
                data-tooltip={getPersonInfo(p)}
              >
                {p.name}
                {p.otherNames ? <small className="tw-inline tw-text-main"> - {p.otherNames}</small> : null}
              </p>
            );
          },
        },
        {
          title: "Date de naissance",
          dataKey: "formattedBirthDate",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortOrder,
          sortBy,
          render: (p) => {
            if (!p.birthdate) return "";
            else if (p.outOfActiveList) return <i className="tw-text-black50">{p.formattedBirthDate}</i>;
            return (
              <span>
                <i>{p.formattedBirthDate}</i>
              </span>
            );
          },
        },
        {
          title: "Vigilance",
          dataKey: "alertness",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortOrder,
          sortBy,
          render: (p) => {
            return p.alertness ? (
              <ExclamationMarkButton
                aria-label="Personne très vulnérable, ou ayant besoin d'une attention particulière"
                title="Personne très vulnérable, ou ayant besoin d'une attention particulière"
              />
            ) : null;
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
            if (p.outOfActiveList) return <div className="tw-text-black50">{formatDateWithFullMonth(p.followedSince || p.createdAt || "")}</div>;
            return formatDateWithFullMonth(p.followedSince || p.createdAt || "");
          },
        },
        {
          title: "Dernière interaction",
          dataKey: "lastUpdateCheckForGDPR",
          onSortOrder: setSortOrder,
          onSortBy: setSortBy,
          sortOrder,
          sortBy,
          render: (p) => {
            return (
              <div
                className={
                  dayjsInstance(p.lastUpdateCheckForGDPR).isAfter(dayjsInstance().add(-2, "year"))
                    ? "tw-text-black50"
                    : "tw-font-bold tw-text-red-500"
                }
              >
                {formatDateWithFullMonth(p.lastUpdateCheckForGDPR)}
              </div>
            );
          },
        },
      ].filter((c) => organisation.groupsEnabled || c.dataKey !== "group")}
    />
  );
};

const Teams = ({ person: { _id, assignedTeams } }) => (
  <div key={_id} className="tw-grid tw-gap-px">
    {assignedTeams?.map((teamId) => (
      <TagTeam key={teamId} teamId={teamId} />
    ))}
  </div>
);

export default List;
