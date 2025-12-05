import React, { useEffect, useMemo, useState } from "react";

import { useParams, useHistory } from "react-router-dom";
import { Formik } from "formik";
import { toast } from "react-toastify";

import Loading from "../../components/loading";
import ButtonCustom from "../../components/ButtonCustom";
import NightSessionModale from "../../components/NightSessionModale";
import { currentTeamState, organisationState, teamsState, userState } from "../../recoil/auth";
import API, { tryFetch, tryFetchExpectOk } from "../../services/api";
import { useAtom, useAtomValue } from "jotai";
import useTitle from "../../services/useTitle";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";
import { actionsState, encryptAction } from "../../recoil/actions";
import { consultationsState, encryptConsultation } from "../../recoil/consultations";
import { commentsState, encryptComment } from "../../recoil/comments";
import { customFieldsObsSelector, encryptObs, territoryObservationsState } from "../../recoil/territoryObservations";
import { personsState, usePreparePersonForEncryption } from "../../recoil/persons";
import { encryptPassage, passagesState } from "../../recoil/passages";
import { encryptRencontre, rencontresState } from "../../recoil/rencontres";
import BackButton from "../../components/backButton";
import { errorMessage } from "../../utils";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../../components/tailwind/Modal";
import SelectTeam from "../../components/SelectTeam";
import { encryptReport, reportsState } from "../../recoil/reports";
import { useDataLoader } from "../../services/dataLoader";
import { cleanHistory } from "../../utils/person-history";
import ConfirmModal from "../../components/ConfirmModal";

