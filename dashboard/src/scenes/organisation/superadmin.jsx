import React, { useEffect, useState } from "react";
import { Formik } from "formik";
import { toast } from "react-toastify";
import API, { tryFetch, tryFetchExpectOk } from "../../services/api";
import { formatAge, formatDateWithFullMonth, formatTime } from "../../services/date";
import useTitle from "../../services/useTitle";
import { download, emailRegex, errorMessage } from "../../utils";
import { getUmapGeoJSONFromOrgs } from "./utils";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";
import Table from "../../components/table";
import Loading from "../../components/loading";
import SelectRole from "../../components/SelectRole";
import SelectCustom from "../../components/SelectCustom";
import CitySelect from "../../components/CitySelect";
import { ModalBody, ModalHeader, ModalFooter, ModalContainer } from "../../components/tailwind/Modal";
import { checkEncryptedVerificationKey, derivedMasterKey } from "../../services/encryption";
import SuperadminOrganisationSettings from "./SuperadminOrganisationSettings";
import SuperadminOrganisationUsers from "./SuperadminOrgationsationUsers";
import SuperadminUsersSearch from "./SuperadminUsersSearch";
import { useRecoilValue } from "recoil";
import { userState } from "../../recoil/auth";
import { Redirect } from "react-router-dom";
import TopBar from "../../components/TopBar";
import ReactDiffViewer from "react-diff-viewer-continued";

