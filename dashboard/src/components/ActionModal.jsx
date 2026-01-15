import { useState, useMemo, Fragment } from "react";
import isEqual from "react-fast-compare";
import DatePicker from "./DatePicker";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import { CANCEL, DONE, TODO } from "../atoms/actions";
import { currentTeamState, organisationState, teamsState, userState } from "../atoms/auth";
import { allowedActionFieldsInHistory, encryptAction } from "../atoms/actions";
import API, { tryFetchExpectOk } from "../services/api";
import { dayjsInstance, outOfBoundariesDate } from "../services/date";
import { modalConfirmState } from "./ModalConfirm";
import SelectStatus from "./SelectStatus";
import { ModalContainer, ModalBody, ModalFooter, ModalHeader } from "./tailwind/Modal";
import SelectPerson from "./SelectPerson";
import { CommentsModule } from "./CommentsGeneric";
import SelectTeamMultiple from "./SelectTeamMultiple";
import UserName from "./UserName";
import PersonName from "./PersonName";
import TagTeam from "./TagTeam";
import CustomFieldDisplay from "./CustomFieldDisplay";
import { itemsGroupedByActionSelector, itemsGroupedByPersonSelector } from "../atoms/selectors";
import DocumentsListSimple from "./document/DocumentsListSimple";
import TabsNav from "./tailwind/TabsNav";
import ActionsCategorySelect from "./tailwind/ActionsCategorySelect";
import AutoResizeTextarea from "./AutoresizeTextArea";
import { groupsState } from "../atoms/groups";
import { encryptComment } from "../atoms/comments";
import { defaultModalActionState, modalActionState } from "../atoms/modal";
import { decryptItem } from "../services/encryption";
import Recurrence from "./Recurrence";
import { getNthWeekdayInMonth, getOccurrences, recurrenceAsText } from "../utils/recurrence";
import { Menu, Transition } from "@headlessui/react";
import RepeatIcon from "../assets/icons/RepeatIcon";
import { recurrencesState } from "../atoms/recurrences";
import ActionStatusSelect from "./ActionStatusSelect";
import DateBloc from "./DateBloc";
import ActionsSortableList from "./ActionsSortableList";
import { useDataLoader } from "../services/dataLoader";
import { isEmptyValue } from "../utils";

export default function ActionModal() {
  const [modalAction, setModalAction] = useAtom(modalActionState);
  const [resetAfterLeave, setResetAfterLeave] = useState(false);
  const location = useLocation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const open = modalAction.open && location.pathname === modalAction.from;

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
          setModalAction({ open: false });
        }
      }}
    >
      {modalAction.action ? (
        <ActionContent
          key={open}
          isMulti={modalAction.isForMultiplePerson}
          isSubmitting={isSubmitting}
          setIsSubmitting={setIsSubmitting}
          isDeleting={isDeleting}
          setIsDeleting={setIsDeleting}
          onClose={() => {
            setResetAfterLeave(true);
            setModalAction((modalAction) => ({ ...modalAction, open: false }));
          }}
        />
      ) : null}
    </ModalContainer>
  );
}

