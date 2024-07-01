import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Formik } from "formik";
import SelectUser from "./SelectUser";
import { currentTeamState, teamsState, userState } from "../recoil/auth";
import { useRecoilValue } from "recoil";
import API, { tryFetchExpectOk } from "../services/api";
import SelectTeam from "./SelectTeam";
import SelectPerson from "./SelectPerson";
import DatePicker from "./DatePicker";
import { outOfBoundariesDate } from "../services/date";
import AutoResizeTextarea from "./AutoresizeTextArea";
import { useDataLoader } from "./DataLoader";
import { ModalContainer, ModalHeader, ModalFooter, ModalBody } from "./tailwind/Modal";
import UserName from "./UserName";
import CustomFieldDisplay from "./CustomFieldDisplay";
import { personsObjectSelector } from "../recoil/selectors";
import { encryptRencontre } from "../recoil/rencontres";

const Rencontre = ({ rencontre, onFinished, onSave = undefined, personId = null, disableAccessToPerson = false }) => {
  const user = useRecoilValue(userState);
  const teams = useRecoilValue(teamsState);
  const personsObject = useRecoilValue(personsObjectSelector);
  const currentTeam = useRecoilValue(currentTeamState);
  const [open, setOpen] = useState(false);
  const { refresh } = useDataLoader();

  useEffect(() => {
    setOpen(!!rencontre);
  }, [rencontre]);

  const onDeleteRencontre = async () => {
    const confirm = window.confirm("Êtes-vous sûr ?");
    if (confirm) {
      const [error] = await tryFetchExpectOk(async () => API.delete({ path: `/rencontre/${rencontre?._id}` }));
      if (!error) {
        await refresh();
        toast.success("Suppression réussie");
        setOpen(false);
      }
    }
  };

  const isNew = !rencontre?._id;
  const isForPerson = !!rencontre?.person;
  const showMultiSelect = isNew && !isForPerson;
  const canEdit = !rencontre?.user || user._id === rencontre?.user;

  if (!canEdit) {
    return (
      <ModalContainer open={!!open && !!rencontre} onClose={() => setOpen(false)} size="3xl" onAfterLeave={onFinished}>
        <ModalHeader onClose={() => setOpen(false)} title={`Rencontre de ${personsObject[rencontre.person]?.name}`} />
        <ModalBody className="tw-px-4 tw-py-2">
          <div className="tw-flex tw-w-full tw-flex-col tw-gap-6">
            <div className="tw-my-2 tw-flex tw-gap-8">
              <div className="tw-basis-1/3 [overflow-wrap:anywhere]">
                <div className="tw-text-sm tw-font-semibold tw-text-gray-600">Date</div>
                <div>
                  <CustomFieldDisplay type="date-with-time" value={rencontre?.date || rencontre?.createdAt} />
                </div>
              </div>
              <div className="tw-basis-1/3 [overflow-wrap:anywhere]">
                <div className="tw-text-sm tw-font-semibold tw-text-gray-600">Enregistré par</div>
                <UserName id={rencontre?.user} />
              </div>
              <div className="tw-basis-1/3 [overflow-wrap:anywhere]">
                <div className="tw-text-sm tw-font-semibold tw-text-gray-600">Sous l'équipe</div>
                <div>{teams.find((team) => team._id === rencontre?.team)?.name}</div>
              </div>
            </div>
            <div className="tw-flex tw-flex-1 tw-flex-col">
              <div className="tw-basis-full [overflow-wrap:anywhere]">
                <div className="tw-text-sm tw-font-semibold tw-text-gray-600">Commentaire</div>
                <div>
                  {rencontre?.comment ? (
                    <CustomFieldDisplay type="textarea" value={rencontre?.comment} />
                  ) : (
                    <p className="tw-italic tw-text-gray-400">Pas de commentaire</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" name="cancel" className="button-cancel" onClick={() => setOpen(false)}>
            Fermer
          </button>
          <button type="submit" className="button-submit !tw-bg-main" disabled title="Seul l'auteur/trice du rencontre peut la modifier">
            Modifier
          </button>
        </ModalFooter>
      </ModalContainer>
    );
  }

  return (
    <ModalContainer open={!!open && !!rencontre} onClose={() => setOpen(false)} size="3xl" onAfterLeave={onFinished}>
      <ModalHeader onClose={() => setOpen(false)} title={isNew ? "Enregistrer un rencontre" : "Éditer le rencontre"} />
      <Formik
        initialValues={{
          date: new Date(),
          ...rencontre,
          anonymousNumberOfRencontres: 1,
          persons: rencontre?.person ? [rencontre.person] : rencontre?.persons ? rencontre?.persons : [],
        }}
        onSubmit={async (body, actions) => {
          if (!body.user) return toast.error("L'utilisateur est obligatoire");
          if (!body.date) return toast.error("La date est obligatoire");
          if (outOfBoundariesDate(body.date)) return toast.error("La date est hors limites (entre 1900 et 2100)");
          if (!body.team) return toast.error("L'équipe est obligatoire");
          if (!body.anonymous && (showMultiSelect ? !body.persons?.length : !body.person?.length))
            return toast.error("Veuillez spécifier une personne");

          if (isNew) {
            const newRencontre = {
              date: body.date,
              team: body.team ?? currentTeam._id,
              user: user._id,
              person: personId,
              comment: body.comment,
            };

            if (onSave) {
              // Sometimes we don't want to actually save the rencontre, but just to get the data.
              // Par exemple quand on veut ajouter une rencontre à une observation pas encore créee.
              onSave(showMultiSelect ? body.persons.map((person) => ({ ...newRencontre, person })) : [newRencontre]);
            } else {
              if (showMultiSelect) {
                for (const person of body.persons) {
                  const [rencontreError] = await tryFetchExpectOk(async () =>
                    API.post({
                      path: "/rencontre",
                      body: await encryptRencontre({ ...newRencontre, person }),
                    })
                  );
                  if (rencontreError) {
                    toast.error("Erreur lors de l'enregistrement de la rencontre");
                  }
                }
              } else {
                const [rencontreError] = await tryFetchExpectOk(async () =>
                  API.post({
                    path: "/rencontre",
                    body: await encryptRencontre({ ...newRencontre, person: body.person }),
                  })
                );
                if (rencontreError) {
                  toast.error("Erreur lors de l'enregistrement de la rencontre");
                }
              }
            }
            await refresh();
            setOpen(false);
            toast.success(body.person.length > 1 ? "Rencontre enregistrée" : "Rencontres enregistrées");
            actions.setSubmitting(false);
            return;
          }
          const [error] = await tryFetchExpectOk(async () =>
            API.put({
              path: `/rencontre/${rencontre._id}`,
              body: await encryptRencontre(body),
            })
          );
          if (error) {
            toast.error("Erreur lors de la mise à jour de la rencontre");
            actions.setSubmitting(false);
            return;
          }
          await refresh();
          setOpen(false);
          toast.success("Rencontre mise à jour");
          actions.setSubmitting(false);
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting }) => {
          return (
            <>
              <ModalBody>
                <div className="tw-flex-wrap tw-flex-row tw-w-full tw-flex">
                  <div className="tw-basis-1/2 tw-px-4 tw-py-2">
                    <label htmlFor="date">Date</label>
                    <div>
                      <DatePicker disabled={!canEdit} withTime id="date" defaultValue={values.date} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="tw-basis-1/2 tw-px-4 tw-py-2">
                    {showMultiSelect ? (
                      <SelectPerson
                        disableAccessToPerson={disableAccessToPerson}
                        value={values.persons}
                        onChange={handleChange}
                        isClearable
                        isMulti
                        name="persons"
                      />
                    ) : (
                      <SelectPerson
                        isDisabled={!canEdit}
                        disableAccessToPerson={disableAccessToPerson}
                        value={values.person}
                        onChange={handleChange}
                      />
                    )}
                  </div>
                  <div className="tw-basis-full tw-px-4 tw-py-2">
                    <label htmlFor="update-rencontre-comment">Commentaire</label>
                    <div className="tw-rounded tw-border tw-border-gray-300">
                      <AutoResizeTextarea
                        id="update-rencontre-comment"
                        name="comment"
                        placeholder="Tapez votre commentaire ici..."
                        value={values.comment}
                        rows={7}
                        onChange={handleChange}
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                  <div className="tw-basis-1/2 tw-px-4 tw-py-2">
                    <label htmlFor="update-rencontre-user-select">Créée par</label>
                    <SelectUser
                      inputId="update-rencontre-user-select"
                      value={values.user || user._id}
                      isDisabled={!canEdit}
                      onChange={(userId) => handleChange({ target: { value: userId, name: "user" } })}
                    />
                  </div>
                  <div className="tw-basis-1/2 tw-px-4 tw-py-2">
                    <label htmlFor="update-rencontre-team-select">Sous l'équipe</label>
                    <SelectTeam
                      teams={user.role === "admin" ? teams : user.teams}
                      teamId={values.team}
                      isDisabled={!canEdit}
                      onChange={(team) => handleChange({ target: { value: team._id, name: "team" } })}
                      inputId="update-rencontre-team-select"
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <button type="button" name="cancel" className="button-cancel" onClick={() => setOpen(false)}>
                  Fermer
                </button>
                {!isNew && (
                  <button
                    type="button"
                    name="delete"
                    className="button-destructive"
                    onClick={onDeleteRencontre}
                    title="Seul l'auteur/trice du rencontre peut le supprimer"
                    disabled={!canEdit}
                  >
                    Supprimer
                  </button>
                )}
                <button
                  type="submit"
                  className="button-submit !tw-bg-main"
                  disabled={!canEdit || isSubmitting}
                  onClick={handleSubmit}
                  title="Seul l'auteur/trice du rencontre peut le modifier"
                >
                  Enregistrer
                </button>
              </ModalFooter>
            </>
          );
        }}
      </Formik>
    </ModalContainer>
  );
};

export default Rencontre;