const View = () => {
  const [team, setTeam] = useState(null);
  const { id } = useParams();
  const history = useHistory();

  const user = useAtomValue(userState);
  const organisation = useAtomValue(organisationState);
  const actions = useAtomValue(actionsState);
  const consultations = useAtomValue(consultationsState);
  const comments = useAtomValue(commentsState);
  const observations = useAtomValue(territoryObservationsState);
  const persons = useAtomValue(personsState);
  const passages = useAtomValue(passagesState);
  const rencontres = useAtomValue(rencontresState);
  const reports = useAtomValue(reportsState);
  const customFieldsObs = useAtomValue(customFieldsObsSelector);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSelectedTeam, setTransferSelectedTeam] = useState(null);
  const { encryptPerson } = usePreparePersonForEncryption();
  const { refresh } = useDataLoader();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const cantDeleteMessage = useMemo(() => {
    const actionsInTeam = actions.filter((a) => a.teams?.includes(id));
    const consultationsInTeam = consultations.filter((c) => c.teams?.includes(id));
    const commentsInTeam = comments.filter((c) => c.team === id);
    const observationsInTeam = observations.filter((o) => o.team === id);
    const personsInTeam = persons.filter((p) => p.assignedTeams?.includes(id));
    const passagesInTeam = passages.filter((p) => p.team === id);
    const rencontresInTeam = rencontres.filter((r) => r.team === id);
    const reportsInTeam = reports.filter((r) => r.team === id);
    let items = [];
    if (actionsInTeam.length) items.push(`${actionsInTeam.length} actions`);
    if (consultationsInTeam.length) items.push(`${consultationsInTeam.length} consultations`);
    if (commentsInTeam.length) items.push(`${commentsInTeam.length} commentaires`);
    if (observationsInTeam.length) items.push(`${observationsInTeam.length} observations`);
    if (personsInTeam.length) items.push(`${personsInTeam.length} personnes`);
    if (passagesInTeam.length) items.push(`${passagesInTeam.length} passages`);
    if (rencontresInTeam.length) items.push(`${rencontresInTeam.length} rencontres`);
    if (reportsInTeam.length) items.push(`${reportsInTeam.length} rapports`);
    return items.length ? `Vous ne pouvez pas supprimer cette équipe, vous avez ${items.join(", ")} qui y sont liées.` : null;
  }, [actions, consultations, comments, observations, persons, passages, rencontres, reports, id]);

  useTitle(`Équipes ${team?.name}`);

  const [currentTeam, setCurrentTeam] = useAtom(currentTeamState);
  const [teams, setTeams] = useAtom(teamsState);

  const getTeam = async () => {
    const [error, response] = await tryFetchExpectOk(async () => API.get({ path: `/team/${id}` }));
    if (error) {
      toast.error(errorMessage(error));
      history.push("/team");
      return;
    }
    setTeam(response.data);
  };

  useEffect(() => {
    getTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!team) return <Loading />;

  return (
    <>
      <div className="tw-my-8">
        <BackButton />
      </div>
      <Formik
        initialValues={team}
        enableReinitialize
        onSubmit={async (body) => {
          const [error, response] = await tryFetchExpectOk(async () => API.put({ path: `/team/${team._id}`, body }));
          if (error) return toast.error(errorMessage(error));
          if (!error) {
            toast.success("Mise à jour !");
            setTeams(
              teams.map((t) => {
                if (t._id !== id) return t;
                return response.data;
              })
            );
            if (currentTeam._id === id) setCurrentTeam(response.data);
          }
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting }) => (
          <React.Fragment>
            <div className="tw-flex tw-flex-col tw-gap-4">
              <div className="tw-max-w-96">
                <label htmlFor="name" className="tw-m-0">
                  Nom
                </label>
                <input className="tailwindui" autoComplete="off" name="name" id="name" value={values.name} onChange={handleChange} />
              </div>
              <div className="tw-flex tw-items-baseline tw-gap-2">
                <input type="checkbox" name="nightSession" id="nightSession" checked={values.nightSession} onChange={handleChange} />
                <label htmlFor="nightSession">Équipe de nuit</label>
                <NightSessionModale />
              </div>
            </div>
            <div className="tw-flex tw-justify-end">
              <button
                className="button-classic"
                onClick={() => {
                  setIsTransferModalOpen(true);
                }}
              >
                Transférer les données vers une autre équipe
              </button>
              {cantDeleteMessage ? (
                <button
                  className="button-destructive"
                  onClick={() => {
                    toast.error(cantDeleteMessage);
                  }}
                >
                  Supprimer
                </button>
              ) : (
                <DeleteButtonAndConfirmModal
                  title={`Voulez-vous vraiment supprimer l'équipe ${team.name}`}
                  textToConfirm={team.name}
                  // disabled={teams.length === 1}
                  // disabledTitle="Vous ne pouvez pas supprimer la dernière équipe"
                  onConfirm={async () => {
                    const [error] = await tryFetch(async () => await API.delete({ path: `/team/${id}` }));
                    if (error) {
                      return toast.error(errorMessage(error));
                    }
                    setTeams(teams.filter((t) => t._id !== id));
                    toast.success("Suppression réussie");
                    history.goBack();
                  }}
                >
                  <span className="tw-mb-8 tw-block tw-w-full tw-text-center">
                    Cette opération est irréversible
                    <br />
                  </span>
                </DeleteButtonAndConfirmModal>
              )}
              <div className="tw-ml-3">
                <ButtonCustom type="submit" title={"Mettre à jour"} loading={isSubmitting} onClick={handleSubmit} />
              </div>
            </div>
          </React.Fragment>
        )}
      </Formik>
      <ModalContainer
        open={isTransferModalOpen}
        size="lg"
        onAfterLeave={() => {
          setTransferSelectedTeam(undefined);
        }}
      >
        <ModalHeader
          title="Transférer les données de l'équipe"
          onClose={() => {
            setIsTransferModalOpen(false);
          }}
        />
        <ModalBody>
          <div className="tw-p-4">
            <div className="tw-mb-2">
              Choisisser l'équipe vers laquelle vous souhaitez transférer les données de l'équipe <b>{team.name}</b>
            </div>
            <SelectTeam
              name="team"
              teams={teams.filter((t) => t._id !== id)}
              teamId={transferSelectedTeam}
              onChange={(team) => setTransferSelectedTeam(team._id)}
              inputId="transfer-data-selected-team"
              classNamePrefix="transfer-data-selected-team"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <div>
            <button
              className="button-destructive"
              onClick={() => {
                setIsTransferModalOpen(false);
              }}
            >
              Annuler
            </button>
            <button
              className="button-submit"
              onClick={() => {
                const actionsInTeam = actions.filter((a) => a.teams?.includes(id));
                const consultationsInTeam = consultations.filter((c) => c.teams?.includes(id));
                const commentsInTeam = comments.filter((c) => c.team === id);
                const observationsInTeam = observations.filter((o) => o.team === id);
                const personsInTeam = persons.filter((p) => p.assignedTeams?.includes(id));
                const passagesInTeam = passages.filter((p) => p.team === id);
                const rencontresInTeam = rencontres.filter((r) => r.team === id);
                const reportsInTeam = reports.filter((r) => r.team === id);

                let items = [];
                if (actionsInTeam.length) items.push(`${actionsInTeam.length} actions`);
                if (consultationsInTeam.length) items.push(`${consultationsInTeam.length} consultations`);
                if (commentsInTeam.length) items.push(`${commentsInTeam.length} commentaires`);
                if (observationsInTeam.length) items.push(`${observationsInTeam.length} observations`);
                if (personsInTeam.length) items.push(`${personsInTeam.length} personnes`);
                if (passagesInTeam.length) items.push(`${passagesInTeam.length} passages`);
                if (rencontresInTeam.length) items.push(`${rencontresInTeam.length} rencontres`);
                if (reportsInTeam.length) items.push(`${reportsInTeam.length} rapports`);
                const text = items.length
                  ? `Voulez-vous transférer ${items.join(", ")} dans l'équipe ${teams.find((t) => t._id === transferSelectedTeam)?.name} et supprimer l'équipe ${team.name}.`
                  : null;

                if (!text || !confirm(text)) return;
                setIsConfirmModalOpen(true);
              }}
            >
              Transférer
            </button>
          </div>
        </ModalFooter>
      </ModalContainer>

      <ConfirmModal
        open={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={`Confirmer le transfert vers ${teams.find((t) => t._id === transferSelectedTeam)?.name}`}
        textToConfirm={teams.find((t) => t._id === transferSelectedTeam)?.name || ""}
        buttonText="Transférer"
        onConfirm={async () => {
          const actionsInTeam = actions.filter((a) => a.teams?.includes(id));
          const consultationsInTeam = consultations.filter((c) => c.teams?.includes(id));
          const commentsInTeam = comments.filter((c) => c.team === id);
          const observationsInTeam = observations.filter((o) => o.team === id);
          const personsInTeam = persons.filter((p) => p.assignedTeams?.includes(id));
          const passagesInTeam = passages.filter((p) => p.team === id);
          const rencontresInTeam = rencontres.filter((r) => r.team === id);
          const reportsInTeam = reports.filter((r) => r.team === id);
          const reportsInTargetTeam = reports.filter((r) => r.team === transferSelectedTeam);

          const actionsToUpdate = actionsInTeam.map((a) => ({
            ...a,
            teams: Array.from(new Set([...a.teams.filter((t) => t !== id), transferSelectedTeam])),
          }));
          const consultationsToUpdate = consultationsInTeam.map((c) => ({
            ...c,
            teams: Array.from(new Set([...c.teams.filter((t) => t !== id), transferSelectedTeam])),
          }));
          const commentsToUpdate = commentsInTeam.map((c) => ({ ...c, team: transferSelectedTeam }));
          const observationsToUpdate = observationsInTeam.map((o) => ({ ...o, team: transferSelectedTeam }));
          const personsToUpdate = personsInTeam.map((p) => {
            const newAssignedTeams = Array.from(new Set([...p.assignedTeams.filter((t) => t !== id), transferSelectedTeam]));
            return {
              ...p,
              assignedTeams: newAssignedTeams,
              history: [
                ...(cleanHistory(p.history) || []),
                {
                  date: new Date(),
                  user: user._id,
                  data: {
                    assignedTeams: {
                      oldValue: p.assignedTeams,
                      newValue: newAssignedTeams,
                    },
                  },
                },
              ],
            };
          });
          const passagesToUpdate = passagesInTeam.map((p) => ({ ...p, team: transferSelectedTeam }));
          const rencontresToUpdate = rencontresInTeam.map((r) => ({ ...r, team: transferSelectedTeam }));

          // Fusion des rapports : quand deux rapports ont la même date, on met à jour pour mettre la description à la suite, ainsi que les collaborations
          // debugger;
          const reportsInTargetTeamToUpdate = reportsInTeam
            .filter((r) => reportsInTargetTeam.find((rt) => rt.date === r.date))
            .map((r) => {
              const reportInTargetTeam = reportsInTargetTeam.find((rt) => rt.date === r.date);
              return {
                ...reportInTargetTeam,
                description: `${reportInTargetTeam.description}\n\n${r.description}`,
                collaborations: Array.from(new Set((reportInTargetTeam.collaborations || []).concat(r.collaborations || []))),
              };
            });

          const reportsToUpdate = reportsInTeam
            .filter((r) => !reportsInTargetTeam.find((rt) => rt.date === r.date))
            .map((r) => ({ ...r, team: transferSelectedTeam }));
          // return;
          const [transferTeamError] = await tryFetchExpectOk(async () =>
            API.post({
              path: `/transfer-team`,
              body: {
                actionsToUpdate: await Promise.all(actionsToUpdate.map((action) => encryptAction(action, { checkRequiredFields: false }))),
                consultationsToUpdate: await Promise.all(
                  consultationsToUpdate.map((consultation) =>
                    encryptConsultation(organisation.consultations)(consultation, { checkRequiredFields: false })
                  )
                ),
                commentsToUpdate: await Promise.all(commentsToUpdate.map((comment) => encryptComment(comment, { checkRequiredFields: false }))),
                observationsToUpdate: await Promise.all(
                  observationsToUpdate.map((observation) => encryptObs(customFieldsObs)(observation, { checkRequiredFields: false }))
                ),
                personsToUpdate: await Promise.all(personsToUpdate.map((person) => encryptPerson(person, { checkRequiredFields: false }))),
                passagesToUpdate: await Promise.all(passagesToUpdate.map((passage) => encryptPassage(passage, { checkRequiredFields: false }))),
                rencontresToUpdate: await Promise.all(
                  rencontresToUpdate.map((rencontre) => encryptRencontre(rencontre, { checkRequiredFields: false }))
                ),
                reportsToUpdate: await Promise.all(reportsToUpdate.map((report) => encryptReport(report, { checkRequiredFields: false }))),
                reportsInTargetTeamToUpdate: await Promise.all(
                  reportsInTargetTeamToUpdate.map((report) => encryptReport(report, { checkRequiredFields: false }))
                ),
                teamToDeleteId: id,
                targetTeamId: transferSelectedTeam,
              },
            })
          );
          if (transferTeamError) return toast.error(errorMessage(transferTeamError));
          setTeams(teams.filter((t) => t._id !== id));
          refresh();
          toast.success("Données transférées avec succès");
          history.goBack();
        }}
      >
        <div className="tw-text-center  tw-w-full">
          <p>
            Cette action est <u>irréversible</u>
          </p>
          <ul className="tw-list-disc tw-list-inside">
            <li>
              Équipe source : <b>{team.name}</b> (l'équipe <b>{team.name}</b> sera <u>supprimée</u>)
            </li>
            <li>
              Équipe de destination : <b>{teams.find((t) => t._id === transferSelectedTeam)?.name}</b>
            </li>
          </ul>
          <p>Pour confirmer, veuillez saisir le nom de l'équipe de destination.</p>
        </div>
      </ConfirmModal>
    </>
  );
};

export default View;