const SuperAdmin = () => {
  const user = useRecoilValue(userState);
  const [organisations, setOrganisations] = useState(null);
  const [updateKey, setUpdateKey] = useState(null);
  const [sortBy, setSortBy] = useState("countersTotal");
  const [sortOrder, setSortOrder] = useState("DESC");
  const [refresh, setRefresh] = useState(true);
  const [searchUserModal, setSearchUserModal] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openMergeModal, setOpenMergeModal] = useState(false);
  const [openOrgSettingsModal, setOpenOrgSettingsModal] = useState(false);
  const [openCreateUserModal, setOpenCreateUserModal] = useState(false);
  const [openRawDataModal, setOpenRawDataModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [openEditUserModal, setOpenEditUserModal] = useState(false);
  const [openUserListModal, setOpenUserListModal] = useState(false);
  const [selectedOrganisation, setSelectedOrganisation] = useState(null);
  const [superadmins, setSuperadmins] = useState(null);
  const [usersConnectedLast24h, setUsersConnectedLast24h] = useState(null);
  const [openDuplicateFieldsModal, setOpenDuplicateFieldsModal] = useState(false);
  useTitle("Organisations");

  useEffect(() => {
    (async () => {
      if (user.role !== "superadmin") return;
      if (!refresh) return;
      const [error, response] = await tryFetchExpectOk(async () => API.get({ path: "/organisation", query: { withCounters: true } }));
      if (error) {
        toast.error(errorMessage(error));
        return;
      }
      const sortedDataAscendant = response.data?.sort((org1, org2) => (org1[sortBy] > org2[sortBy] ? 1 : -1));
      setOrganisations(sortOrder === "ASC" ? sortedDataAscendant : [...(sortedDataAscendant || [])].reverse());
      setSuperadmins(response.superadmins);
      setUsersConnectedLast24h(response.usersConnectedLast24h);
      setUpdateKey((k) => k + 1);
      setRefresh(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  useEffect(() => {
    const sortedDataAscendant = organisations?.sort((org1, org2) => (org1[sortBy] > org2[sortBy] ? 1 : -1));
    setOrganisations(sortOrder === "ASC" ? sortedDataAscendant : [...(sortedDataAscendant || [])].reverse());
    setUpdateKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder]);

  const total = organisations?.length;

  if (user.role !== "superadmin") return <Redirect to="/stats" />;

  return (
    <>
      <TopBar />
      <div className="tw-bg-white tw-z-10 tw-pb-4 tw-pt-2 tw-px-8 tw-flex tw-justify-between tw-shadow tw-w-full">
        <div>
          <h2 className="tw-text-xl tw-mb-0">Organisations ({total})</h2>
          <div className="tw-text-xs tw-text-gray-500">
            <b>{superadmins || "-"}</b> superadmins • <b>{usersConnectedLast24h || "-"}</b> users connectés ces dernières 24h
          </div>
        </div>
        <div>
          <button
            className="button-classic"
            type="button"
            onClick={() => {
              setSearchUserModal(true);
            }}
          >
            🧐 &nbsp;Recherche utilisateur
          </button>
          <button className="button-submit" type="button" onClick={() => setOpenCreateModal(true)}>
            Nouvelle organisation
          </button>
        </div>
      </div>
      <div className="main">
        <main
          id="main-content"
          className="tw-relative tw-flex tw-grow tw-basis-full tw-flex-col tw-overflow-auto tw-overflow-x-hidden tw-overflow-y-scroll tw-px-2 sm:tw-px-12 sm:tw-pb-12 sm:tw-pt-4 print:!tw-ml-0 print:tw-h-auto print:tw-max-w-full print:tw-overflow-visible print:tw-p-0"
        >
          <Create onChange={() => setRefresh(true)} open={openCreateModal} setOpen={setOpenCreateModal} />
          <MergeOrganisations onChange={() => setRefresh(true)} open={openMergeModal} setOpen={setOpenMergeModal} organisations={organisations} />
          <DuplicateFieldsModal open={openDuplicateFieldsModal} setOpen={setOpenDuplicateFieldsModal} />
          <SuperadminOrganisationUsers
            open={openUserListModal}
            setOpen={setOpenUserListModal}
            setOpenCreateUserModal={setOpenCreateUserModal}
            setOpenEditUserModal={setOpenEditUserModal}
            setEditUser={setEditUser}
            openCreateUserModal={openCreateUserModal}
            openEditUserModal={openEditUserModal}
            organisation={selectedOrganisation}
            setSelectedOrganisation={setSelectedOrganisation}
          />
          <SuperadminUsersSearch
            open={searchUserModal}
            setOpen={setSearchUserModal}
            setSelectedOrganisation={(o) => {
              setSelectedOrganisation(o);
              setOpenUserListModal(true);
            }}
          />
          <SuperadminOrganisationSettings
            key={selectedOrganisation?._id}
            organisation={selectedOrganisation}
            open={openOrgSettingsModal}
            setOpen={setOpenOrgSettingsModal}
            updateOrganisation={(nextOrg) => {
              setOrganisations(
                organisations.map((orga) => {
                  if (orga._id !== nextOrg._id) return orga;
                  return {
                    ...orga,
                    ...nextOrg,
                  };
                })
              );
            }}
          />
          <CreateUser
            onChange={() => setRefresh(true)}
            open={openCreateUserModal}
            setOpen={setOpenCreateUserModal}
            organisation={selectedOrganisation}
          />
          <RawDataModal open={openRawDataModal} setOpen={setOpenRawDataModal} organisation={selectedOrganisation} />
          <EditUser
            editUser={editUser}
            onChange={() => setRefresh(true)}
            open={openEditUserModal}
            setOpen={setOpenEditUserModal}
            organisation={selectedOrganisation}
          />

          {!organisations?.length ? (
            refresh ? (
              <Loading />
            ) : null
          ) : (
            <Table
              data={organisations}
              key={updateKey}
              columns={[
                {
                  title: "Nom",
                  dataKey: "name",
                  onSortOrder: setSortOrder,
                  onSortBy: setSortBy,
                  sortOrder,
                  sortBy,
                  render: (o) => (
                    <div className="tw-flex tw-flex-col tw-gap-2 tw-max-w-80">
                      <div>
                        <div className="tw-font-bold">
                          {o.name}
                          {o.disabledAt ? <div className="tw-text-red-500">(désactivée)</div> : ""}
                        </div>
                        <div className="tw-text-xs tw-text-gray-500">ID: {o.orgId}</div>
                      </div>
                      <div>
                        <div className="tw-text-xs tw-text-gray-600 tw-font-bold">{o.city?.split?.(" - ")?.[0] || "non renseignée"}</div>
                        <div className="tw-text-xs tw-text-gray-500">{o.region || ""}</div>
                      </div>
                      <div className="tw-text-gray-500 tw-text-xs">
                        Responsable&nbsp;: <b>{o.responsible}</b>
                        <br />
                        {o.encryptionLastUpdateAt
                          ? "Dernier chiffrement : " + formatDateWithFullMonth(o.encryptionLastUpdateAt)
                          : "Pas encore chiffrée"}
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Créée le",
                  dataKey: "createdAt",
                  render: (o) => (
                    <div>
                      {formatDateWithFullMonth(o.createdAt || "")}
                      <br />
                      <small className="tw-text-gray-500">il y a {o.createdAt ? formatAge(o.createdAt) : "un certain temps"}</small>
                    </div>
                  ),
                  onSortOrder: setSortOrder,
                  onSortBy: setSortBy,
                  sortOrder,
                  sortBy,
                },
                {
                  title: "Utilisateurs",
                  dataKey: "users",
                  sortableKey: "users",
                  onSortOrder: setSortOrder,
                  onSortBy: setSortBy,
                  sortOrder,
                  sortBy,
                  render: (o) => {
                    return (
                      <>
                        <div>Utilisateurs: {o.users || 0}</div>
                        <div className="tw-grid tw-grid-cols-2 tw-text-xs tw-mt-2 tw-text-gray-600">
                          <div className={!o.usersByRole["admin"] ? "tw-text-gray-400" : ""}>Admin: {o.usersByRole["admin"] || 0}</div>
                          <div className={!o.usersByRole["restricted-access"] ? "tw-text-gray-400" : ""}>
                            Restreint: {o.usersByRole["restricted-access"] || 0}
                          </div>
                          <div className={!o.usersByRole["normal"] ? "tw-text-gray-400" : ""}>Normal: {o.usersByRole["normal"] || 0}</div>
                          <div className={!o.usersByRole["stats-only"] ? "tw-text-gray-400" : ""}>Stats: {o.usersByRole["stats-only"] || 0}</div>
                        </div>
                        <div className="tw-mt-2 tw-text-xs tw-text-gray-600">
                          <div className={!o.usersProSante ? "tw-text-gray-400" : ""}>Pro de santé: {o.usersProSante || 0}</div>
                          <div className={!o.usersDisabled ? "tw-text-gray-400" : ""}>
                            {o.usersDisabled > 0 && o.users === o.usersDisabled ? (
                              <span className="tw-text-red-500 tw-font-bold">Désactivé: {o.usersDisabled || 0} 👻 ⚠️</span>
                            ) : (
                              `Désactivé: ${o.usersDisabled || 0}`
                            )}
                          </div>
                          <div className={!o.usersNeverConnected ? "tw-text-gray-400" : ""}>Jamais connecté: {o.usersNeverConnected || 0}</div>
                          <div className={!o.usersConnectedToday ? "tw-text-gray-400" : ""}>Connecté aujourd'hui: {o.usersConnectedToday || 0}</div>
                        </div>
                      </>
                    );
                  },
                },
                {
                  title: "Compteurs",
                  dataKey: "counters",
                  sortableKey: "countersTotal",
                  onSortOrder: setSortOrder,
                  onSortBy: setSortBy,
                  sortOrder,
                  sortBy,
                  render: (o) => {
                    return (
                      <div className="tw-grid tw-grid-cols-2 tw-gap-x-1.5">
                        <div className={!o.counters.persons ? "tw-text-gray-400" : ""}>
                          Personnes: {o.counters.persons || 0}
                          {o.counters.persons > 0 && (
                            <SmallEvolutionIndicator last30Days={o.last30DaysCounters.persons} previous30Days={o.previous30DaysCounters.persons} />
                          )}
                        </div>
                        <div className={!o.groupsEnabled ? "tw-line-through tw-opacity-20" : !o.counters.groups ? "tw-text-gray-400" : ""}>
                          Familles: {o.counters.groups || 0}
                          {o.counters.groups > 0 && (
                            <SmallEvolutionIndicator last30Days={o.last30DaysCounters.groups} previous30Days={o.previous30DaysCounters.groups} />
                          )}
                        </div>
                        <div className={!o.counters.actions ? "tw-text-gray-400" : ""}>
                          Actions: {o.counters.actions || 0}
                          {o.counters.actions > 0 && (
                            <SmallEvolutionIndicator last30Days={o.last30DaysCounters.actions} previous30Days={o.previous30DaysCounters.actions} />
                          )}
                        </div>
                        <div className={!o.passagesEnabled ? "tw-line-through tw-opacity-20" : !o.counters.passages ? "tw-text-gray-400" : ""}>
                          Passages: {o.counters.passages || 0}
                          {o.counters.passages > 0 && (
                            <SmallEvolutionIndicator last30Days={o.last30DaysCounters.passages} previous30Days={o.previous30DaysCounters.passages} />
                          )}
                        </div>
                        <div className={!o.rencontresEnabled ? "tw-line-through tw-opacity-20" : !o.counters.rencontres ? "tw-text-gray-400" : ""}>
                          Rencontres: {o.counters.rencontres || 0}
                          {o.counters.rencontres > 0 && (
                            <SmallEvolutionIndicator
                              last30Days={o.last30DaysCounters.rencontres}
                              previous30Days={o.previous30DaysCounters.rencontres}
                            />
                          )}
                        </div>
                        <div className={!o.territoriesEnabled ? "tw-line-through tw-opacity-20" : !o.counters.observations ? "tw-text-gray-400" : ""}>
                          Observations: {o.counters.observations || 0}
                          {o.counters.observations > 0 && (
                            <SmallEvolutionIndicator
                              last30Days={o.last30DaysCounters.observations}
                              previous30Days={o.previous30DaysCounters.observations}
                            />
                          )}
                        </div>
                        <div className={!o.counters.comments ? "tw-text-gray-400" : ""}>
                          Commentaires: {o.counters.comments || 0}
                          {o.counters.comments > 0 && (
                            <SmallEvolutionIndicator last30Days={o.last30DaysCounters.comments} previous30Days={o.previous30DaysCounters.comments} />
                          )}
                        </div>
                        <div className={!o.counters.consultations ? "tw-text-gray-400" : ""}>
                          Consultations: {o.counters.consultations || 0}
                          {o.counters.consultations > 0 && (
                            <SmallEvolutionIndicator
                              last30Days={o.last30DaysCounters.consultations}
                              previous30Days={o.previous30DaysCounters.consultations}
                            />
                          )}
                        </div>
                      </div>
                    );
                  },
                },
                {
                  title: "Action",
                  dataKey: "delete",
                  style: { width: "100px" },
                  render: (organisation) => {
                    return (
                      <div className="tw-grid tw-grid-cols-2 tw-gap-1.5">
                        <div>
                          <button
                            className="button-classic !tw-ml-0 !tw-px-3 my-tooltip"
                            data-tooltip={"Modifier"}
                            type="button"
                            data-testid={`Modifier l'organisation ${organisation.name}`}
                            onClick={() => {
                              setSelectedOrganisation(organisation);
                              setOpenOrgSettingsModal(true);
                            }}
                          >
                            ✏️
                          </button>
                        </div>
                        <div>
                          <button
                            className="button-classic !tw-ml-0 !tw-px-3  my-tooltip"
                            data-tooltip={"Utilisateurs"}
                            type="button"
                            data-testid={`Voir les utilisateurs ${organisation.name}`}
                            onClick={() => {
                              setSelectedOrganisation(organisation);
                              setOpenUserListModal(true);
                            }}
                          >
                            🧑‍💻
                          </button>
                        </div>
                        <div>
                          <button
                            type="button"
                            className="button-classic tw-text-left !tw-ml-0 !tw-px-3  my-tooltip"
                            data-testid={`Ajouter utilisateur ${organisation.name}`}
                            data-tooltip={"Ajouter utilisateur"}
                            onClick={() => {
                              setSelectedOrganisation(organisation);
                              setOpenCreateUserModal(true);
                            }}
                          >
                            ➕
                          </button>
                        </div>
                        {!organisation.disabledAt ? (
                          <div>
                            <button
                              type="button"
                              className="button-classic tw-text-left !tw-ml-0 !tw-px-3  my-tooltip"
                              data-testid={`Désactiver l'organisation ${organisation.name}`}
                              data-tooltip={"Désactiver"}
                              onClick={async () => {
                                if (
                                  confirm(
                                    "Voulez-vous vraiment désactiver l'organisation " +
                                      organisation.name +
                                      " ? Plus personne ne pourra se connecter. Cette action doit être faite uniquement en cas d'attaque (piratage ou autre)"
                                  )
                                ) {
                                  const [error] = await tryFetchExpectOk(async () => API.post({ path: `/organisation/${organisation._id}/disable` }));
                                  if (!error) {
                                    toast.success("Organisation désactivée");
                                    setRefresh(true);
                                  } else {
                                    toast.error(errorMessage(error));
                                  }
                                }
                              }}
                            >
                              😴
                            </button>
                          </div>
                        ) : (
                          <div>
                            <button
                              type="button"
                              className="button-classic tw-text-left !tw-ml-0 !tw-px-3  my-tooltip"
                              data-testid={`Réactiver l'organisation ${organisation.name}`}
                              data-tooltip={"Réactiver"}
                              onClick={async () => {
                                if (confirm("Voulez-vous vraiment réactiver l'organisation " + organisation.name + " ?")) {
                                  const [error] = await tryFetchExpectOk(async () => API.post({ path: `/organisation/${organisation._id}/enable` }));
                                  if (!error) {
                                    toast.success("Organisation réactivée");
                                    setRefresh(true);
                                  } else {
                                    toast.error(errorMessage(error));
                                  }
                                }
                              }}
                            >
                              ⏰
                            </button>
                          </div>
                        )}
                        <div>
                          <button
                            type="button"
                            className="button-classic tw-text-left !tw-ml-0 !tw-px-3  my-tooltip"
                            data-testid={`Infos brutes`}
                            data-tooltip={"Infos brutes"}
                            onClick={() => {
                              setSelectedOrganisation(organisation);
                              setOpenRawDataModal(true);
                            }}
                          >
                            🔨
                          </button>
                        </div>
                        <div>
                          <DeleteButtonAndConfirmModal
                            title={`Voulez-vous vraiment supprimer l'organisation ${organisation.name}`}
                            buttonText="🗑️"
                            className="!tw-ml-0 !tw-px-3"
                            textToConfirm={organisation.name}
                            onConfirm={async () => {
                              const [error] = await tryFetchExpectOk(async () => API.delete({ path: `/organisation/${organisation._id}` }));
                              if (!error) {
                                toast.success("Organisation supprimée");
                                setRefresh(true);
                              } else {
                                toast.error(errorMessage(error));
                              }
                            }}
                          >
                            <span className="tw-mb-8 tw-block tw-w-full tw-text-center">
                              Cette opération est irréversible
                              <br />
                              et entrainera la suppression définitive de toutes les données liées à l'organisation&nbsp;:
                              <br />
                              équipes, utilisateurs, personnes suivies, actions, territoires, commentaires et observations, comptes-rendus...
                            </span>
                          </DeleteButtonAndConfirmModal>
                        </div>
                      </div>
                    );
                  },
                },
              ]}
              rowKey={"_id"}
              onRowClick={null}
            />
          )}
          {organisations?.length > 0 && (
            <div className="tw-mt-8 tw-flex tw-gap-3 tw-justify-center tw-pb-4">
              <button
                className="button-classic"
                type="button"
                onClick={() => {
                  setOpenDuplicateFieldsModal(true);
                }}
              >
                🔍 &nbsp;Doublons de champs
              </button>
              <button
                className="button-classic"
                type="button"
                onClick={() => {
                  const geoJson = JSON.stringify(getUmapGeoJSONFromOrgs(organisations), null, 2);
                  // download
                  const blob = new Blob([geoJson], { type: "application/json" });
                  download(blob, "villes-utilisatrices-de-mano_umap.geojson");
                }}
              >
                Export vers umap
              </button>
              <button
                className="button-destructive"
                type="button"
                onClick={() => {
                  setOpenMergeModal(true);
                }}
              >
                Fusionner deux orgas
              </button>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

const options = [
  { value: "Guillaume", label: "Guillaume" },
  { value: "Melissa", label: "Melissa" },
  { value: "Simon", label: "Simon" },
  { value: undefined, label: "Non renseigné" },
];

const Create = ({ onChange, open, setOpen }) => {
  return (
    <>
      <ModalContainer open={open} onClose={() => setOpen(false)} size="3xl" blurryBackground>
        <ModalHeader title="Créer une nouvelle organisation et un administrateur" />
        <Formik
          initialValues={{ orgName: "", name: "", email: "", orgId: "", city: "", responsible: "", region: "" }}
          validate={(values) => {
            const errors = {};
            if (!values.name) errors.name = "Le nom est obligatoire";
            if (!values.orgName) errors.orgName = "Le nom de l'organisation est obligatoire";
            if (!values.orgId) errors.orgId = "L'identifiant est obligatoire";
            if (!values.city) errors.city = "La ville est obligatoire";
            if (!values.email) errors.email = "L'email est obligatoire";
            if (!values.responsible) errors.responsible = "Le responsable est obligatoire";
            else if (!emailRegex.test(values.email)) errors.email = "L'email est invalide";
            return errors;
          }}
          onSubmit={async (body, actions) => {
            if (!(body.emailDirection || "").trim()) body.emailDirection = undefined;
            if (!(body.emailDpo || "").trim()) body.emailDpo = undefined;
            const [error] = await tryFetch(async () => API.post({ path: "/organisation", body }));
            actions.setSubmitting(false);
            if (error) {
              return toast.error(errorMessage(error));
            }
            toast.success("Création réussie !");
            onChange();
            setOpen(false);
          }}
        >
          {({ values, handleChange, handleSubmit, touched, errors }) => (
            <>
              <ModalBody className="tw-px-4 tw-py-2">
                <React.Fragment>
                  <div className="-tw-mx-4 tw-flex tw-flex-row tw-flex-wrap tw-mb-2">
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <label htmlFor="orgName">Nom</label>
                      <input className="tailwindui" autoComplete="off" name="orgName" id="orgName" value={values.orgName} onChange={handleChange} />
                      {touched.orgName && errors.orgName && <span className="tw-text-xs tw-text-red-500">{errors.orgName}</span>}
                    </div>
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <label htmlFor="orgId">
                        Identifiant interne <small>(non modifiable par les users)</small>
                      </label>
                      <input className="tailwindui" autoComplete="off" name="orgId" id="orgId" value={values.orgId} onChange={handleChange} />
                      {touched.orgId && errors.orgId && <span className="tw-text-xs tw-text-red-500">{errors.orgId}</span>}
                    </div>
                  </div>
                  <div className="-tw-mx-4 tw-flex tw-flex-row tw-flex-wrap tw-mb-2">
                    <div className="tw-flex tw-basis-full tw-flex-col tw-px-4 tw-py-2">
                      <label htmlFor="organisation-create-city">Ville</label>
                      <CitySelect
                        name="city"
                        id="organisation-create-city"
                        value={{ city: values.city, region: values.region }}
                        onChange={(next) => {
                          handleChange({ target: { name: "city", value: next.city } });
                          handleChange({ target: { name: "region", value: next.region } });
                        }}
                      />
                      {touched.city && errors.city && <span className="tw-text-xs tw-text-red-500">{errors.city}</span>}
                    </div>
                  </div>
                  <div className="tw-flex tw-basis-full tw-flex-col tw-py-2 tw-mb-2">
                    <label htmlFor="organisation-responsible">Responsable / Chargé de déploiement</label>
                    <SelectCustom
                      name="responsible"
                      id="organisation-responsible"
                      inputId="organisation-responsible"
                      classNamePrefix="organisation-responsible"
                      value={options.find((o) => o.value === values.responsible)}
                      onChange={(nextResponsible) => {
                        handleChange({ target: { name: "responsible", value: nextResponsible.value } });
                      }}
                      options={options}
                    />
                    {touched.responsible && errors.responsible && <span className="tw-text-xs tw-text-red-500">{errors.responsible}</span>}
                  </div>
                  <div className="-tw-mx-4 tw-flex tw-flex-row tw-flex-wrap tw-mb-2">
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <label htmlFor="name">Nom de l'administrateur</label>
                      <input className="tailwindui" autoComplete="off" name="name" id="name" value={values.name} onChange={handleChange} />
                      {touched.name && errors.name && <span className="tw-text-xs tw-text-red-500">{errors.name}</span>}
                    </div>
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <label htmlFor="email">Email de l'administrateur</label>
                      <input className="tailwindui" autoComplete="off" name="email" id="email" value={values.email} onChange={handleChange} />
                      {touched.email && errors.email && <span className="tw-text-xs tw-text-red-500">{errors.email}</span>}
                    </div>
                  </div>
                  <div className="-tw-mx-4 tw-flex tw-flex-row tw-flex-wrap tw-mb-2">
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <label htmlFor="emailDirection">Email Direction</label>
                      <input
                        className="tailwindui"
                        autoComplete="off"
                        name="emailDirection"
                        id="emailDirection"
                        value={values.emailDirection}
                        onChange={handleChange}
                      />
                      {touched.emailDirection && errors.emailDirection && <span className="tw-text-xs tw-text-red-500">{errors.emailDirection}</span>}
                    </div>
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <label htmlFor="emailDpo">Email DPO</label>
                      <input
                        className="tailwindui"
                        autoComplete="off"
                        name="emailDpo"
                        id="emailDpo"
                        value={values.emailDpo}
                        onChange={handleChange}
                      />
                      {touched.emailDpo && errors.emailDpo && <span className="tw-text-xs tw-text-red-500">{errors.emailDpo}</span>}
                    </div>
                  </div>
                </React.Fragment>
              </ModalBody>
              <ModalFooter>
                <button type="button" name="cancel" className="button-cancel" onClick={() => setOpen(false)}>
                  Annuler
                </button>
                <button className="button-submit" onClick={handleSubmit}>
                  Créer
                </button>
              </ModalFooter>
            </>
          )}
        </Formik>
      </ModalContainer>
    </>
  );
};

const RawDataModal = ({ open, setOpen, organisation }) => {
  const [organisationData, setOrganisationData] = useState(null);
  const [organisationLogs, setOrganisationLogs] = useState(null);
  const [tableSizes, setTableSizes] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showTableSizes, setShowTableSizes] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingTableSizes, setLoadingTableSizes] = useState(false);
  const [isDiffMode, setIsDiffMode] = useState(false);

  useEffect(() => {
    if (!organisation?._id) return;
    (async () => {
      const response = await API.get({ path: `/organisation/${organisation._id}` });
      if (response.ok) {
        setOrganisationData(response.data);
        setOrganisationLogs(null);
        setTableSizes(null);
        setShowLogs(false);
        setShowTableSizes(false);
        setIsDiffMode(false);
      }
    })();
  }, [organisation]);

  const fetchLogs = async () => {
    if (!organisation?._id || organisationLogs) return;
    setLoadingLogs(true);
    try {
      const [error, response] = await tryFetchExpectOk(async () => API.get({ path: `/organisation/${organisation._id}/logs` }));
      if (error) {
        toast.error(errorMessage(error));
        return;
      }
      setOrganisationLogs(response.data);
    } catch (_err) {
      toast.error("Erreur lors du chargement des logs");
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchTableSizes = async () => {
    if (!organisation?._id || tableSizes) return;
    setLoadingTableSizes(true);
    try {
      const [error, response] = await tryFetchExpectOk(async () => API.get({ path: `/organisation/${organisation._id}/table-sizes` }));
      if (error) {
        toast.error(errorMessage(error));
        return;
      }
      setTableSizes(response.data);
    } catch (_err) {
      toast.error("Erreur lors du chargement des tailles de tables");
    } finally {
      setLoadingTableSizes(false);
    }
  };

  const handleToggleLogs = () => {
    if (!showLogs) {
      fetchLogs();
    }
    setShowLogs(!showLogs);
    setShowTableSizes(false);
    setIsDiffMode(false);
  };

  const handleToggleTableSizes = () => {
    if (!showTableSizes) {
      fetchTableSizes();
    }
    setShowTableSizes(!showTableSizes);
    setShowLogs(false);
    setIsDiffMode(false);
  };

  const formatLogValue = (value) => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  if (!organisationData) return null;
  return (
    <ModalContainer open={open} onClose={() => setOpen(false)} size="5xl" blurryBackground>
      <ModalHeader title={`Infos brutes de l'organisation ${organisationData.name}`} />
      <ModalBody className="tw-px-4 tw-py-2">
        <div className="tw-py-4">
          <div className="tw-flex tw-justify-between tw-items-center tw-mb-4">
            <h3 className="tw-text-lg tw-font-semibold">Données de l'organisation</h3>
            <div className="tw-flex tw-gap-2">
              <button
                type="button"
                className={`tw-px-4 tw-py-2 tw-rounded tw-text-sm tw-font-medium tw-bg-main tw-text-white`}
                onClick={handleToggleLogs}
                disabled={loadingLogs}
              >
                {loadingLogs ? "Chargement..." : showLogs ? "Masquer les modifications" : "Voir les modifications"}
              </button>
              <button
                type="button"
                className={`tw-px-4 tw-py-2 tw-rounded tw-text-sm tw-font-medium tw-bg-blue-600 tw-text-white`}
                onClick={handleToggleTableSizes}
                disabled={loadingTableSizes}
              >
                {loadingTableSizes ? "Chargement..." : showTableSizes ? "Masquer les tailles" : "Voir les tailles de tables"}
              </button>
              {showLogs && (
                <button
                  type="button"
                  className={`tw-px-4 tw-py-2 tw-rounded tw-text-sm tw-font-medium tw-bg-gray-600 tw-text-white`}
                  onClick={() => setIsDiffMode(!isDiffMode)}
                >
                  {isDiffMode ? "Vue complète" : "Vue diff"}
                </button>
              )}
            </div>
          </div>

          {!showLogs && !showTableSizes ? (
            <pre className="tw-text-xs tw-whitespace-pre-wrap">{JSON.stringify(organisationData, null, 2)}</pre>
          ) : showTableSizes ? (
            <div>
              {tableSizes && tableSizes.tablesSizes && tableSizes.tablesSizes.length > 0 ? (
                <div className="tw-overflow-x-auto">
                  <div className="tw-mb-4">
                    <h4 className="tw-text-lg tw-font-semibold tw-mb-2">Tailles des tables pour {tableSizes.organisation.name}</h4>
                    <p className="tw-text-sm tw-text-gray-600">ID: {tableSizes.organisation.orgId}</p>
                  </div>
                  <table className="tw-min-w-full tw-border tw-border-gray-300">
                    <thead className="tw-bg-gray-50">
                      <tr>
                        <th className="tw-px-4 tw-py-2 tw-text-left tw-text-xs tw-font-medium tw-text-gray-500 tw-uppercase tw-tracking-wider tw-border-b tw-border-gray-300">
                          Table
                        </th>
                        <th className="tw-px-4 tw-py-2 tw-text-left tw-text-xs tw-font-medium tw-text-gray-500 tw-uppercase tw-tracking-wider tw-border-b tw-border-gray-300">
                          Nombre de lignes
                        </th>
                        <th className="tw-px-4 tw-py-2 tw-text-left tw-text-xs tw-font-medium tw-text-gray-500 tw-uppercase tw-tracking-wider tw-border-b tw-border-gray-300">
                          Taille des données
                        </th>
                      </tr>
                    </thead>
                    <tbody className="tw-bg-white tw-divide-y tw-divide-gray-200">
                      {tableSizes.tablesSizes.map((table) => (
                        <tr key={table.table_name} className="hover:tw-bg-gray-50">
                          <td className="tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-gray-900 tw-border-b tw-border-gray-200">
                            {table.table_name}
                          </td>
                          <td className="tw-px-4 tw-py-2 tw-text-sm tw-text-gray-700 tw-border-b tw-border-gray-200">{table.row_count}</td>
                          <td className="tw-px-4 tw-py-2 tw-text-sm tw-text-gray-700 tw-border-b tw-border-gray-200">{table.data_size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : tableSizes && tableSizes.tablesSizes && tableSizes.tablesSizes.length === 0 ? (
                <div className="tw-text-center tw-text-gray-500 tw-py-8">Aucune donnée trouvée pour cette organisation.</div>
              ) : null}
              {loadingTableSizes && <div className="tw-text-center tw-text-gray-500 tw-py-8">Chargement des tailles de tables...</div>}
            </div>
          ) : (
            <div>
              {organisationLogs && organisationLogs.length > 0 ? (
                <div className="tw-overflow-x-auto">
                  {!isDiffMode ? (
                    <table className="tw-min-w-full tw-border tw-border-gray-300">
                      <thead className="tw-bg-gray-50">
                        <tr>
                          <th className="tw-px-4 tw-py-2 tw-text-left tw-text-xs tw-font-medium tw-text-gray-500 tw-uppercase tw-tracking-wider tw-border-b tw-border-gray-300">
                            Informations
                          </th>
                          <th className="tw-px-4 tw-py-2 tw-text-left tw-text-xs tw-font-medium tw-text-gray-500 tw-uppercase tw-tracking-wider tw-border-b tw-border-gray-300">
                            Ancienne valeur
                          </th>
                          <th className="tw-px-4 tw-py-2 tw-text-left tw-text-xs tw-font-medium tw-text-gray-500 tw-uppercase tw-tracking-wider tw-border-b tw-border-gray-300">
                            Nouvelle valeur
                          </th>
                        </tr>
                      </thead>
                      <tbody className="tw-bg-white tw-divide-y tw-divide-gray-200">
                        {organisationLogs.map((log) => (
                          <tr key={log._id} className="hover:tw-bg-gray-50">
                            <td className="tw-px-4 tw-py-2 tw-text-xs tw-text-gray-900 tw-border-b tw-border-gray-200 tw-align-top">
                              <div>
                                <div className="tw-text-sm tw-font-bold">{log.field}</div>
                                <div className="tw-font-medium">{log.User?.name || "Utilisateur supprimé"}</div>
                                <div className="tw-text-gray-500">{log.User?.email || "-"}</div>
                                <div>
                                  {formatDateWithFullMonth(log.createdAt)} {formatTime(log.createdAt)}
                                </div>
                              </div>
                            </td>
                            <td className="tw-px-4 tw-py-2 tw-text-xs tw-text-gray-700 tw-border-b tw-border-gray-200 tw-align-top">
                              <pre className="tw-whitespace-pre-wrap tw-max-w-xs tw-overflow-hidden">{formatLogValue(log.oldValue)}</pre>
                            </td>
                            <td className="tw-px-4 tw-py-2 tw-text-xs tw-text-gray-700 tw-border-b tw-border-gray-200 tw-align-top">
                              <pre className="tw-whitespace-pre-wrap tw-max-w-xs tw-overflow-hidden">{formatLogValue(log.newValue)}</pre>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="tw-space-y-6">
                      {organisationLogs.map((log) => (
                        <div key={log._id} className="tw-border tw-border-gray-300 tw-rounded-lg tw-overflow-hidden">
                          <div className="tw-bg-gray-50 tw-px-4 tw-py-3 tw-border-b tw-border-gray-300">
                            <div className="tw-flex tw-justify-between tw-items-start">
                              <div>
                                <div className="tw-text-sm tw-font-bold tw-text-gray-900">{log.field}</div>
                                <div className="tw-text-xs tw-text-gray-600">
                                  {log.User?.name || "Utilisateur supprimé"} ({log.User?.email || "-"})
                                </div>
                              </div>
                              <div className="tw-text-xs tw-text-gray-500">
                                {formatDateWithFullMonth(log.createdAt)} {formatTime(log.createdAt)}
                              </div>
                            </div>
                          </div>
                          <div className="tw-p-2">
                            <ReactDiffViewer
                              oldValue={formatLogValue(log.oldValue)}
                              newValue={formatLogValue(log.newValue)}
                              splitView={false}
                              hideLineNumbers={true}
                              showDiffOnly={true}
                              useDarkTheme={false}
                              styles={{
                                contentText: {
                                  fontSize: "11px",
                                  lineHeight: "16px",
                                },
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : organisationLogs && organisationLogs.length === 0 ? (
                <div className="tw-text-center tw-text-gray-500 tw-py-8">Aucune modification enregistrée pour cette organisation.</div>
              ) : null}
              {loadingLogs && <div className="tw-text-center tw-text-gray-500 tw-py-8">Chargement des logs...</div>}
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" name="cancel" className="button-cancel" onClick={() => setOpen(false)}>
          Fermer
        </button>
      </ModalFooter>
    </ModalContainer>
  );
};

const MergeOrganisations = ({ open, setOpen, organisations, onChange }) => {
  const [selectedOrganisationMain, setSelectedOrganisationMain] = useState(null);
  const [selectedOrganisationSecondary, setSelectedOrganisationSecondary] = useState(null);
  const [secretKey, setSecretKey] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <ModalContainer open={open} onClose={() => setOpen(false)} size="3xl" blurryBackground>
      <ModalHeader title="Fusion" />
      <ModalBody className="tw-px-4 tw-py-2 tw-pb-20">
        <div className="tw-py-4">
          Organisation <b>principale</b> (celle qui reste)
          <SelectCustom
            name="name"
            inputId="organisation-merge-main"
            classNamePrefix="organisation-merge-main"
            options={organisations}
            onChange={(org) => {
              setSelectedOrganisationMain(org);
            }}
            value={selectedOrganisationMain}
            getOptionValue={(org) => org._id}
            getOptionLabel={(i) => i?.name}
            formatOptionLabel={(org) => (
              <>
                {org.name} <span className="tw-text-sm tw-text-gray-600">{"(Id: " + org.orgId + ")"}</span>
              </>
            )}
          />
        </div>
        <div className="tw-py-4">
          Organisation <b>secondaire</b> (celle qui sera supprimée)
          <SelectCustom
            name="name"
            inputId="organisation-merge-secondary"
            classNamePrefix="organisation-merge-secondary"
            options={organisations}
            onChange={(org) => {
              setSelectedOrganisationSecondary(org);
            }}
            value={selectedOrganisationSecondary}
            getOptionValue={(org) => org._id}
            getOptionLabel={(i) => i?.name}
            formatOptionLabel={(org) => (
              <>
                {org.name} <span className="tw-text-sm tw-text-gray-600">{"(Id: " + org.orgId + ")"}</span>
              </>
            )}
          />
        </div>
        <div className="tw-py-4">
          Clé de l'orga (les deux clés doivent être identiques)
          <input
            className="tailwindui"
            autoComplete="off"
            type="text"
            value={secretKey}
            onChange={(e) => {
              setSecretKey(e.target.value);
            }}
          />
        </div>
        <div className="tw-mx-auto tw-flex tw-justify-center tw-py-4">
          <img src="/fusion.gif" />
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" name="cancel" disabled={loading} className="button-cancel" onClick={() => setOpen(false)}>
          Annuler
        </button>
        <button
          className="button-submit"
          disabled={loading}
          onClick={async () => {
            if (!confirm("AUCUN RETOUR EN ARRIERE POSSIBLE ! Voulez-vous vraiment fusionner ces deux organisations ?")) return;
            setLoading(true);

            if (!selectedOrganisationMain || !selectedOrganisationSecondary) {
              setLoading(false);
              return toast.error("Veuillez sélectionner les 2 organisations à fusionner");
            }

            if (!secretKey) {
              setLoading(false);
              return toast.error("La clé de l'organisation est obligatoire");
            }

            if (selectedOrganisationMain._id === selectedOrganisationSecondary._id) {
              setLoading(false);
              return toast.error("Les deux organisations ne peuvent pas être les mêmes");
            }

            const derived = await derivedMasterKey(secretKey);
            const encryptionKeyIsValid = await checkEncryptedVerificationKey(selectedOrganisationMain.encryptedVerificationKey, derived);
            if (!encryptionKeyIsValid) {
              setLoading(false);
              return toast.error("La clé de l'organisation principale n'est pas valide");
            }

            const encryptionKeyIsValid2 = await checkEncryptedVerificationKey(selectedOrganisationSecondary.encryptedVerificationKey, derived);
            if (!encryptionKeyIsValid2) {
              setLoading(false);
              return toast.error("La clé de l'organisation secondaire n'est pas valide");
            }

            const [error] = await tryFetchExpectOk(async () =>
              API.post({
                path: `/organisation/merge`,
                body: { mainId: selectedOrganisationMain._id, secondaryId: selectedOrganisationSecondary._id },
              })
            );
            setSelectedOrganisationMain(null);
            setSelectedOrganisationSecondary(null);
            setLoading(false);
            setOpen(false);
            if (!error) {
              toast.success("Fusion réussie, vérifiez quand même que tout est ok");
              onChange();
            } else {
              toast.error(errorMessage(error));
              toast.error("Catastrophe, la fusion d'organisation a échoué, appelez les devs");
            }
          }}
        >
          Valider
        </button>
      </ModalFooter>
    </ModalContainer>
  );
};

const CreateUser = ({ onChange, open, setOpen, organisation }) => {
  const [organisationTeams, setOrganisationTeams] = useState([]);
  useEffect(() => {
    if (!organisation?._id) return;
    (async () => {
      const [error, response] = await tryFetchExpectOk(async () => API.get({ path: `organisation/${organisation._id}/teams` }));
      if (error) return toast.error(errorMessage(error));
      setOrganisationTeams(response.data);
    })();
  }, [organisation?._id]);

  if (!organisation) return;

  return (
    <>
      <ModalContainer open={open} onClose={() => setOpen(false)} size="3xl" blurryBackground>
        <Formik
          initialValues={{ name: "", email: "", phone: "", team: [], healthcareProfessional: false }}
          onSubmit={async (body, actions) => {
            try {
              if (!body.email) return toast.error("L'email est obligatoire");
              if (!emailRegex.test(body.email)) return toast.error("L'email est invalide");
              if (!body.role) return toast.error("Le rôle est obligatoire");

              body.organisation = organisation._id;
              const [error] = await tryFetch(async () => API.post({ path: "/user", body }));
              if (error) {
                return false;
              }
              toast.success("Création réussie !");
              onChange();
              setOpen(false);
            } catch (orgCreationError) {
              actions.setSubmitting(false);
              toast.error(orgCreationError.message);
            }
          }}
        >
          {({ values, handleChange, handleSubmit }) => (
            <>
              <ModalHeader title={`Créer un utilisateur pour ${organisation.orgId}`} />
              <ModalBody className="tw-px-4 tw-py-2 tw-pb-20">
                <React.Fragment>
                  <div className="-tw-mx-4 tw-flex tw-flex-row tw-flex-wrap">
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <div className="tw-mb-4">
                        <label htmlFor="name">Nom</label>
                        <input className="tailwindui" autoComplete="off" name="name" id="name" value={values.name} onChange={handleChange} />
                      </div>
                    </div>

                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <div className="tw-mb-4">
                        <label htmlFor="email">Email</label>
                        <input
                          className="tailwindui"
                          autoComplete="off"
                          type="email"
                          name="email"
                          id="email"
                          value={values.email}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <div className="tw-mb-4">
                        <label htmlFor="phone">Téléphone</label>
                        <input
                          className="tailwindui"
                          autoComplete="off"
                          type="tel"
                          name="phone"
                          id="phone"
                          value={values.phone}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <div className="tw-mb-4">
                        <label htmlFor="team">Équipes</label>
                        <div>
                          <SelectCustom
                            name="name"
                            options={organisationTeams}
                            onChange={(teams) => handleChange({ target: { value: teams?.map((t) => t._id) || [], name: "team" } })}
                            value={values.team.map((_teamId) => organisationTeams.find((_team) => _team._id === _teamId))}
                            getOptionValue={(team) => team._id}
                            getOptionLabel={(team) => team.name}
                            isMulti
                            isDisabled={organisationTeams.length === 0}
                            inputId="team"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <div className="tw-mb-4">
                        <label htmlFor="role">Role</label>
                        <SelectRole handleChange={handleChange} value={values.role} />
                      </div>
                    </div>
                    <div className="tw-flex tw-basis-full tw-flex-col tw-px-4 tw-py-2">
                      <label htmlFor="healthcareProfessional" className="tw-mb-0">
                        <input
                          type="checkbox"
                          className="tw-mr-2"
                          name="healthcareProfessional"
                          id="healthcareProfessional"
                          checked={values.healthcareProfessional}
                          onChange={() => {
                            handleChange({
                              target: {
                                name: "healthcareProfessional",
                                checked: Boolean(!values.healthcareProfessional),
                                value: Boolean(!values.healthcareProfessional),
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
                  </div>
                </React.Fragment>
              </ModalBody>
              <ModalFooter>
                <button type="button" name="cancel" className="button-cancel" onClick={() => setOpen(false)}>
                  Annuler
                </button>
                <button className="button-submit" onClick={handleSubmit}>
                  Créer
                </button>
              </ModalFooter>
            </>
          )}
        </Formik>
      </ModalContainer>
    </>
  );
};

const EditUser = ({ onChange, open, setOpen, organisation, editUser }) => {
  const user = editUser;
  const [organisationTeams, setOrganisationTeams] = useState([]);
  useEffect(() => {
    if (!organisation?._id) return;
    (async () => {
      const [error, response] = await tryFetchExpectOk(async () => API.get({ path: `organisation/${organisation._id}/teams` }));
      if (error) return toast.error(errorMessage(error));
      setOrganisationTeams(response.data);
    })();
  }, [organisation?._id]);

  if (!organisation || !user) return;

  return (
    <>
      <ModalContainer open={open} onClose={() => setOpen(false)} size="3xl" blurryBackground>
        <Formik
          initialValues={{
            name: user.name,
            email: user.email,
            phone: user.phone,
            team: user.teams.map((t) => t._id),
            role: user.role,
            healthcareProfessional: user.healthcareProfessional,
          }}
          onSubmit={async (body, actions) => {
            try {
              if (!body.email) return toast.error("L'email est obligatoire");
              if (!body.name) return toast.error("Le nom est obligatoire");
              if (!emailRegex.test(body.email)) return toast.error("L'email est invalide");
              if (!body.role) return toast.error("Le rôle est obligatoire");

              body.organisation = organisation._id;
              const [error] = await tryFetch(() => API.put({ path: `/user/${user._id}`, body }));
              if (error) {
                toast.error(errorMessage(error));
                return false;
              }
              toast.success("Modification réussie !");
              onChange();
              setOpen(false);
            } catch (orgCreationError) {
              actions.setSubmitting(false);
              toast.error(orgCreationError.message);
            }
          }}
        >
          {({ values, handleChange, handleSubmit }) => (
            <>
              <ModalHeader title={`Modifier un utilisateur pour ${organisation.orgId}`} />
              <ModalBody className="tw-px-4 tw-py-2 tw-pb-20">
                <React.Fragment>
                  <div className="-tw-mx-4 tw-flex tw-flex-row tw-flex-wrap">
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <div className="tw-mb-4">
                        <label htmlFor="name">Nom</label>
                        <input className="tailwindui" autoComplete="off" name="name" id="name" value={values.name} onChange={handleChange} />
                      </div>
                    </div>

                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <div className="tw-mb-4">
                        <label htmlFor="email">Email</label>
                        <input
                          className="tailwindui"
                          autoComplete="off"
                          type="email"
                          name="email"
                          id="email"
                          value={values.email}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <div className="tw-mb-4">
                        <label htmlFor="phone">Téléphone</label>
                        <input
                          className="tailwindui"
                          autoComplete="off"
                          type="tel"
                          name="phone"
                          id="phone"
                          value={values.phone}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <div className="tw-mb-4">
                        <label htmlFor="team">Équipes</label>
                        <div>
                          <SelectCustom
                            name="name"
                            options={organisationTeams}
                            onChange={(teams) => handleChange({ target: { value: teams?.map((t) => t._id) || [], name: "team" } })}
                            value={values.team.map((_teamId) => organisationTeams.find((_team) => _team._id === _teamId))}
                            getOptionValue={(team) => team._id}
                            getOptionLabel={(team) => team.name}
                            isMulti
                            isDisabled={organisationTeams.length === 0}
                            inputId="team"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                      <div className="tw-mb-4">
                        <label htmlFor="role">Role</label>
                        <SelectRole handleChange={handleChange} value={values.role} />
                      </div>
                    </div>
                    <div className="tw-flex tw-basis-full tw-flex-col tw-px-4 tw-py-2">
                      <label htmlFor="healthcareProfessional" className="tw-mb-0">
                        <input
                          type="checkbox"
                          className="tw-mr-2"
                          name="healthcareProfessional"
                          id="healthcareProfessional"
                          checked={values.healthcareProfessional}
                          onChange={() => {
                            handleChange({
                              target: {
                                name: "healthcareProfessional",
                                checked: Boolean(!values.healthcareProfessional),
                                value: Boolean(!values.healthcareProfessional),
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
                  </div>
                </React.Fragment>
              </ModalBody>
              <ModalFooter>
                <button type="button" name="cancel" className="button-cancel" onClick={() => setOpen(false)}>
                  Annuler
                </button>
                <button className="button-submit" onClick={handleSubmit}>
                  Enregistrer
                </button>
              </ModalFooter>
            </>
          )}
        </Formik>
      </ModalContainer>
    </>
  );
};

function SmallEvolutionIndicator({ last30Days, previous30Days }) {
  return (
    <span
      className={`tw-text-xs tw-ml-0.5 ${last30Days === previous30Days ? "tw-text-gray-500" : last30Days > previous30Days ? "tw-text-green-700" : "tw-text-red-700"}`}
    >
      ({last30Days || 0})
    </span>
  );
}

const DuplicateFieldsModal = ({ open, setOpen }) => {
  const [loading, setLoading] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [fixing, setFixing] = useState(false);
  const [selectedOrgs, setSelectedOrgs] = useState({});

  useEffect(() => {
    if (!open) {
      setDiagnosticData(null);
      setSelectedOrgs({});
      return;
    }
    (async () => {
      setLoading(true);
      const [error, response] = await tryFetchExpectOk(async () => API.get({ path: "/organisation/check-duplicate-fields" }));
      if (error) {
        toast.error(errorMessage(error));
        setLoading(false);
        return;
      }
      setDiagnosticData(response);
      // Pre-select all organisations with problems
      const preSelected = {};
      for (const org of response.data || []) {
        preSelected[org._id] = true;
      }
      setSelectedOrgs(preSelected);
      setLoading(false);
    })();
  }, [open]);

  const handleFix = async () => {
    const orgIds = Object.keys(selectedOrgs).filter((id) => selectedOrgs[id]);
    if (orgIds.length === 0) {
      toast.error("Veuillez sélectionner au moins une organisation à corriger");
      return;
    }

    const confirmMessage = `Voulez-vous vraiment corriger les doublons pour ${orgIds.length} organisation(s) ?\n\nCette action va :\n- Garder le premier champ tel quel\n- Renommer les doublons avec un nouveau nom technique unique\n- Ajouter un suffixe unique aux labels (2), (3), etc. en évitant les conflits`;

    if (!confirm(confirmMessage)) return;

    setFixing(true);
    const [error, response] = await tryFetchExpectOk(async () =>
      API.post({
        path: "/organisation/fix-duplicate-fields",
        body: { organisationIds: orgIds },
      })
    );

    setFixing(false);

    if (error) {
      toast.error(errorMessage(error));
      return;
    }

    const totalFixed = response.data.reduce((sum, r) => sum + (r.fixedCount || 0), 0);
    toast.success(`Correction réussie ! ${totalFixed} doublons corrigés dans ${orgIds.length} organisation(s)`);

    // Refresh diagnostic data
    setLoading(true);
    const [refreshError, refreshResponse] = await tryFetchExpectOk(async () => API.get({ path: "/organisation/check-duplicate-fields" }));
    if (refreshError) {
      toast.error(errorMessage(refreshError));
      setLoading(false);
      return;
    }
    setDiagnosticData(refreshResponse);
    setSelectedOrgs({});
    setLoading(false);
  };

  const toggleOrg = (orgId) => {
    setSelectedOrgs((prev) => ({
      ...prev,
      [orgId]: !prev[orgId],
    }));
  };

  const toggleAll = () => {
    if (Object.values(selectedOrgs).every((v) => v)) {
      setSelectedOrgs({});
    } else {
      const allSelected = {};
      for (const org of diagnosticData?.data || []) {
        allSelected[org._id] = true;
      }
      setSelectedOrgs(allSelected);
    }
  };

  return (
    <ModalContainer open={open} onClose={() => setOpen(false)} size="5xl" blurryBackground>
      <ModalHeader title="Diagnostic des doublons de champs personnalisés" />
      <ModalBody className="tw-px-4 tw-py-2">
        {loading ? (
          <div className="tw-text-center tw-py-8">
            <Loading />
          </div>
        ) : diagnosticData ? (
          <div>
            <div className="tw-mb-4 tw-p-4 tw-bg-blue-50 tw-rounded">
              <div className="tw-font-semibold tw-mb-2">Résumé</div>
              <div className="tw-text-sm">
                {diagnosticData.organisationsWithProblems} organisation(s) avec des doublons sur {diagnosticData.totalOrganisations} organisations au
                total
              </div>
            </div>

            {diagnosticData.data && diagnosticData.data.length > 0 ? (
              <>
                <div className="tw-mb-4 tw-flex tw-justify-between tw-items-center">
                  <button type="button" className="button-classic" onClick={toggleAll} disabled={fixing}>
                    {Object.values(selectedOrgs).every((v) => v) ? "Tout désélectionner" : "Tout sélectionner"}
                  </button>
                  <div className="tw-text-sm tw-text-gray-600">
                    {Object.values(selectedOrgs).filter((v) => v).length} organisation(s) sélectionnée(s)
                  </div>
                </div>

                <div className="tw-space-y-4 tw-max-h-96 tw-overflow-y-auto">
                  {diagnosticData.data.map((org) => (
                    <div key={org._id} className="tw-border tw-border-gray-300 tw-rounded-lg tw-p-4">
                      <div className="tw-flex tw-items-start tw-gap-3 tw-mb-3">
                        <input
                          type="checkbox"
                          className="tw-mt-1"
                          checked={selectedOrgs[org._id] || false}
                          onChange={() => toggleOrg(org._id)}
                          disabled={fixing}
                        />
                        <div className="tw-flex-1">
                          <div className="tw-font-bold tw-text-lg">{org.name}</div>
                          <div className="tw-text-sm tw-text-gray-600">ID: {org.orgId}</div>
                        </div>
                      </div>

                      {org.duplicates.map((duplicate, idx) => (
                        <div key={idx} className="tw-ml-7 tw-mt-2 tw-p-3 tw-bg-yellow-50 tw-rounded">
                          <div className="tw-font-semibold tw-text-sm tw-mb-2">Groupe: {duplicate.groupName}</div>
                          {duplicate.duplicateFields.map((field, fieldIdx) => (
                            <div key={fieldIdx} className="tw-ml-4 tw-mb-3">
                              <div className="tw-text-sm tw-font-medium tw-text-red-600 tw-mb-1">
                                ⚠️ Champ "{field.fieldName}" ({field.count} occurrences)
                              </div>
                              <div className="tw-ml-4 tw-text-xs tw-space-y-1">
                                {field.fields.map((f, fIdx) => (
                                  <div key={fIdx} className={fIdx === 0 ? "tw-text-green-700" : "tw-text-gray-600"}>
                                    {fIdx === 0 ? "✓ " : "→ "}
                                    <span className="tw-font-mono">{f.label}</span>
                                    {fIdx === 0 ? (
                                      <span className="tw-ml-2 tw-text-xs">(sera conservé tel quel)</span>
                                    ) : (
                                      <span className="tw-ml-2 tw-text-xs">
                                        (sera renommé avec un suffixe unique (2), (3), etc. et un nouveau nom technique)
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="tw-text-center tw-text-gray-500 tw-py-8">✅ Aucun doublon détecté ! Toutes les organisations sont en ordre.</div>
            )}
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <button type="button" name="cancel" className="button-cancel" onClick={() => setOpen(false)} disabled={fixing}>
          Fermer
        </button>
        {diagnosticData?.data && diagnosticData.data.length > 0 && (
          <button type="button" className="button-submit" onClick={handleFix} disabled={fixing || Object.values(selectedOrgs).every((v) => !v)}>
            {fixing ? "Correction en cours..." : "Corriger les doublons sélectionnés"}
          </button>
        )}
      </ModalFooter>
    </ModalContainer>
  );
};

export default SuperAdmin;
