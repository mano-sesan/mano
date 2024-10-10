import React, { useEffect, useMemo, useState } from "react";

import { useParams, useHistory } from "react-router-dom";
import { Formik } from "formik";
import { toast } from "react-toastify";

import Loading from "../../components/loading";
import ButtonCustom from "../../components/ButtonCustom";
import NightSessionModale from "../../components/NightSessionModale";
import { currentTeamState, organisationState, teamsState, userState } from "../../recoil/auth";
import API, { tryFetch, tryFetchExpectOk } from "../../services/api";
import { useRecoilState, useRecoilValue } from "recoil";
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
import { useDataLoader } from "../../components/DataLoader";
import { cleanHistory } from "../../utils/person-history";

const View = () => {
  const [team, setTeam] = useState(null);
  const { id } = useParams();
  const history = useHistory();

  const user = useRecoilValue(userState);
  const organisation = useRecoilValue(organisationState);
  const actions = useRecoilValue(actionsState);
  const consultations = useRecoilValue(consultationsState);
  const comments = useRecoilValue(commentsState);
  const observations = useRecoilValue(territoryObservationsState);
  const persons = useRecoilValue(personsState);
  const passages = useRecoilValue(passagesState);
  const rencontres = useRecoilValue(rencontresState);
  const reports = useRecoilValue(reportsState);
  const customFieldsObs = useRecoilValue(customFieldsObsSelector);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSelectedTeam, setTransferSelectedTeam] = useState(null);
  const { encryptPerson } = usePreparePersonForEncryption();
  const { refresh } = useDataLoader();

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

  const [currentTeam, setCurrentTeam] = useRecoilState(currentTeamState);
  const [teams, setTeams] = useRecoilState(teamsState);

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
              onClick={async () => {
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

                if (text && !confirm(text)) return;

                const actionsToUpdate = actionsInTeam.map((a) => ({ ...a, teams: a.teams.filter((t) => t !== id).concat(transferSelectedTeam) }));
                const consultationsToUpdate = consultationsInTeam.map((c) => ({
                  ...c,
                  teams: c.teams.filter((t) => t !== id).concat(transferSelectedTeam),
                }));
                const commentsToUpdate = commentsInTeam.map((c) => ({ ...c, team: transferSelectedTeam }));
                const observationsToUpdate = observationsInTeam.map((o) => ({ ...o, team: transferSelectedTeam }));
                const personsToUpdate = personsInTeam.map((p) => ({
                  ...p,
                  assignedTeams: p.assignedTeams.filter((t) => t !== id).concat(transferSelectedTeam),
                  history: [
                    ...(cleanHistory(p.history) || []),
                    {
                      date: new Date(),
                      user: user._id,
                      data: {
                        assignedTeams: {
                          oldValue: p.assignedTeams,
                          newValue: p.assignedTeams.filter((t) => t !== id).concat(transferSelectedTeam),
                        },
                      },
                    },
                  ],
                }));
                const passagesToUpdate = passagesInTeam.map((p) => ({ ...p, team: transferSelectedTeam }));
                const rencontresToUpdate = rencontresInTeam.map((r) => ({ ...r, team: transferSelectedTeam }));
                const reportsToUpdate = reportsInTeam.map((r) => ({ ...r, team: transferSelectedTeam }));
                const [transferTeamError] = await tryFetchExpectOk(async () =>
                  API.post({
                    path: `/transfer-team`,
                    body: {
                      actionsToUpdate: await Promise.all(actionsToUpdate.map(encryptAction)),
                      consultationsToUpdate: await Promise.all(consultationsToUpdate.map(encryptConsultation(organisation.consultations))),
                      commentsToUpdate: await Promise.all(commentsToUpdate.map(encryptComment)),
                      observationsToUpdate: await Promise.all(observationsToUpdate.map(encryptObs(customFieldsObs))),
                      personsToUpdate: await Promise.all(personsToUpdate.map(encryptPerson)),
                      passagesToUpdate: await Promise.all(passagesToUpdate.map(encryptPassage)),
                      rencontresToUpdate: await Promise.all(rencontresToUpdate.map(encryptRencontre)),
                      reportsToUpdate: await Promise.all(reportsToUpdate.map(encryptReport)),
                      teamToDeleteId: id,
                      targetTeamId: transferSelectedTeam,
                    },
                  })
                );
                if (transferTeamError) return toast.error(errorMessage(transferTeamError));
                setTeams(teams.filter((t) => t._id !== id));
                refresh();
                setIsTransferModalOpen(false);
                toast.success("Données transférées avec succès");
                history.goBack();
              }}
            >
              Transférer
            </button>
          </div>
        </ModalFooter>
      </ModalContainer>
    </>
  );
};

export default View;