function ActionContent({ onClose, isMulti = false, isSubmitting, setIsSubmitting, isDeleting, setIsDeleting }) {
  const location = useLocation();
  const actionsObjects = useAtomValue(itemsGroupedByActionSelector);
  const [modalAction, setModalAction] = useAtom(modalActionState);
  const teams = useAtomValue(teamsState);
  const user = useAtomValue(userState);
  const recurrences = useAtomValue(recurrencesState);
  const organisation = useAtomValue(organisationState);
  const currentTeam = useAtomValue(currentTeamState);
  const setModalConfirmState = useSetAtom(modalConfirmState);
  const groups = useAtomValue(groupsState);
  const { refresh } = useDataLoader();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isEditing = modalAction.isEditing;

  const action = useMemo(
    () => ({
      documents: [],
      comments: [],
      history: [],
      teams: modalAction.action?.teams ?? modalAction.action?.teams?.length === 1 ? [teams?.[0]._id] : [],
      dueAt: new Date(),
      isRecurrent: modalAction.action?.recurrence ? true : false,
      recurrenceData: modalAction.action?.recurrence ? recurrences.find((e) => e._id === modalAction.action?.recurrence) || {} : {},
      ...modalAction.action,
    }),
    [modalAction.action, teams, recurrences]
  );

  const initialExistingAction = action._id ? actionsObjects[action._id] : undefined;
  const isNewAction = !initialExistingAction;

  const [activeTab, setActiveTab] = useState("Informations");
  const isOnePerson = typeof action?.person === "string" || action?.person?.length === 1;
  const onlyPerson = !isOnePerson ? null : typeof action?.person === "string" ? action.person : action.person?.[0];
  const canToggleGroupCheck = !!organisation.groupsEnabled && !!onlyPerson && groups.find((group) => group.persons?.includes(onlyPerson));

  async function handleSubmit({ newData = {}, closeOnSubmit = false } = {}) {
    const body = { ...action, ...newData };

    body.name = body.name.trim();

    if (!body.name.trim()?.length && !body.categories.length) return toast.error("L'action doit avoir au moins un nom ou une catégorie");
    const orgTeamIds = teams.map((t) => t._id);
    if (!body.teams?.filter((teamId) => orgTeamIds.includes(teamId)).length) {
      return toast.error("Une action doit être associée à au moins une équipe");
    }
    if (!isMulti && !body.person) return toast.error("La personne suivie est obligatoire");
    if (isMulti && !body.person?.length) return toast.error("Une personne suivie est obligatoire");
    if (!body.dueAt) return toast.error("La date d'échéance est obligatoire");
    if (outOfBoundariesDate(body.dueAt)) return toast.error("La date d'échéance est hors limites (entre 1900 et 2100)");
    if (body.completedAt && outOfBoundariesDate(body.completedAt)) return toast.error("La date de complétion est hors limites (entre 1900 et 2100)");

    if ([DONE, CANCEL].includes(body.status)) {
      body.completedAt = body.completedAt || new Date();
    } else {
      body.completedAt = null;
    }

    if (!isNewAction && initialExistingAction) {
      if (modalAction.isEditingAllNextOccurences) {
        const text = `En modifiant cette action et les suivantes, toutes les actions recurrentes pour cette personne après à la date de celle-ci (${dayjsInstance(action.dueAt).format("DD/MM/YYYY")}) seront supprimées, puis recréées avec les informations que vous avez renseignées. Cela signifie que tout ce qui aurait été rattaché aux actions suivantes (commentaires, documents, etc.) sera supprimé. Êtes-vous sûr de vouloir continuer ?`;
        if (!confirm(text)) return false;
      }

      const historyEntry = {
        date: new Date(),
        user: user._id,
        data: {},
      };
      for (const key in body) {
        if (!allowedActionFieldsInHistory.map((field) => field.name).includes(key)) continue;
        if (!isEqual(body[key], initialExistingAction[key])) {
          if (isEmptyValue(body[key]) && isEmptyValue(initialExistingAction[key])) continue;
          historyEntry.data[key] = { oldValue: initialExistingAction[key], newValue: body[key] };
        }
      }
      if (Object.keys(historyEntry.data).length) body.history = [...(initialExistingAction.history || []), historyEntry];

      setIsSubmitting(true);

      const [actionError] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/action/${initialExistingAction._id}`,
          body: await encryptAction(body),
        })
      );
      if (actionError) {
        toast.error("Erreur lors de la mise à jour de l'action, les données n'ont pas été sauvegardées.");
        setIsSubmitting(false);
        return false;
      }

      if (modalAction.isEditingAllNextOccurences && initialExistingAction.recurrence) {
        if (!body.recurrenceData.endDate) {
          setIsSubmitting(false);
          return toast.error("La date de fin de la récurrence est obligatoire");
        }
        // Mise à jour de la récurrence.
        const recurrenceDataWithDates = {
          ...body.recurrenceData,
          startDate: dayjsInstance(body.dueAt).startOf("day").toDate(),
          endDate: dayjsInstance(body.recurrenceData.endDate).startOf("day").toDate(),
        };
        const [recurrenceError, recurrenceResponse] = await tryFetchExpectOk(async () =>
          API.put({
            path: `/recurrence/${initialExistingAction.recurrence}`,
            body: recurrenceDataWithDates,
          })
        );
        if (recurrenceError) {
          toast.error("Erreur lors de la création de la récurrence, les données n'ont pas été sauvegardées.");
          setIsSubmitting(false);
          return false;
        }
        body.recurrence = recurrenceResponse.data._id;

        // Suppression de toutes les actions qui sont après la date de l'action modifiée.
        const nextActions = Object.values(actionsObjects).filter(
          (a) =>
            dayjsInstance(a.dueAt).isAfter(initialExistingAction.dueAt) &&
            a.person === initialExistingAction.person &&
            a.recurrence === initialExistingAction.recurrence
        );
        for (const nextAction of nextActions) {
          const [error] = await tryFetchExpectOk(() => API.delete({ path: `/action/${nextAction._id}` }));
          if (error) {
            toast.error("Erreur lors de la suppression des actions suivantes, les données n'ont pas été sauvegardées.");
            setIsSubmitting(false);
            return false;
          }
        }
        // Création des nouvelles actions.
        const occurrences = getOccurrences(recurrenceDataWithDates).filter((d) => dayjsInstance(d).isAfter(dayjsInstance(body.dueAt).endOf("day")));
        const [actionError] = await tryFetchExpectOk(async () => {
          API.post({
            path: "/action/multiple",
            body: await Promise.all(
              occurrences.map((occurrence) =>
                encryptAction({
                  ...body,
                  // On met la dueAt de la récurrence avec l'heure si withTime est activé.
                  dueAt: !body.withTime
                    ? occurrence
                    : dayjsInstance(occurrence)
                        .set("hour", dayjsInstance(body.dueAt).hour())
                        .set("minute", dayjsInstance(body.dueAt).minute())
                        .toDate(),
                  reccurence: body.recurrence,
                })
              )
            ),
          });
        });
        if (actionError) {
          toast.error("Erreur lors de la création des action, les données n'ont pas été sauvegardées.");
          setIsSubmitting(false);
          return false;
        }
      }

      const actionCancelled = initialExistingAction.status !== CANCEL && body.status === CANCEL;
      // On affiche le toast de mise à jour uniquement si on a fermé la modale.
      if (closeOnSubmit) toast.success("Mise à jour !");
      if (actionCancelled) {
        const { name, person, dueAt, withTime, description, categories, urgent, teams, documents } = action;
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
                        documents: documents?.map((d) => ({ ...d, _id: d._id + "__" + uuidv4() })),
                      }),
                    })
                  );
                  if (actionError) {
                    toast.error("Erreur lors de la duplication de l'action, les données n'ont pas été sauvegardées.");
                    return;
                  }
                  for (let c of comments) {
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
    } else {
      // On prévient l'utilisateur si la récurrence est activée qu'il y aura plusieurs actions créées.
      const hasRecurrence = body.recurrenceData?.timeUnit && body.isRecurrent;
      // La date de fin de la récurrence est obligatoire.
      if (hasRecurrence && !body.recurrenceData.endDate) {
        return toast.error("La date de fin de la récurrence est obligatoire");
      }
      const recurrenceDataWithDates = {
        ...body.recurrenceData,
        startDate: dayjsInstance(body.dueAt).startOf("day").toDate(),
        endDate: dayjsInstance(body.recurrenceData.endDate).startOf("day").toDate(),
      };
      const occurrences = hasRecurrence ? getOccurrences(recurrenceDataWithDates) : [];
      if (occurrences.length > 1) {
        const total = occurrences.length * (Array.isArray(body.person) ? body.person.length : 1);
        const text =
          "En sauvegardant, du fait de la récurrence et du nombre de personnes, vous allez créer " + total + " actions. Voulez-vous continuer ?";
        if (!confirm(text)) return false;
      }

      let actionsId = [];
      setIsSubmitting(true);

      // Creation de la récurrence si nécessaire. Attention on doit créer une récurrence par personnes,
      // pour pouvoir modifier une action pour une personne sans impacter les autres.
      const recurrencesIds = [];
      if (hasRecurrence) {
        for (const _personId of Array.isArray(body.person) ? body.person : [body.person]) {
          const [recurrenceError, recurrenceResponse] = await tryFetchExpectOk(async () =>
            API.post({
              path: "/recurrence",
              body: recurrenceDataWithDates,
            })
          );
          if (recurrenceError) {
            toast.error("Erreur lors de la création de la récurrence, les données n'ont pas été sauvegardées.");
            setIsSubmitting(false);
            return false;
          }
          // Pour sauvegarder le lien entre la récurrence et les actions
          recurrencesIds.push(recurrenceResponse.data._id);
        }
      }

      // Sauvegarde de l'action pour plusieurs personnes (et potentiellement plusieurs occurrences)
      if (Array.isArray(body.person) || hasRecurrence) {
        const [actionError, actionResponse] = await tryFetchExpectOk(async () => {
          const actions = (Array.isArray(body.person) ? body.person : [body.person]).flatMap((personId, index) => {
            if (hasRecurrence) {
              return occurrences.map((occurrence) =>
                encryptAction({
                  ...body,
                  recurrence: recurrencesIds[index],
                  person: personId,
                  dueAt: !body.withTime
                    ? occurrence
                    : dayjsInstance(occurrence)
                        .set("hour", dayjsInstance(body.dueAt).hour())
                        .set("minute", dayjsInstance(body.dueAt).minute())
                        .toDate(),
                })
              );
            } else {
              return encryptAction({
                ...body,
                person: personId,
                recurrence: undefined,
              });
            }
          });
          return API.post({
            path: "/action/multiple",
            body: await Promise.all(actions),
          });
        });
        if (actionError) {
          toast.error("Erreur lors de la création des action, les données n'ont pas été sauvegardées.");
          setIsSubmitting(false);
          return false;
        }
        actionsId = actionResponse.data.map((a) => a._id);
      } else {
        const [actionError, actionResponse] = await tryFetchExpectOk(async () =>
          API.post({
            path: "/action",
            body: await encryptAction(body),
          })
        );
        if (actionError) {
          toast.error("Erreur lors de la création de l'action, les données n'ont pas été sauvegardées.");
          setIsSubmitting(false);
          return false;
        }
        actionsId.push(actionResponse.data._id);
      }
      // Creer les commentaires.
      for (const actionId of actionsId) {
        if (body.comments?.length) {
          for (const comment of body.comments) {
            const [actionError] = await tryFetchExpectOk(async () =>
              API.post({
                path: "/comment",
                body: await encryptComment({ ...comment, action: actionId }),
              })
            );
            if (actionError) {
              toast.error("Erreur lors de la création du commentaire, l'action a été sauvegardée mais pas les commentaires.");
              setIsSubmitting(false);
              return false;
            }
          }
        }
      }
      if (Array.isArray(body.person) || occurrences.length) {
        const total = (Array.isArray(body.person) ? body.person.length : 1) * (occurrences.length || 1);
        toast.success(
          <>
            <div>Création réussie !</div>
            <div className="tw-text-sm tw-text-gray-500">{total} actions créées</div>
          </>
        );
      } else {
        toast.success("Création réussie !");
      }
    }
    if (closeOnSubmit) {
      onClose();
    } else {
      setIsSubmitting(false);
    }
    refresh();
    return true;
  }
  const canSave = true;

  const handleChange = (event) => {
    const target = event.currentTarget || event.target;
    const { name, value } = target;
    if (isMulti && name === "person" && Array.isArray(value) && value.length > 1 && action.documents?.length > 0) {
      toast.error("Vous ne pouvez pas sélectionner plusieurs personnes si des documents sont déjà associés à cette action.");
      return;
    }
    setModalAction((modalAction) => ({ ...modalAction, isEditing: true, action: { ...action, [name]: value } }));
  };

  return (
    <>
      <ModalHeader
        title={
          <div className="tw-flex tw-mr-12 tw-gap-2">
            <div className="tw-grow">
              {isNewAction && "Ajouter une action"}
              {!isNewAction && !isEditing && `Action: ${action?.name?.trim() || action?.categories?.join(", ")}`}
              {!isNewAction && isEditing && `Modifier l'action: ${action?.name?.trim() || action?.categories?.join(", ")}`}
            </div>
            {!isNewAction && action?.user && (
              <div>
                <UserName className="tw-text-base tw-font-normal tw-italic" id={action.user} wrapper={(name) => ` (créée par ${name})`} />
              </div>
            )}
          </div>
        }
        onClose={() => {
          if (initialExistingAction) {
            const { personPopulated, userPopulated, isRecurrent, recurrenceData, nextOccurrence, ...initialExistingActionWithoutPopulated } =
              initialExistingAction;
            const {
              style,
              isRecurrent: actionIsRecurrent,
              recurrenceData: actionRecurrenceData,
              personPopulated: actionPersonPopulated,
              userPopulated: actionUserPopulated,
              nextOccurrence: actionNextOccurrence,
              ...actionWithoutPopulated
            } = action;
            if (isEqual(actionWithoutPopulated, initialExistingActionWithoutPopulated)) return onClose();
          }
          setModalConfirmState({
            open: true,
            options: {
              title: "Quitter l'action sans enregistrer ?",
              subTitle: "Toutes les modifications seront perdues.",
              buttons: [
                {
                  text: "Annuler",
                  className: "button-cancel",
                },
                {
                  text: "Oui",
                  className: "button-destructive",
                  onClick: () => onClose(),
                },
              ],
            },
          });
        }}
      />
      <ModalBody>
        <div
          className={`tw-flex tw-h-full tw-w-full tw-flex-col tw-transition-all tw-duration-300 ${isTransitioning ? "tw-opacity-0 tw-scale-x-0" : ""}`}
        >
          <TabsNav
            className="tw-px-3 tw-py-2"
            tabs={[
              "Informations",
              ...(!["restricted-access"].includes(user.role) ? [`Documents ${action?.documents?.length ? `(${action.documents.length})` : ""}`] : []),
              ...(!["restricted-access"].includes(user.role)
                ? [`Commentaires ${action?.comments?.length ? `(${action.comments.length})` : ""}`]
                : []),
              ...(!["restricted-access"].includes(user.role) && !isNewAction ? ["Historique"] : []),
              ...(action.recurrence && action.recurrenceData.timeUnit ? ["Voir toutes les occurrences"] : []),
            ]}
            onClick={(tab) => {
              if (tab.includes("Informations")) setActiveTab("Informations");
              if (tab.includes("Documents")) setActiveTab("Documents");
              if (tab.includes("Commentaires")) setActiveTab("Commentaires");
              if (tab.includes("Historique")) setActiveTab("Historique");
              if (tab.includes("Voir toutes les occurrences")) setActiveTab("Voir toutes les occurrences");
              refresh();
            }}
            activeTabIndex={[
              "Informations",
              "Documents",
              "Commentaires",
              ...(isNewAction ? [] : ["Historique"]),
              "Voir toutes les occurrences",
            ].findIndex((tab) => tab === activeTab)}
          />
          <form
            id="add-action-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit({ closeOnSubmit: true });
            }}
          >
            <div
              className={[
                "tw-flex tw-w-full tw-flex-wrap tw-overflow-hidden sm:tw-h-[60vh] sm:tw-min-h-min tw-mb-4",
                activeTab !== "Informations" && "tw-hidden",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="tw-flex tw-h-full tw-w-full tw-flex-col tw-overflow-y-auto tw-text-left sm:tw-flex-row">
                <div id="right" className="tw-flex-[2] tw-basis-2/3 tw-ml-4 tw-mr-4">
                  <div className="tw-min-h-full tw-flex tw-flex-col sm:tw-pr-8 sm:tw-border-r sm:tw-border-gray-300">
                    <div className="tw-mb-4 tw-flex tw-flex-col tw-items-start tw-justify-start">
                      <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-main"} htmlFor="name">
                        Nom de l'action
                      </label>
                      {isEditing ? (
                        <textarea
                          name="name"
                          id="name"
                          value={action.name}
                          onChange={handleChange}
                          className="tw-w-full tw-rounded tw-border tw-border-gray-300 tw-px-3 tw-py-1.5 tw-text-base tw-transition-all"
                        />
                      ) : (
                        <CustomFieldDisplay value={action.name} type="textarea" />
                      )}
                    </div>
                    <div className="tw-mb-4 tw-flex tw-flex-col tw-items-start tw-justify-start">
                      {isMulti ? (
                        <div className="tw-flex tw-w-full tw-items-end">
                          <div className="tw-grow">
                            <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-main"} htmlFor="person">
                              Personne(s) suivie(s)
                            </label>
                          </div>
                          <div className="tw-text-sm text-muted tw-mb-1.5">
                            {action.person?.length
                              ? `${action.person.length} personne${action.person.length > 1 ? "s" : ""} sélectionnée${action.person.length > 1 ? "s" : ""}`
                              : ""}
                          </div>
                        </div>
                      ) : (
                        <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-main"} htmlFor="person">
                          Personne suivie
                        </label>
                      )}

                      {isEditing ? (
                        <div className="tw-w-full">
                          <SelectPerson
                            noLabel
                            value={action.person}
                            onChange={handleChange}
                            isMulti={isMulti}
                            inputId="create-action-person-select"
                          />
                        </div>
                      ) : (
                        <PersonName item={action} />
                      )}
                    </div>
                    <div className="tw-mb-4 tw-flex tw-flex-col tw-items-start tw-justify-start">
                      <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-main"} htmlFor="categories">
                        Catégorie(s)
                      </label>
                      {isEditing ? (
                        <div className="tw-w-full">
                          <ActionsCategorySelect
                            values={action.categories}
                            id="categories"
                            onChange={(v) => handleChange({ currentTarget: { value: v, name: "categories" } })}
                            withMostUsed
                          />
                        </div>
                      ) : (
                        <CustomFieldDisplay value={action.categories?.join(", ")} type="text" />
                      )}
                    </div>
                    {!["restricted-access"].includes(user.role) && (
                      <div className="tw-mb-4 tw-flex tw-flex-1 tw-flex-col tw-items-start tw-justify-start">
                        <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-main"} htmlFor="description">
                          Description
                        </label>
                        {isEditing ? (
                          <div className="tw-block tw-w-full tw-overflow-hidden tw-rounded tw-border tw-border-gray-300 tw-text-base tw-transition-all">
                            <AutoResizeTextarea name="description" id="description" value={action.description} onChange={handleChange} rows={4} />
                          </div>
                        ) : (
                          <CustomFieldDisplay value={action.description} type="textarea" />
                        )}
                      </div>
                    )}
                    {!!canToggleGroupCheck && (
                      <div className="tw-mb-4 tw-flex tw-flex-1 tw-flex-col tw-items-start tw-justify-start">
                        <label htmlFor="create-action-for-group">
                          {isEditing ? (
                            <>
                              <input
                                type="checkbox"
                                className="tw-mr-2"
                                id="create-action-for-group"
                                name="group"
                                checked={action.group}
                                onChange={() => {
                                  handleChange({ target: { name: "group", checked: Boolean(!action.group), value: Boolean(!action.group) } });
                                }}
                              />
                              Action familiale
                              <span className="text-muted tw-text-xs tw-block">Cette action sera à effectuer pour toute la famille</span>
                            </>
                          ) : action.group ? (
                            <>
                              Action familiale
                              <span className="text-muted tw-text-xs tw-block">Cette action sera à effectuer pour toute la famille</span>
                            </>
                          ) : null}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
                <div id="left" className="tw-flex tw-flex-[1] tw-basis-1/3 tw-flex-col tw-pr-4 tw-ml-4">
                  <div className="tw-mb-4 tw-flex tw-flex-col tw-items-start tw-justify-start">
                    <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-main"} htmlFor="dueAt">
                      À faire le
                    </label>
                    {isEditing ? (
                      <>
                        <DatePicker
                          withTime={action.withTime}
                          id="dueAt"
                          name="dueAt"
                          defaultValue={action.dueAt}
                          onChange={handleChange}
                          onInvalid={() => setActiveTab("Informations")}
                        />
                        <div>
                          <input
                            type="checkbox"
                            id="withTime"
                            name="withTime"
                            className="tw-mr-2"
                            checked={action.withTime || false}
                            onChange={() => {
                              handleChange({ target: { name: "withTime", checked: Boolean(!action.withTime), value: Boolean(!action.withTime) } });
                            }}
                          />
                          <label htmlFor="withTime">Montrer l'heure</label>
                        </div>
                      </>
                    ) : (
                      <CustomFieldDisplay value={action.dueAt} type={action.withTime ? "date-with-time" : "date"} />
                    )}
                  </div>
                  <div className="tw-mb-4 tw-flex tw-flex-col tw-items-start tw-justify-start">
                    <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-main"} htmlFor="team">
                      Équipe(s) en charge
                    </label>
                    {isEditing ? (
                      <div className="tw-w-full">
                        <SelectTeamMultiple
                          onChange={(teamIds) => handleChange({ target: { value: teamIds, name: "teams" } })}
                          value={Array.isArray(action.teams) ? action.teams : [action.team]}
                          colored
                          inputId="create-action-team-select"
                          classNamePrefix="create-action-team-select"
                        />
                      </div>
                    ) : (
                      <div className="tw-flex tw-flex-col">
                        {(Array.isArray(action.teams) ? action.teams : [action.team]).map((teamId) => (
                          <TagTeam key={teamId} teamId={teamId} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="tw-mb-4 tw-flex tw-flex-col tw-items-start tw-justify-start">
                    {isEditing && user.role !== "restricted-access" ? (
                      <label htmlFor="create-action-urgent">
                        <input
                          type="checkbox"
                          id="create-action-urgent"
                          className="tw-mr-2"
                          name="urgent"
                          checked={action.urgent || false}
                          onChange={() => {
                            handleChange({ target: { name: "urgent", checked: Boolean(!action.urgent), value: Boolean(!action.urgent) } });
                          }}
                        />
                        Action prioritaire
                        <span className="text-muted tw-text-xs tw-block">Cette action sera mise en avant par rapport aux autres</span>
                      </label>
                    ) : action.urgent ? (
                      <>
                        Action prioritaire
                        <span className="text-muted tw-text-xs tw-block">Cette action sera mise en avant par rapport aux autres</span>
                      </>
                    ) : null}
                  </div>
                  <div className="tw-mb-4 tw-flex tw-flex-col tw-items-start tw-justify-start">
                    <label htmlFor="update-action-select-status">Statut</label>

                    <div className="tw-w-full">
                      <SelectStatus
                        disabled={
                          modalAction.isEditingAllNextOccurences || (!modalAction.isEditing && action.recurrence && action.recurrenceData.timeUnit)
                        }
                        name="status"
                        value={action.status || ""}
                        onChange={handleChange}
                        inputId="update-action-select-status"
                        classNamePrefix="update-action-select-status"
                      />
                    </div>
                  </div>
                  <div className={["tw-mb-4 tw-flex tw-flex-col", [DONE, CANCEL].includes(action.status) ? "" : "tw-hidden"].join(" ")}>
                    <label htmlFor="completedAt">{action.status === DONE ? "Faite le" : "Annulée le"}</label>
                    {isEditing ? (
                      <div>
                        <DatePicker
                          withTime
                          id="completedAt"
                          name="completedAt"
                          defaultValue={action.completedAt ?? new Date()}
                          onChange={handleChange}
                          onInvalid={() => setActiveTab("Informations")}
                        />
                      </div>
                    ) : (
                      <CustomFieldDisplay value={action.completedAt} type="date-with-time" />
                    )}
                  </div>
                  {!isEditing && action.recurrence && action.recurrenceData.timeUnit && (
                    <div className="tw-mb-4 tw-flex tw-flex-col tw-items-start tw-justify-start">
                      <div className="tw-flex tw-items-center tw-text-sm">
                        <RepeatIcon className="tw-size-6 tw-mr-4 tw-text-main" />
                        <div>
                          {recurrenceAsText({ ...action.recurrenceData, nthWeekdayInMonth: getNthWeekdayInMonth(action.recurrenceData.startDate) })}{" "}
                          jusqu'au {dayjsInstance(action.recurrenceData.endDate).format("DD/MM/YYYY")}
                        </div>
                      </div>
                      <div className="tw-mt-2 tw-text-gray-600 tw-text-sm tw-w-full">
                        <div className="tw-font-bold tw-mb-4">Occurrences suivantes</div>
                        <NextOccurrences action={action} setIsTransitioning={setIsTransitioning} />
                      </div>
                    </div>
                  )}
                  {(isNewAction || (action.recurrence && action.recurrenceData.timeUnit && modalAction.isEditingAllNextOccurences)) && (
                    <div className="tw-mb-4 tw-flex tw-flex-col tw-items-start tw-justify-start">
                      <label htmlFor="create-action-recurrent" className="tw-flex tw-items-center tw-mb-4">
                        <input
                          type="checkbox"
                          id="create-action-recurrent"
                          className="tw-mr-2"
                          name="recurrent"
                          checked={action.isRecurrent}
                          onChange={() => {
                            handleChange({
                              target: { name: "isRecurrent", checked: Boolean(!action.isRecurrent), value: Boolean(!action.isRecurrent) },
                            });
                          }}
                        />
                        Répéter cette action
                        <RepeatIcon className="tw-size-5 tw-ml-2 tw-text-main" />
                      </label>
                      {action.isRecurrent && (
                        <Recurrence
                          startDate={action.dueAt}
                          initialValues={action.recurrenceData}
                          onChange={(recurrenceData) => handleChange({ target: { name: "recurrenceData", value: recurrenceData } })}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
          {!["restricted-access"].includes(user.role) && (
            <div
              className={["tw-flex tw-h-[50vh] tw-w-full tw-flex-col tw-gap-4 tw-overflow-y-auto", activeTab !== "Documents" && "tw-hidden"]
                .filter(Boolean)
                .join(" ")}
            >
              <DocumentsListSimple
                personId={action.person}
                showAssociatedItem={false}
                showAddDocumentButton={!modalAction.isEditingAllNextOccurences && !(initialExistingAction?.recurrence && !isEditing)}
                documents={action.documents.map((doc) => ({
                  ...doc,
                  type: doc.type ?? "document", // or 'folder'
                  linkedItem: { _id: action?._id, type: "action" },
                }))}
                canToggleGroupCheck={canToggleGroupCheck}
                onAddDocuments={async (nextDocuments) => {
                  const newData = {
                    ...action,
                    documents: [...action.documents, ...nextDocuments],
                  };
                  setModalAction({ ...modalAction, action: newData });
                  if (isNewAction) return;
                  const ok = await handleSubmit({ newData });
                  if (ok && nextDocuments.length > 1) toast.success("Documents ajoutés");
                }}
                onDeleteDocument={async (document) => {
                  const newData = { ...action, documents: action.documents.filter((d) => d._id !== document._id) };
                  setModalAction({ ...modalAction, action: newData });
                  if (isNewAction) return true;
                  const ok = await handleSubmit({ newData });
                  if (ok) toast.success("Document supprimé");
                  return ok;
                }}
                onSubmitDocument={async (document) => {
                  const newData = {
                    ...action,
                    documents: action.documents.map((d) => {
                      if (d._id === document._id) return document;
                      return d;
                    }),
                  };
                  setModalAction({ ...modalAction, action: newData });
                  if (isNewAction) return;
                  const ok = await handleSubmit({ newData });
                  if (ok) toast.success("Document mis à jour");
                }}
              />
            </div>
          )}
          {!["restricted-access"].includes(user.role) && (
            <div
              className={["tw-flex tw-h-[50vh] tw-w-full tw-flex-col tw-gap-4 tw-overflow-y-auto", activeTab !== "Commentaires" && "tw-hidden"]
                .filter(Boolean)
                .join(" ")}
            >
              <CommentsModule
                comments={action.comments
                  .map((c) => ({ ...c, type: "action", action }))
                  .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))}
                color="main"
                hiddenColumns={["person"]}
                canToggleUrgentCheck
                showAddCommentButton={!modalAction.isEditingAllNextOccurences && !(initialExistingAction?.recurrence && !isEditing)}
                typeForNewComment="action"
                actionId={action?._id}
                onDeleteComment={async (comment) => {
                  const newData = { ...action, comments: action.comments.filter((c) => c._id !== comment._id) };
                  setModalAction({ ...modalAction, action: newData });
                  if (!isNewAction) {
                    const [error] = await tryFetchExpectOk(() => API.delete({ path: `/comment/${comment._id}` }));
                    if (error) {
                      toast.error("Erreur lors de la suppression du commentaire");
                      return false;
                    }
                    const ok = await handleSubmit({ newData });
                    if (ok) toast.success("Suppression réussie");
                    return true;
                  }
                }}
                onSubmitComment={async (comment, isNewComment) => {
                  if (isNewComment) {
                    if (isNewAction) {
                      // On a besoin d'un identifiant temporaire pour les nouveaux commentaires dans une nouvelle action
                      // Car on peut ajouter, supprimer, éditer des commentaires qui n'existent pas en base de données.
                      // Cet identifiant sera remplacé par l'identifiant de l'objet créé par le serveur.
                      setModalAction({ ...modalAction, action: { ...action, comments: [{ ...comment, _id: uuidv4() }, ...action.comments] } });
                      return;
                    } else {
                      const [error, response] = await tryFetchExpectOk(async () =>
                        API.post({ path: "/comment", body: await encryptComment(comment) })
                      );
                      if (error) {
                        toast.error("Erreur lors de l'ajout du commentaire");
                        return;
                      }
                      const newData = { ...action, comments: [{ ...comment, _id: response.data._id }, ...action.comments] };
                      setModalAction({ ...modalAction, action: newData });
                      const ok = await handleSubmit({ newData });
                      if (ok) toast.success("Commentaire ajouté !");
                    }
                  } else {
                    const newData = { ...action, comments: action.comments.map((c) => (c._id === comment._id ? comment : c)) };
                    setModalAction({ ...modalAction, action: newData });
                    if (isNewAction) return;
                    const [error] = await tryFetchExpectOk(async () =>
                      API.put({
                        path: `/comment/${comment._id}`,
                        body: await encryptComment(comment),
                      })
                    );
                    if (error) {
                      toast.error("Erreur lors de l'ajout du commentaire");
                      return;
                    }
                    toast.success("Commentaire mis à jour");
                    refresh();
                  }
                }}
              />
            </div>
          )}
          {!["restricted-access"].includes(user.role) && (
            <div
              className={["tw-flex tw-h-[50vh] tw-w-full tw-flex-col tw-gap-4 tw-overflow-y-auto", activeTab !== "Historique" && "tw-hidden"]
                .filter(Boolean)
                .join(" ")}
            >
              <ActionHistory action={action} />
            </div>
          )}
          <div
            className={[
              "tw-flex tw-h-[50vh] tw-w-full tw-flex-col tw-gap-4 tw-overflow-y-auto",
              activeTab !== "Voir toutes les occurrences" && "tw-hidden",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <AllOccurrences
              action={action}
              onAfterActionClick={(a) => {
                toast.success(
                  "Vous consultez l'action du " + dayjsInstance([DONE, CANCEL].includes(a.status) ? a.completedAt : a.dueAt).format("DD/MM/YYYY")
                );
                setIsTransitioning(true);
                setTimeout(() => {
                  setActiveTab("Informations");
                  setIsTransitioning(false);
                }, 300);
              }}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        {modalAction.isEditingAllNextOccurences ? (
          <div className="tw-flex tw-my-auto tw-border-l-4 tw-text-sm tw-border-orange-500 tw-bg-orange-100 tw-py-2 tw-px-4 tw-text-orange-700 tw-items-center">
            <div>Vous éditez cette action et toutes les suivantes</div>
          </div>
        ) : null}
        <button name="Fermer" type="button" className="button-cancel" onClick={() => onClose()} disabled={isDeleting || isSubmitting}>
          Fermer
        </button>
        {!["restricted-access"].includes(user.role) && !isNewAction && !!isEditing && (
          <button
            type="button"
            name="cancel"
            disabled={isDeleting || isSubmitting}
            title="Supprimer cette action - seul le créateur peut supprimer une action"
            className="button-destructive"
            onClick={async (e) => {
              e.stopPropagation();
              if (modalAction.isEditingAllNextOccurences) {
                if (!window.confirm("Voulez-vous supprimer cette action ET TOUTES LES SUIVANTES ?")) return;
              } else {
                if (!window.confirm("Voulez-vous supprimer cette action ?")) return;
              }

              setIsDeleting(true);
              const [error] = await tryFetchExpectOk(() =>
                API.delete({
                  path: `/action/${action._id}`,
                  body: {
                    commentIdsToDelete: action.comments.map((c) => c._id),
                  },
                })
              );
              if (error) {
                toast.error("Erreur lors de la suppression de l'action");
                setIsDeleting(false);
                return;
              }

              // Suppression des occurrences suivantes si nécessaire:
              if (modalAction.isEditingAllNextOccurences) {
                const nextActions = Object.values(actionsObjects).filter(
                  (a) =>
                    dayjsInstance(a.dueAt).isAfter(initialExistingAction.dueAt) &&
                    a.person === initialExistingAction.person &&
                    a.recurrence === initialExistingAction.recurrence
                );
                for (const nextAction of nextActions) {
                  const [error] = await tryFetchExpectOk(() => API.delete({ path: `/action/${nextAction._id}` }));
                  if (error) {
                    toast.error("Erreur lors de la suppression des actions suivantes, les données n'ont pas été sauvegardées.");
                    setIsDeleting(false);
                    return false;
                  }
                }
              }
              refresh();
              toast.success("Suppression réussie");
              // We do not set isDeleting to false here because the modal will be closed
              // and the onAfterLeave will be called, which will set it to false
              onClose();
            }}
          >
            Supprimer
          </button>
        )}
        {(isEditing || canSave) && (
          <button
            title="Sauvegarder cette action"
            type="submit"
            className="button-submit"
            form="add-action-form"
            disabled={isDeleting || isSubmitting}
          >
            {isSubmitting ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        )}
        {!isEditing && !initialExistingAction?.recurrence && (
          <>
            <button
              title="Modifier cette action - seul le créateur peut modifier une action"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setModalAction((modalAction) => ({ ...modalAction, isEditing: true }));
              }}
              className={["button-submit", activeTab === "Informations" ? "tw-visible" : "tw-invisible"].join(" ")}
              disabled={isDeleting}
            >
              Modifier
            </button>
          </>
        )}
        {!isEditing && initialExistingAction?.recurrence && (
          <Menu as="div" className="tw-relative tw-inline-block tw-text-left">
            <div>
              <Menu.Button className="button-submit">Modifier</Menu.Button>
            </div>
            <Transition
              as={Fragment}
              enter="tw-transition tw-ease-out tw-duration-100"
              enterFrom="tw-transform tw-opacity-0 tw-scale-95"
              enterTo="tw-transform tw-opacity-100 tw-scale-100"
              leave="tw-transition tw-ease-in tw-duration-75"
              leaveFrom="tw-transform tw-opacity-100 tw-scale-100"
              leaveTo="tw-transform tw-opacity-0 tw-scale-95"
            >
              <Menu.Items
                className={`tw-absolute tw-bottom-full tw-right-0 tw-z-[105] tw-mb-2 tw-w-72 tw-rounded-md tw-bg-white tw-shadow-lg tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none`}
              >
                <div className="tw-py-1">
                  <Menu.Item>
                    <div
                      className={`tw-text-gray-700 hover:tw-bg-gray-100 hover:tw-text-gray-900 tw-block tw-cursor-pointer tw-px-4 tw-py-2 tw-text-sm`}
                      onClick={(e) => {
                        e.preventDefault();
                        setModalAction((modalAction) => ({ ...modalAction, isEditing: true, isEditingAllNextOccurences: true }));
                      }}
                    >
                      Cette action et toutes les suivantes
                    </div>
                  </Menu.Item>
                  <Menu.Item>
                    <div
                      className={`tw-text-gray-700 hover:tw-bg-gray-100 hover:tw-text-gray-900 tw-block tw-cursor-pointer tw-px-4 tw-py-2 tw-text-sm`}
                      onClick={(e) => {
                        e.preventDefault();
                        setModalAction((modalAction) => ({ ...modalAction, isEditing: true, isEditingAllNextOccurences: false }));
                      }}
                    >
                      Cette action uniquement
                    </div>
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        )}
      </ModalFooter>
    </>
  );
}

function AllOccurrences({ action, onAfterActionClick }) {
  const person = useAtomValue(itemsGroupedByPersonSelector)[action.person];
  const actions = (person?.actions || []).filter((e) => e.recurrence === action.recurrence);
  const [isAfterOpen, setIsAfterOpen] = useState(true);
  const [isBeforeOpen, setIsBeforeOpen] = useState(false);

  const afterActions = [];
  const beforeActions = [];
  for (const a of actions) {
    if (dayjsInstance(a.completedAt || a.dueAt).isAfter(dayjsInstance(action.completedAt || action.dueAt))) {
      afterActions.push(a);
    } else {
      beforeActions.push(a);
    }
  }

  if (!actions.length) return null;
  return (
    <div className="tw-p-4">
      <div className="tw-flex tw-items-center tw-mb-8">
        <RepeatIcon className="tw-size-6 tw-mr-4 tw-text-main" />
        <div>
          {recurrenceAsText({ ...action.recurrenceData, nthWeekdayInMonth: getNthWeekdayInMonth(action.recurrenceData.startDate) })} jusqu'au{" "}
          {dayjsInstance(action.recurrenceData.endDate).format("DD/MM/YYYY")}
        </div>
      </div>
      <div className="tw-mb-8">
        <div
          className="tw-bg-gray-100 tw-rounded-lg tw-p-4 tw-flex tw-text-lg tw-font-semibold tw-cursor-pointer"
          onClick={() => {
            setIsBeforeOpen(!isBeforeOpen);
          }}
        >
          <div className="tw-grow">
            Occurrences précédentes <span className="tw-opacity-75">({beforeActions.length})</span>
          </div>
          <div>{isBeforeOpen ? "-" : "+"}</div>
        </div>
        {isBeforeOpen && (
          <ActionsSortableList
            data={beforeActions}
            localStorageSortByName="action-recurrence-before-sortBy"
            localStorageSortOrderName="action-recurrence-before-sortBy"
            defaultOrder="DESC"
            onAfterActionClick={onAfterActionClick}
          />
        )}
      </div>
      <div className="tw-mb-8">
        <div
          className="tw-bg-gray-100 tw-rounded-lg tw-p-4 tw-flex tw-text-lg tw-font-semibold tw-cursor-pointer"
          onClick={() => {
            setIsAfterOpen(!isAfterOpen);
          }}
        >
          <div className="tw-grow">
            Occurrences suivantes <span className="tw-opacity-75">({afterActions.length})</span>
          </div>
          <div>{isAfterOpen ? "-" : "+"}</div>
        </div>
        {isAfterOpen && (
          <ActionsSortableList
            data={afterActions}
            localStorageSortByName="action-recurrence-after-sortBy"
            localStorageSortOrderName="action-recurrence-after-sortBy"
            defaultOrder="DESC"
            onAfterActionClick={onAfterActionClick}
          />
        )}
      </div>
    </div>
  );
}

function NextOccurrences({ action, setIsTransitioning }) {
  const person = useAtomValue(itemsGroupedByPersonSelector)[action.person];
  const actions =
    person?.actions
      .filter((e) => e.recurrence === action.recurrence)
      .filter((a) => dayjsInstance(a.completedAt || a.dueAt).isAfter(dayjsInstance(action.completedAt || action.dueAt))) || [];
  const setModalAction = useSetAtom(modalActionState);
  const location = useLocation();

  if (!actions.length)
    return (
      <div className="tw-text-xs tw-text-gray-600 -tw-mt-4">
        Aucune occurrence de l'action après celle-ci. Vous pouvez afficher toutes les occurrences de l'action en sélectionnant l'onglet correspondant
        ci-dessus.
      </div>
    );
  return (
    <table className="table table-striped">
      <tbody className="small">
        {actions.map((a) => {
          return (
            <tr
              key={a._id}
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  toast.success(
                    "Vous consultez l'action du " + dayjsInstance([DONE, CANCEL].includes(a.status) ? a.completedAt : a.dueAt).format("DD/MM/YYYY")
                  );
                  setModalAction({ ...defaultModalActionState(), open: true, from: location.pathname, action: a });
                  setIsTransitioning(false);
                }, 300);
              }}
            >
              <td className="!tw-p-1">
                <DateBloc date={[DONE, CANCEL].includes(a.status) ? a.completedAt : a.dueAt} />
              </td>
              <td className="!tw-p-1 !tw-align-middle">
                <ActionStatusSelect action={a} />
              </td>
              <td className="!tw-p-1 !tw-align-middle">
                <div className="tw-flex tw-h-full tw-shrink-0 tw-flex-col tw-justify-center tw-gap-px">
                  {Array.isArray(a?.teams) ? a.teams.map((e) => <TagTeam key={e} teamId={e} />) : <TagTeam teamId={a?.team} />}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ActionHistory({ action }) {
  const history = useMemo(() => [...(action?.history || [])].reverse(), [action?.history]);
  const teams = useAtomValue(teamsState);

  return (
    <div>
      <table className="table table-striped table-bordered">
        <thead>
          <tr className="tw-cursor-default">
            <th>Date</th>
            <th>Utilisateur</th>
            <th>Donnée</th>
          </tr>
        </thead>
        <tbody className="small">
          {history.map((h) => {
            return (
              <tr key={h.date} className="tw-cursor-default">
                <td>{dayjsInstance(h.date).format("DD/MM/YYYY HH:mm")}</td>
                <td>
                  <UserName id={h.user} />
                </td>
                <td className="tw-max-w-prose">
                  {Object.entries(h.data).map(([key, value]) => {
                    const actionField = allowedActionFieldsInHistory.find((f) => f.name === key);
                    if (key === "teams") {
                      return (
                        <p className="tw-flex tw-flex-col" key={key}>
                          <span>{actionField?.label} : </span>
                          <code>"{(value.oldValue || []).map((teamId) => teams.find((t) => t._id === teamId)?.name).join(", ")}"</code>
                          <span>↓</span>
                          <code>"{(value.newValue || []).map((teamId) => teams.find((t) => t._id === teamId)?.name).join(", ")}"</code>
                        </p>
                      );
                    }
                    if (key === "person") {
                      return (
                        <p key={key}>
                          {actionField?.label} : <br />
                          <code>
                            <PersonName item={{ person: value.oldValue }} />
                          </code>{" "}
                          ➔{" "}
                          <code>
                            <PersonName item={{ person: value.newValue }} />
                          </code>
                        </p>
                      );
                    }

                    return (
                      <p
                        key={key}
                        data-test-id={`${actionField?.label}: ${JSON.stringify(value.oldValue || "")} ➔ ${JSON.stringify(value.newValue)}`}
                      >
                        {actionField?.label} : <br />
                        <code>{JSON.stringify(value.oldValue || "")}</code> ➔ <code>{JSON.stringify(value.newValue)}</code>
                      </p>
                    );
                  })}
                </td>
              </tr>
            );
          })}
          {action?.createdAt && (
            <tr key={action.createdAt} className="tw-cursor-default">
              <td>{dayjsInstance(action.createdAt).format("DD/MM/YYYY HH:mm")}</td>
              <td>
                <UserName id={action.user} />
              </td>
              <td className="tw-max-w-prose">
                <p>Création de l’action</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
