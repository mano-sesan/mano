import { useAtom, useAtomValue } from "jotai";
import { modalObservationState } from "../atoms/modal";
import { useMemo, useState } from "react";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "./tailwind/Modal";
import { currentTeamAuthentifiedState, organisationAuthentifiedState, teamsState, userAuthentifiedState } from "../atoms/auth";
import { territoriesState } from "../atoms/territory";
import { customFieldsObsSelector, encryptObs, groupedCustomFieldsObsSelector } from "../atoms/territoryObservations";
import { RencontreInstance } from "../types/rencontre";
import { encryptRencontre, rencontresState } from "../atoms/rencontres";
import { useDataLoader } from "../services/dataLoader";
import Table from "./table";
import CustomFieldInput from "./CustomFieldInput";
import DateBloc, { TimeBlock } from "./DateBloc";
import DatePicker from "./DatePicker";
import SelectTeam from "./SelectTeam";
import SelectCustom from "./SelectCustom";
import { TerritoryObservationInstance } from "../types/territoryObs";
import { toast } from "react-toastify";
import { dayjsInstance, outOfBoundariesDate } from "../services/date";
import API, { tryFetchExpectOk } from "../services/api";
import Rencontre from "./Rencontre";
import PersonName from "./PersonName";
import TagTeam from "./TagTeam";
import UserName from "./UserName";
import { useLocation } from "react-router-dom";

export default function ObservationModal() {
  const [modalObservation, setModalObservation] = useAtom(modalObservationState);
  const [resetAfterLeave, setResetAfterLeave] = useState(false);
  const location = useLocation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const open = modalObservation.open && location.pathname === modalObservation.from;

  return (
    <ModalContainer
      open={open}
      size="full"
      onAfterLeave={() => {
        setIsSubmitting(false);
        setIsDeleting(false);
        // Seulement dans le cas du bouton fermer, de la croix, ou de l'enregistrement :
        // On supprime le la liste des personnes suivies pour ne pas la réutiliser.
        if (resetAfterLeave) {
          setResetAfterLeave(false);
          setModalObservation({ open: false });
        }
      }}
    >
      {modalObservation.observation ? (
        <ObservationContent
          key={modalObservation.observation._id + String(open)}
          onClose={() => {
            setResetAfterLeave(true);
            setModalObservation((modalObservation) => ({ ...modalObservation, open: false }));
          }}
          isSubmitting={isSubmitting}
          setIsSubmitting={setIsSubmitting}
          isDeleting={isDeleting}
          setIsDeleting={setIsDeleting}
        />
      ) : null}
    </ModalContainer>
  );
}

