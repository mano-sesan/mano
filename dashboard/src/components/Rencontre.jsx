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
import { ModalContainer, ModalHeader, ModalFooter, ModalBody } from "./tailwind/Modal";
import { encryptRencontre } from "../recoil/rencontres";
import SelectAndCreatePerson from "./SelectAndCreatePerson";
import { useDataLoader } from "../services/dataLoader";

const Rencontre = ({ rencontre, onFinished, onSave = undefined, disableAccessToPerson = false }) => {
  const user = useRecoilValue(userState);
  const teams = useRecoilValue(teamsState);
  const currentTeam = useRecoilValue(currentTeamState);
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { refresh } = useDataLoader();

  useEffect(() => {
    setOpen(!!rencontre);
  }, [rencontre]);

  const onDeleteRencontre = async () => {
    setIsDeleting(true);
    const confirm = window.confirm("Êtes-vous sûr ?");
    if (confirm) {
      const [error] = await tryFetchExpectOk(async () => API.delete({ path: `/rencontre/${rencontre?._id}` }));
      if (!error) {
        await refresh();
        toast.success("Suppression réussie");
        setOpen(false);
      }
    }
    setIsDeleting(false);
  };

  const isNew = !rencontre?._id;
  const isForPerson = !!rencontre?.person;
  const showMultiSelect = isNew && !isForPerson;

  return (
    <ModalContainer
      dataTestId="modal-rencontre-create-edit-delete"
      open={!!open && !!rencontre}
      onClose={() => setOpen(false)}
      size="3xl"
      onAfterLeave={onFinished}
    >
      <ModalHeader onClose={() => setOpen(false)} title={isNew ? "Enregistrer une rencontre" : "Éditer la rencontre"} />
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

          const baseRencontre = {
            date: body.date,
            team: body.team ?? currentTeam._id,
            user: user._id,
            comment: body.comment,
          };

          if (onSave) {
            // Sometimes we don't want to actually save the rencontre, but just to get the data
            // For example when adding a rencontre to an observation not yet created
            // Or modifying a rencontre not yet saved in an observation
            const rencontres = isNew
              ? showMultiSelect
                ? body.persons.map((person) => ({ ...baseRencontre, person }))
                : [{ ...baseRencontre, person: body.person }]
              : [{ ...body }];

            onSave(rencontres);
            await refresh();
            setOpen(false);
            return;
          }

          let success = true;

          if (isNew) {
            if (showMultiSelect) {
              for (const person of body.persons) {
                const [error] = await tryFetchExpectOk(async () =>
                  API.post({
                    path: "/rencontre",
                    body: await encryptRencontre({ ...baseRencontre, person }),
                  })
                );
                if (error) success = false;
              }
            } else {
              const [error] = await tryFetchExpectOk(async () =>
                API.post({
                  path: "/rencontre",
                  body: await encryptRencontre({ ...baseRencontre, person: body.person }),
                })
              );
              if (error) success = false;
            }
          } else {
            const [error] = await tryFetchExpectOk(async () =>
              API.put({
                path: `/rencontre/${rencontre._id}`,
                body: await encryptRencontre(body),
              })
            );
            if (error) {
              success = false;
              actions.setSubmitting(false);
            }
          }

          await refresh();
          setOpen(false);

          if (success) {
            toast.success(isNew ? (showMultiSelect ? "Rencontres enregistrées" : "Rencontre enregistrée") : "Rencontre mise à jour");
          } else {
            toast.error(isNew ? "Erreur lors de l'enregistrement de la/des rencontre(s)" : "Erreur lors de la mise à jour de la rencontre");
          }
        }}
      >
        {({ values, handleChange, handleSubmit, isSubmitting }) => {
          const buttonsDisabled = isSubmitting || isDeleting || !open;
          return (
            <>
              <ModalBody>
                <div className="tw-flex-wrap tw-flex-row tw-w-full tw-flex">
                  <div className="tw-basis-1/2 tw-px-4 tw-py-2">
                    <label htmlFor="date">Date</label>
                    <div>
                      <DatePicker withTime id="date" defaultValue={values.date} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="tw-basis-1/2 tw-px-4 tw-py-2">
                    {showMultiSelect ? (
                      <>
                        <label htmlFor="person">Personnes(s) suivie(s)</label>
                        <SelectAndCreatePerson value={values.persons} onChange={handleChange} />
                      </>
                    ) : (
                      <SelectPerson disableAccessToPerson={disableAccessToPerson} value={values.person} onChange={handleChange} />
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
                      />
                    </div>
                  </div>
                  <div className="tw-basis-1/2 tw-px-4 tw-py-2">
                    <label htmlFor="update-rencontre-user-select">Créée par</label>
                    <SelectUser
                      inputId="update-rencontre-user-select"
                      value={values.user || user._id}
                      onChange={(userId) => handleChange({ target: { value: userId, name: "user" } })}
                    />
                  </div>
                  <div className="tw-basis-1/2 tw-px-4 tw-py-2">
                    <label htmlFor="update-rencontre-team-select">Sous l'équipe</label>
                    <SelectTeam
                      teams={user.role === "admin" ? teams : user.teams}
                      teamId={values.team}
                      onChange={(team) => handleChange({ target: { value: team._id, name: "team" } })}
                      inputId="update-rencontre-team-select"
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <button type="button" name="cancel" disabled={buttonsDisabled} className="button-cancel" onClick={() => setOpen(false)}>
                  Fermer
                </button>
                {!isNew && (
                  <button
                    type="button"
                    name="delete"
                    className="button-destructive"
                    onClick={onDeleteRencontre}
                    disabled={buttonsDisabled}
                    title="Seul l'auteur/trice du rencontre peut le supprimer"
                  >
                    {isDeleting ? "Suppression en cours..." : "Supprimer"}
                  </button>
                )}
                <button
                  type="submit"
                  className="button-submit !tw-bg-main"
                  disabled={buttonsDisabled}
                  onClick={handleSubmit}
                  title="Seul l'auteur/trice du rencontre peut le modifier"
                >
                  {isSubmitting ? "Enregistrement en cours..." : "Enregistrer"}
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
