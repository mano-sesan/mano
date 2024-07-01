import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Formik } from "formik";
import SelectUser from "./SelectUser";
import { teamsState, userState } from "../recoil/auth";
import { useRecoilValue } from "recoil";
import API, { tryFetchExpectOk } from "../services/api";
import { encryptPassage } from "../recoil/passages";
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

const Passage = ({ passage, personId, onFinished }) => {
  const user = useRecoilValue(userState);
  const teams = useRecoilValue(teamsState);
  const personsObject = useRecoilValue(personsObjectSelector);
  const [open, setOpen] = useState(false);
  const { refresh } = useDataLoader();

  useEffect(() => {
    setOpen(!!passage);
  }, [passage]);

  const onDeletePassage = async () => {
    const confirm = window.confirm("Êtes-vous sûr ?");
    if (confirm) {
      const [error] = await tryFetchExpectOk(async () => API.delete({ path: `/passage/${passage?._id}` }));
      if (!error) {
        await refresh();
        toast.success("Suppression réussie");
        setOpen(false);
      }
    }
  };

  const isNew = !passage?._id;
  const isForPerson = !!passage?.person;
  const showMultiSelect = isNew && !isForPerson;
  const canEdit = !passage?.user || user._id === passage?.user;

  if (!canEdit) {
    return (
      <ModalContainer open={!!open && !!passage} onClose={() => setOpen(false)} size="3xl" onAfterLeave={onFinished}>
        <ModalHeader onClose={() => setOpen(false)} title={`Passage de ${personsObject[passage.person]?.name}`} />
        <ModalBody className="tw-px-4 tw-py-2">
          <div className="tw-flex tw-w-full tw-flex-col tw-gap-6">
            <div className="tw-my-2 tw-flex tw-gap-8">
              <div className="tw-basis-1/3 [overflow-wrap:anywhere]">
                <div className="tw-text-sm tw-font-semibold tw-text-gray-600">Date</div>
                <div>
                  <CustomFieldDisplay type="date-with-time" value={passage?.date || passage?.createdAt} />
                </div>
              </div>
              <div className="tw-basis-1/3 [overflow-wrap:anywhere]">
                <div className="tw-text-sm tw-font-semibold tw-text-gray-600">Enregistré par</div>
                <UserName id={passage?.user} />
              </div>
              <div className="tw-basis-1/3 [overflow-wrap:anywhere]">
                <div className="tw-text-sm tw-font-semibold tw-text-gray-600">Sous l'équipe</div>
                <div>{teams.find((team) => team._id === passage?.team)?.name}</div>
              </div>
            </div>
            <div className="tw-flex tw-flex-1 tw-flex-col">
              <div className="tw-basis-full [overflow-wrap:anywhere]">
                <div className="tw-text-sm tw-font-semibold tw-text-gray-600">Commentaire</div>
                <div>
                  {passage?.comment ? (
                    <CustomFieldDisplay type="textarea" value={passage?.comment} />
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
          <button type="submit" className="button-submit !tw-bg-main" disabled title="Seul l'auteur/trice du passage peut le modifier">
            Modifier
          </button>
        </ModalFooter>
      </ModalContainer>
    );
  }

  return (
    <ModalContainer open={!!open && !!passage} onClose={() => setOpen(false)} size="3xl" onAfterLeave={onFinished}>
      <ModalHeader onClose={() => setOpen(false)} title={isNew ? "Enregistrer un passage" : "Éditer le passage"} />
      <Formik
        initialValues={{ date: new Date(), ...passage, anonymousNumberOfPassages: 1, persons: passage?.person ? [passage?.person] : [] }}
        onSubmit={async (body, actions) => {
          if (!body.user) return toast.error("L'utilisateur est obligatoire");
          if (!body.date) return toast.error("La date est obligatoire");
          if (outOfBoundariesDate(body.date)) return toast.error("La date est hors limites (entre 1900 et 2100)");
          if (!body.team) return toast.error("L'équipe est obligatoire");
          if (body.anonymous && !body.anonymousNumberOfPassages) return toast.error("Veuillez spécifier le nombre de passages anonymes");
          if (!body.anonymous && (showMultiSelect ? !body.persons?.length : !body.person?.length))
            return toast.error("Veuillez spécifier une personne");

          if (isNew) {
            const newPassage = {
              date: body.date,
              team: body.team,
              user: user._id,
              person: personId,
              comment: body.comment,
            };

            // TODO: traiter les erreurs dans tous ces cas
            if (body.anonymous) {
              for (let i = 0; i < body.anonymousNumberOfPassages; i++) {
                await API.post({
                  path: "/passage",
                  body: await encryptPassage(newPassage),
                });
              }
            } else if (showMultiSelect) {
              for (const person of body.persons) {
                const [passageError] = await tryFetchExpectOk(async () =>
                  API.post({
                    path: "/passage",
                    body: await encryptPassage({ ...newPassage, person }),
                  })
                );
                if (passageError) {
                  toast.error("Erreur lors de l'enregistrement du passage");
                }
              }
            } else {
              const [passageError] = await tryFetchExpectOk(async () =>
                API.post({
                  path: "/passage",
                  body: await encryptPassage({ ...newPassage, person: body.person }),
                })
              );
              if (passageError) {
                toast.error("Erreur lors de l'enregistrement du passage");
              }
            }

            await refresh();
            setOpen(false);
            toast.success(body.person?.length > 1 ? "Passage enregistré !" : "Passages enregistrés !");
            actions.setSubmitting(false);
            return;
          }
          const [error] = await tryFetchExpectOk(async () =>
            API.put({
              path: `/passage/${passage?._id}`,
              body: await encryptPassage(body),
            })
          );
          if (error) {
            toast.error("Erreur lors de la mise à jour du passage");
            actions.setSubmitting(false);
            return;
          }
          await refresh();
          setOpen(false);
          toast.success("Passage mis à jour");
          actions.setSubmitting(false);
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting }) => {
          return (
            <>
              <ModalBody>
                <div className="tw-flex-wrap tw-flex-row tw-w-full tw-flex">
                  {!!isNew && !isForPerson && (
                    <div className="tw-basis-full tw-px-4 tw-py-2">
                      <div className="tw-flex tw-flex-1 tw-flex-col">
                        <label htmlFor="create-anonymous-passages">
                          <input
                            type="checkbox"
                            id="create-anonymous-passages"
                            className="tw-mr-2"
                            name="anonymous"
                            checked={values.anonymous}
                            onChange={() => handleChange({ target: { value: !values.anonymous, name: "anonymous" } })}
                          />
                          Passage(s) anonyme(s) <br />
                          <small className="text-muted">Cochez cette case pour enregistrer plutôt des passages anonymes</small>
                        </label>
                      </div>
                    </div>
                  )}
                  <div className="tw-basis-1/2 tw-px-4 tw-py-2">
                    <label htmlFor="date">Date</label>
                    <div>
                      <DatePicker disabled={!canEdit} withTime id="date" defaultValue={values.date} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="tw-basis-1/2 tw-px-4 tw-py-2">
                    {values.anonymous ? (
                      <>
                        <label htmlFor="number-of-anonymous-passages">Nombre de passages anonymes</label>
                        <input
                          name="anonymousNumberOfPassages"
                          type="number"
                          value={values.anonymousNumberOfPassages}
                          onChange={handleChange}
                          id="number-of-anonymous-passages"
                        />
                      </>
                    ) : showMultiSelect ? (
                      <SelectPerson value={values.persons} onChange={handleChange} isClearable isMulti name="persons" />
                    ) : (
                      <SelectPerson isDisabled={!canEdit} value={values.person} onChange={handleChange} />
                    )}
                  </div>
                  <div className="tw-basis-full tw-px-4 tw-py-2">
                    <label htmlFor="update-passage-comment">Commentaire</label>
                    <div className="tw-rounded tw-border tw-border-gray-300">
                      <AutoResizeTextarea
                        id="update-passage-comment"
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
                    <label htmlFor="update-passage-user-select">Créé par</label>
                    <SelectUser
                      inputId="update-passage-user-select"
                      value={values.user || user._id}
                      isDisabled={!canEdit}
                      onChange={(userId) => handleChange({ target: { value: userId, name: "user" } })}
                    />
                  </div>
                  <div className="tw-basis-1/2 tw-px-4 tw-py-2">
                    <label htmlFor="update-passage-team-select">Sous l'équipe</label>
                    <SelectTeam
                      teams={user.role === "admin" ? teams : user.teams}
                      teamId={values.team}
                      isDisabled={!canEdit}
                      onChange={(team) => handleChange({ target: { value: team._id, name: "team" } })}
                      inputId="update-passage-team-select"
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
                    onClick={onDeletePassage}
                    title="Seul l'auteur/trice du passage peut le supprimer"
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
                  title="Seul l'auteur/trice du passage peut le modifier"
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

export default Passage;
