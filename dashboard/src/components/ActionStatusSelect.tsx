import { useHistory } from "react-router-dom";
import { useStore, defaultModalActionState } from "../store";
import { DONE, TODO, CANCEL, encryptAction } from "../recoil/actions";
import API, { tryFetchExpectOk } from "../services/api";
import { now } from "../services/date";
import { toast } from "react-toastify";
import { encryptConsultation } from "../recoil/consultations";
import { ConsultationInstance } from "../types/consultation";
import { ActionInstance, ActionStatus } from "../types/action";
import { useDataLoader } from "../services/dataLoader";
import { encryptComment } from "../recoil/comments";
import { decryptItem } from "../services/encryption";

function isConsultation(action: ActionInstance | ConsultationInstance): action is ConsultationInstance {
  return action.isConsultation !== undefined && action.isConsultation;
}

export default function ActionStatusSelect({ action }: { action: ActionInstance | ConsultationInstance }) {
  const organisation = useStore((state) => state.organisation);
  const setModalConfirmState = useStore((state) => state.setModalConfirm);
  const setModalAction = useStore((state) => state.setModalAction);
  const currentTeam = useStore((state) => state.currentTeam);
  const user = useStore((state) => state.user);
  const { refresh } = useDataLoader();
  const history = useHistory();

  if (!organisation || !user) return null;

  const disabled = isConsultation(action) && !user.healthcareProfessional;

  if (disabled) {
    return (
      <div
        className={`tw-cursor-not-allowed tw-appearance-none tw-rounded tw-border-none tw-px-2 tw-transition hover:tw-scale-105 ${
          action.status === DONE ? "tw-bg-green-700" : action.status === TODO ? "tw-bg-red-700" : "tw-bg-cyan-700"
        } tw-text-center tw-text-[11px] tw-font-bold tw-text-white tw-outline-none tw-w-fit`}
      >
        {action.status === TODO ? "À faire" : action.status === DONE ? "Fait" : "Annulé"}
      </div>
    );
  }

  return (
    <select
      className={`tw-cursor-pointer tw-appearance-none tw-rounded tw-border-none tw-px-2 tw-transition hover:tw-scale-105 ${
        action.status === DONE ? "tw-bg-green-700" : action.status === TODO ? "tw-bg-red-700" : "tw-bg-cyan-700"
      } tw-text-center tw-text-[11px] tw-font-bold tw-text-white tw-outline-none`}
      value={action.status}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onChange={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const status = e.target.value as ActionStatus;
        const completedAt = status === TODO ? null : action.completedAt || now();
        const updatedUser = action.user || user._id;
        const historyEntry = {
          date: new Date(),
          user: user._id,
          data: {
            status: { oldValue: action.status, newValue: status },
            completedAt: { oldValue: action.completedAt, newValue: completedAt },
          },
        };
        const updatedHistory = [...(action.history || []), historyEntry];

        if (isConsultation(action)) {
          const consultation = action;
          const [error] = await tryFetchExpectOk(async () =>
            API.put({
              path: `/consultation/${consultation._id}`,
              body: await encryptConsultation(organisation.consultations)({
                ...consultation,
                status,
                completedAt,
                user: updatedUser,
                history: updatedHistory,
              }),
            })
          );
          if (error) {
            toast.error("Erreur lors de la mise à jour de la consultation");
            return;
          }
          await refresh();
          toast.success("Le statut de la consultation a été mis à jour");

          const consultationCancelled = action.status !== CANCEL && status === CANCEL;

          if (consultationCancelled) {
            setModalConfirmState({
              open: true,
              options: {
                title: "Cette consulation est annulée, voulez-vous la dupliquer ?",
                subTitle: "Avec une date ultérieure par exemple",
                buttons: [
                  {
                    text: "Non merci !",
                    className: "button-cancel",
                  },
                  {
                    text: "Oui",
                    className: "button-submit",
                    onClick: async () => {
                      const [consultationError, consultationReponse] = await tryFetchExpectOk(async () =>
                        API.post({
                          path: "/consultation",
                          body: await encryptConsultation(organisation.consultations)({
                            ...consultation,
                            _id: undefined,
                            completedAt: null,
                            history: [],
                            status: TODO,
                            user: user._id,
                            teams: [currentTeam._id],
                          }),
                        })
                      );
                      if (consultationError) {
                        toast.error("Erreur lors de la duplication de la consultation, les données n'ont pas été sauvegardées.");
                        return;
                      }
                      await refresh();
                      const searchParams = new URLSearchParams(history.location.search);
                      searchParams.set("consultationId", consultationReponse.data._id);
                      searchParams.set("isEditing", "true");
                      history.replace(`?${searchParams.toString()}`);
                    },
                  },
                ],
              },
            });
          }
        } else {
          const [error] = await tryFetchExpectOk(async () =>
            API.put({
              path: `/action/${action._id}`,
              body: await encryptAction({
                ...action,
                status,
                completedAt,
                user: updatedUser,
                history: updatedHistory,
              }),
            })
          );
          if (error) {
            toast.error("Erreur lors de la mise à jour de l'action");
            return;
          }
          await refresh();
          toast.success("Le statut de l'action a été mis à jour");

          const actionCancelled = action.status !== CANCEL && status === CANCEL;

          if (actionCancelled) {
            const { name, person, dueAt, withTime, description, categories, urgent, teams } = action;
            const comments = action.comments.filter((c) => c.action === action._id);
            setModalConfirmState({
              open: true,
              options: {
                title: "Cette action est annulée, voulez-vous la dupliquer ?",
                subTitle: "Avec une date ultérieure par exemple",
                buttons: [
                  {
                    text: "Non merci !",
                    className: "button-cancel",
                  },
                  {
                    text: "Oui",
                    className: "button-submit",
                    onClick: async () => {
                      const [actionError, actionReponse] = await tryFetchExpectOk(async () =>
                        API.post({
                          path: "/action",
                          body: await encryptAction({
                            name: name.trim(),
                            person,
                            teams,
                            user: user._id,
                            dueAt,
                            withTime,
                            status: TODO,
                            description,
                            categories,
                            urgent,
                          } as ActionInstance),
                        })
                      );
                      if (actionError) {
                        toast.error("Erreur lors de la duplication de l'action, les données n'ont pas été sauvegardées.");
                        return;
                      }
                      for (const c of comments) {
                        const body = {
                          comment: c.comment,
                          action: actionReponse.data._id,
                          user: c.user || user._id,
                          team: c.team || currentTeam._id,
                          organisation: c.organisation,
                        };
                        const [error] = await tryFetchExpectOk(async () => API.post({ path: "/comment", body: await encryptComment(body) }));
                        if (error) {
                          toast.error("Erreur lors de la duplication des commentaires de l'action, les données n'ont pas été sauvegardées.");
                          return;
                        }
                      }
                      await refresh();
                      const decryptedAction = await decryptItem(actionReponse.data);
                      setModalAction({
                        ...defaultModalActionState(),
                        open: true,
                        from: location.pathname,
                        isForMultiplePerson: false,
                        isEditing: true,
                        action: { ...decryptedAction, comments: comments.map((c) => ({ ...c, action: decryptedAction._id })) },
                      });
                    },
                  },
                ],
              },
            });
          }
        }
      }}
    >
      <option value={TODO}>À faire</option>
      <option value={DONE}>Fait</option>
      <option value={CANCEL}>Annulé</option>
    </select>
  );
}