function ObservationContent({
  onClose,
  isSubmitting,
  setIsSubmitting,
  isDeleting,
  setIsDeleting,
}: {
  onClose: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (isSubmitting: boolean) => void;
  isDeleting: boolean;
  setIsDeleting: (isDeleting: boolean) => void;
}) {
  const [modalObservation, setModalObservation] = useAtom(modalObservationState);
  const user = useAtomValue(userAuthentifiedState);
  const teams = useAtomValue(teamsState);
  const organisation = useAtomValue(organisationAuthentifiedState);
  const team = useAtomValue(currentTeamAuthentifiedState);
  const territories = useAtomValue(territoriesState);
  const customFieldsObs = useAtomValue(customFieldsObsSelector);
  const groupedCustomFieldsObs = useAtomValue(groupedCustomFieldsObsSelector);
  const visibleGroupedCustomFieldsObs = useMemo(() => {
    return groupedCustomFieldsObs
      .map((group) => ({
        ...group,
        fields: (group.fields || []).filter((f) => f).filter((f) => f.enabled || (f.enabledTeams || []).includes(team._id)),
      }))
      .filter((group) => group.fields.length > 0);
  }, [groupedCustomFieldsObs, team._id]);

  const fieldsGroupNames = useMemo(() => visibleGroupedCustomFieldsObs.map((g) => g.name).filter((n) => n), [visibleGroupedCustomFieldsObs]);
  const [isRencontreModalOpen, setIsRencontreModalOpen] = useState(false);
  const [rencontre, setRencontre] = useState<RencontreInstance>();
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [deleteRencontresChecked, setDeleteRencontresChecked] = useState(true);

  const rencontres = useAtomValue<Array<RencontreInstance>>(rencontresState);
  const { refresh } = useDataLoader();
  const observation = modalObservation.observation;
  const rencontresInProgress = modalObservation.rencontresInProgress;
  const resolvedActiveTab =
    activeTab === "_rencontres" || (activeTab && fieldsGroupNames.includes(activeTab))
      ? activeTab
      : fieldsGroupNames[0] || (organisation.rencontresEnabled ? "_rencontres" : undefined);

  const rencontresForObs = useMemo(() => {
    return rencontres?.filter((r) => observation?._id && r.observation === observation?._id) || [];
  }, [rencontres, observation]);
  const currentRencontres = [...rencontresInProgress, ...rencontresForObs.map((r) => ({ ...r, team: observation.team || r.team }))];

  const addTerritoryObs = async (obs: TerritoryObservationInstance) => {
    return tryFetchExpectOk(async () => API.post({ path: "/territory-observation", body: await encryptObs(customFieldsObs)(obs) }));
  };

  const updateTerritoryObs = async (obs: TerritoryObservationInstance) => {
    return tryFetchExpectOk(async () => API.put({ path: `/territory-observation/${obs._id}`, body: await encryptObs(customFieldsObs)(obs) }));
  };

  const openDeleteConfirmModal = () => {
    setDeleteRencontresChecked(true); // Reset to checked by default when opening
    setIsDeleteConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleteConfirmModalOpen(false);
    setIsDeleting(true);

    // Delete rencontres if user chose to
    if (deleteRencontresChecked && rencontresForObs.length > 0) {
      let rencontreDeleteSuccess = true;
      for (const rencontre of rencontresForObs) {
        const [error] = await tryFetchExpectOk(async () => API.delete({ path: `/rencontre/${rencontre._id}` }));
        if (error) {
          rencontreDeleteSuccess = false;
        }
      }
      if (!rencontreDeleteSuccess) {
        toast.error("Une ou plusieurs rencontres n'ont pas pu être supprimées");
      }
    }

    const [error] = await tryFetchExpectOk(async () => API.delete({ path: `/territory-observation/${observation._id}` }));
    if (error) {
      setIsDeleting(false);
      return;
    }
    await refresh();
    toast.success(deleteRencontresChecked && rencontresForObs.length > 0 ? "Observation et rencontres supprimées" : "Suppression réussie");
    // We do not set isDeleting to false here because the modal will be closed
    // and the onAfterLeave will be called, which will set it to false
    onClose();
  };

  async function handleSubmit() {
    if (!observation.team) return toast.error("L'équipe est obligatoire");
    if (!observation.territory) return toast.error("Le territoire est obligatoire");
    if (observation.observedAt && outOfBoundariesDate(observation.observedAt))
      return toast.error("La date d'observation est hors limites (entre 1900 et 2100)");
    const body: TerritoryObservationInstance = {
      ...(observation ?? {}),
      observedAt: observation.observedAt || dayjsInstance().toDate(),
      team: observation.team,
      user: observation.user || user._id,
      territory: observation.territory,
      organisation: organisation._id,
    };
    for (const customField of customFieldsObs.filter((f) => f).filter((f) => f.enabled || (f.enabledTeams || []).includes(team._id))) {
      body[customField.name] = observation[customField.name];
    }
    setIsSubmitting(true);
    const [error, response] = observation?._id ? await updateTerritoryObs(body) : await addTerritoryObs(body);
    if (!error) {
      if (observation?._id) {
        // When updating an existing observation, synchronize the team of all associated rencontres
        // with the observation's team to maintain consistency
        const rencontresToUpdate = rencontresForObs.filter((r) => r.team !== observation.team);
        let rencontreUpdateSuccess = true;
        for (const r of rencontresToUpdate) {
          const [error] = await tryFetchExpectOk(async () =>
            API.put({
              path: `/rencontre/${r._id}`,
              body: await encryptRencontre({ ...r, team: observation.team }),
            })
          );
          if (error) {
            rencontreUpdateSuccess = false;
          }
        }
        if (!rencontreUpdateSuccess && rencontresToUpdate.length > 0) {
          toast.error("Une ou plusieurs rencontres n'ont pas pu être mises à jour");
        }
      }
      await refresh();
      toast.success(observation?._id ? "Observation mise à jour" : "Création réussie !");
      onClose();
      if (response.data._id && rencontresInProgress.length > 0) {
        let rencontreSuccess = true;
        for (const rencontre of rencontresInProgress) {
          const [error] = await tryFetchExpectOk(async () =>
            API.post({
              path: "/rencontre",
              body: await encryptRencontre({ ...rencontre, observation: response.data._id, team: observation.team }),
            })
          );
          if (error) {
            rencontreSuccess = false;
          }
        }
        if (rencontreSuccess) toast.success("Les rencontres ont également été sauvegardées");
        else toast.error("Une ou plusieurs rencontres n'ont pas pu être sauvegardées");
        await refresh();
      }
    }
    // We do not set isSubmitting to false here because the modal will be closed
    // and the onAfterLeave will be called, which will set it to false
  }

  const handleChange = (event) => {
    const target = event.currentTarget || event.target;
    const { name, value } = target;
    setModalObservation((modalObservation) => ({ ...modalObservation, observation: { ...observation, [name]: value } }));
  };

  return (
    <>
      <ModalHeader title={observation?._id ? "Modifier l'observation" : "Créer une nouvelle observation"} onClose={() => onClose()} />
      <ModalBody>
        <div className="tw-flex tw-h-full tw-w-full tw-flex-col">
          <nav className="noprint tw-flex tw-w-full tw-sticky tw-top-0 tw-bg-white tw-z-10" aria-label="Tabs">
            <ul className={`tw-w-full tw-list-none tw-flex tw-gap-2 tw-px-3 tw-py-2 tw-border-b tw-border-main tw-border-opacity-20`}>
              {fieldsGroupNames.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(name);
                    }}
                    className={[
                      resolvedActiveTab === name ? "tw-bg-main/10 tw-text-black" : "tw-hover:text-gray-700 tw-text-main",
                      "tw-rounded-md tw-px-3 tw-py-2 tw-text-sm tw-font-medium",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {visibleGroupedCustomFieldsObs.length > 1 || name !== "Groupe par défaut" ? name : "Informations"}
                  </button>
                </li>
              ))}
              {organisation.rencontresEnabled && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("_rencontres");
                    }}
                    className={[
                      resolvedActiveTab === "_rencontres" ? "tw-bg-main/10 tw-text-black" : "tw-hover:text-gray-700 tw-text-main",
                      "tw-rounded-md tw-px-3 tw-py-2 tw-text-sm tw-font-medium",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    Rencontres {currentRencontres?.length > 0 ? `(${currentRencontres.length})` : ""}
                  </button>
                </li>
              )}
            </ul>
          </nav>
          <form
            id="add-observation-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <div className="tw-p-4 tw-min-h-[30vh] tw-grow">
              {visibleGroupedCustomFieldsObs.map((group) => (
                <div className="tw-flex tw-flex-row tw-flex-wrap" hidden={group.name !== resolvedActiveTab} key={group.name}>
                  {group.fields.map((field) => (
                    <CustomFieldInput model="observation" values={observation ?? {}} handleChange={handleChange} field={field} key={field.name} />
                  ))}
                </div>
              ))}
              {resolvedActiveTab === "_rencontres" && (
                <>
                  <Table
                    className="Table"
                    noData="Aucune rencontre n'est associée à cette observation"
                    onRowClick={({ key, ...rencontre }) => {
                      setRencontre({
                        user: user._id,
                        team: team._id,
                        ...rencontre,
                      } as RencontreInstance);
                      setIsRencontreModalOpen(true);
                    }}
                    data={currentRencontres.map((r) => ({ ...r, key: r.date + " " + r._id }))}
                    rowKey={"key"}
                    columns={[
                      {
                        title: "Date",
                        dataKey: "date",
                        render: (rencontre) => {
                          return (
                            <>
                              <DateBloc date={rencontre.date} />
                              <TimeBlock time={rencontre.date} />
                            </>
                          );
                        },
                      },
                      {
                        title: "Personne suivie",
                        dataKey: "person",
                        render: (rencontre) =>
                          rencontre.person ? <PersonName item={rencontre} /> : <span className="tw-opacity-30 tw-italic">Anonyme</span>,
                      },
                      {
                        title: "Enregistré par",
                        dataKey: "user",
                        render: (rencontre) => (rencontre.user ? <UserName id={rencontre.user} /> : null),
                      },
                      { title: "Commentaire", dataKey: "comment" },
                      {
                        title: "Rencontré.e par l'équipe",
                        dataKey: "team",
                        render: (rencontre) => <TagTeam teamId={rencontre?.team} />,
                      },
                      {
                        title: "Actions",
                        dataKey: "actions",
                        small: true,
                        render: (rencontre) => {
                          return !rencontre._id ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextRencontres = rencontresInProgress.filter((r) => r.person !== rencontre.person);
                                setModalObservation((modalObservation) => ({
                                  ...modalObservation,
                                  rencontresInProgress: nextRencontres,
                                }));
                              }}
                              className="button-destructive"
                            >
                              Retirer
                            </button>
                          ) : null;
                        },
                      },
                    ]}
                  />
                  <div className="tw-flex tw-justify-center tw-items-center tw-mt-4">
                    <button
                      className="button-submit"
                      type="button"
                      onClick={() => {
                        setIsRencontreModalOpen(true);
                        setRencontre({
                          persons: [],
                          date: observation.observedAt ? observation.observedAt : dayjsInstance().toDate(),
                          user: user._id,
                          team: observation.team || team._id,
                        });
                      }}
                    >
                      + Rencontre
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="tw-p-4 tw-pt-0 tw-sticky tw-bottom-0 tw-bg-white tw-z-10">
              <div className="tw-flex tw-flex-row tw-flex-wrap">
                <div className="tw-flex tw-basis-full tw-flex-col tw-px-4 tw-py-2">
                  <hr />
                </div>
              </div>
              <div className="tw-flex tw-flex-row tw-flex-wrap">
                <div className="tw-flex tw-basis-1/3 tw-flex-col tw-px-4 tw-py-2">
                  <div className="tw-mb-4">
                    <label htmlFor="observation-observedat">Observation faite le</label>
                    <div>
                      <DatePicker
                        withTime
                        id="observation-observedat"
                        name="observedAt"
                        defaultValue={new Date(observation?.observedAt ?? observation?.createdAt)}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>
                <div className="tw-flex tw-basis-1/3 tw-flex-col tw-px-4 tw-py-2">
                  <div className="tw-mb-4">
                    <label htmlFor="observation-select-team">Sous l'équipe</label>
                    <SelectTeam
                      menuPlacement="top"
                      name="team"
                      teams={user.role === "admin" ? teams : user.teams}
                      teamId={observation?.team}
                      onChange={(team) => {
                        setModalObservation((modalObservation) => ({
                          ...modalObservation,
                          observation: { ...observation, team: team._id },
                          rencontresInProgress: modalObservation.rencontresInProgress.map((r) => ({ ...r, team: team._id })),
                        }));
                      }}
                      inputId="observation-select-team"
                      classNamePrefix="observation-select-team"
                    />
                  </div>
                </div>
                <div className="tw-flex tw-basis-1/3 tw-flex-col tw-px-4 tw-py-2">
                  <div className="tw-mb-4">
                    <label htmlFor="observation-select-territory">Territoire</label>
                    <SelectCustom
                      menuPlacement="top"
                      options={territories}
                      name="place"
                      onChange={(territory) => handleChange({ currentTarget: { value: territory?._id, name: "territory" } })}
                      isClearable={false}
                      value={territories.find((i) => i._id === observation?.territory)}
                      getOptionValue={(i) => i._id}
                      getOptionLabel={(i) => i.name}
                      inputId="observation-select-territory"
                      classNamePrefix="observation-select-territory"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </ModalBody>
      <ModalFooter>
        <button className="button-cancel" type="button" onClick={() => onClose()} disabled={isDeleting || isSubmitting}>
          Annuler
        </button>
        {observation?._id ? (
          <button className="button-destructive !tw-ml-0" type="button" onClick={openDeleteConfirmModal} disabled={isDeleting || isSubmitting}>
            {isDeleting ? "Suppression..." : "Supprimer"}
          </button>
        ) : null}
        <button
          title="Sauvegarder cette observation"
          type="button"
          onClick={handleSubmit}
          className="button-submit"
          form="add-observation-form"
          disabled={isDeleting || isSubmitting}
        >
          {isSubmitting ? "Sauvegarde..." : "Sauvegarder"}
        </button>
      </ModalFooter>

      {rencontre && isRencontreModalOpen && (
        <Rencontre
          rencontre={rencontre}
          disableAccessToPerson
          onFinished={() => {
            setRencontre(undefined);
            setIsRencontreModalOpen(false);
          }}
          onSave={
            // Si la rencontre existe déjà, on ne remplace pas le onSave original
            // (ce qui signifie que la sauvegarde sera effective)
            rencontre?._id
              ? undefined
              : (rencontres: Array<RencontreInstance>) => {
                  if (!rencontres.length) return;
                  const nextRencontres = [...rencontresInProgress.filter((r) => !rencontres.map((e) => e.person).includes(r.person)), ...rencontres];
                  setModalObservation((modalObservation) => ({
                    ...modalObservation,
                    rencontresInProgress: nextRencontres,
                  }));
                }
          }
        />
      )}

      <ModalContainer open={isDeleteConfirmModalOpen} onClose={() => setIsDeleteConfirmModalOpen(false)} size="lg">
        <ModalHeader title="Supprimer l'observation" />
        <ModalBody className="tw-py-4">
          <p className="tw-text-center tw-mb-4">Êtes-vous sûr de vouloir supprimer cette observation ?</p>
          {rencontresForObs.length > 0 && (
            <label className="tw-flex tw-items-center tw-justify-center tw-gap-2 tw-cursor-pointer">
              <input
                type="checkbox"
                checked={deleteRencontresChecked}
                onChange={(e) => setDeleteRencontresChecked(e.target.checked)}
                className="tw-w-4 tw-h-4"
              />
              <span>Supprimer les rencontres liées ({rencontresForObs.length})</span>
            </label>
          )}
        </ModalBody>
        <ModalFooter>
          <button type="button" className="button-cancel" onClick={() => setIsDeleteConfirmModalOpen(false)} disabled={isDeleting}>
            Annuler
          </button>
          <button type="button" className="button-destructive" onClick={confirmDelete} disabled={isDeleting}>
            {isDeleting ? "Suppression..." : "Supprimer"}
          </button>
        </ModalFooter>
      </ModalContainer>
    </>
  );
}
