import { useState, useMemo } from "react";
import isEqual from "react-fast-compare";
import DatePicker from "./DatePicker";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import { CANCEL, DONE, TODO } from "../recoil/actions";
import { currentTeamState, organisationState, teamsState, userState } from "../recoil/auth";
import { allowedActionFieldsInHistory, encryptAction } from "../recoil/actions";
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
import { itemsGroupedByActionSelector } from "../recoil/selectors";
import { DocumentsModule } from "./DocumentsGeneric";
import TabsNav from "./tailwind/TabsNav";
import { useDataLoader } from "./DataLoader";
import ActionsCategorySelect from "./tailwind/ActionsCategorySelect";
import AutoResizeTextarea from "./AutoresizeTextArea";
import { groupsState } from "../recoil/groups";
import { encryptComment } from "../recoil/comments";
import { modalActionState } from "../recoil/modal";
import { decryptItem } from "../services/encryption";

export default function ActionModal() {
  const [modalAction, setModalAction] = useRecoilState(modalActionState);
  const location = useLocation();
  const open = modalAction.open && location.pathname === modalAction.from;

  return (
    <ModalContainer
      open={open}
      size="full"
      onAfterLeave={() => {
        if (modalAction.shouldResetOnClose) setModalAction({ open: false });
      }}
    >
      {modalAction.action ? (
        <ActionContent
          key={open}
          isMulti={modalAction.isForMultiplePerson}
          onClose={() => {
            // Seulement dans le cas du bouton fermer, de la croix, ou de l'enregistrement,
            // On supprime le la liste des personnes suivies pour ne pas la réutiliser.
            setModalAction((modalAction) => ({ ...modalAction, open: false, shouldResetOnClose: true }));
          }}
        />
      ) : null}
    </ModalContainer>
  );
}

function ActionContent({ onClose, isMulti = false }) {
  const location = useLocation();
  const actionsObjects = useRecoilValue(itemsGroupedByActionSelector);
  const [modalAction, setModalAction] = useRecoilState(modalActionState);
  const teams = useRecoilValue(teamsState);
  const user = useRecoilValue(userState);
  const organisation = useRecoilValue(organisationState);
  const currentTeam = useRecoilValue(currentTeamState);
  const setModalConfirmState = useSetRecoilState(modalConfirmState);
  const groups = useRecoilValue(groupsState);
  const { refresh } = useDataLoader();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = modalAction.isEditing;

  const action = useMemo(
    () => ({
      documents: [],
      comments: [],
      history: [],
      teams: modalAction.action?.teams ?? modalAction.action?.teams?.length === 1 ? [teams?.[0]._id] : [],
      ...modalAction.action,
    }),
    [modalAction.action, teams]
  );

  const initialExistingAction = action._id ? actionsObjects[action._id] : undefined;
  const isNewAction = !initialExistingAction;

  const [activeTab, setActiveTab] = useState("Informations");
  const isOnePerson = typeof action?.person === "string" || action?.person?.length === 1;
  const onlyPerson = !isOnePerson ? null : typeof action?.person === "string" ? action.person : action.person?.[0];
  const canToggleGroupCheck = !!organisation.groupsEnabled && !!onlyPerson && groups.find((group) => group.persons.includes(onlyPerson));

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
      const historyEntry = {
        date: new Date(),
        user: user._id,
        data: {},
      };
      for (const key in body) {
        if (!allowedActionFieldsInHistory.map((field) => field.name).includes(key)) continue;
        if (body[key] !== initialExistingAction[key]) {
          // On ignore les changements de `null` à `""` et inversement.
          if (!body[key] && !initialExistingAction[key]) {
            continue;
          }
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

      const actionCancelled = initialExistingAction.status !== CANCEL && body.status === CANCEL;
      // On affiche le toast de mise à jour uniquement si on a fermé la modale.
      if (closeOnSubmit) toast.success("Mise à jour !");
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
      let actionsId = [];
      setIsSubmitting(true);
      if (Array.isArray(body.person)) {
        const [actionError, actionResponse] = await tryFetchExpectOk(async () =>
          API.post({
            path: "/action/multiple",
            body: await Promise.all(
              body.person.map((personId) =>
                encryptAction({
                  ...body,
                  person: personId,
                })
              )
            ),
          })
        );
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
              return false;
            }
          }
        }
      }
      toast.success("Création réussie !");
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
            const { personPopulated, userPopulated, ...initialExistingActionWithoutPopulated } = initialExistingAction;
            const { style, personPopulated: actionPersonPopulated, userPopulated: actionUserPopulated, ...actionWithoutPopulated } = action;
            if (isEqual(actionWithoutPopulated, initialExistingActionWithoutPopulated)) return onClose();
          }
          setModalConfirmState({
            open: true,
            options: {
              title: "Quitter la action sans enregistrer ?",
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
        <div className="tw-flex tw-h-full tw-w-full tw-flex-col">
          <TabsNav
            className="tw-px-3 tw-py-2"
            tabs={[
              "Informations",
              `Documents ${action?.documents?.length ? `(${action.documents.length})` : ""}`,
              `Commentaires ${action?.comments?.length ? `(${action.comments.length})` : ""}`,
              "Historique",
            ]}
            onClick={(tab) => {
              if (tab.includes("Informations")) setActiveTab("Informations");
              if (tab.includes("Documents")) setActiveTab("Documents");
              if (tab.includes("Commentaires")) setActiveTab("Commentaires");
              if (tab.includes("Historique")) setActiveTab("Historique");
              refresh();
            }}
            activeTabIndex={["Informations", "Documents", "Commentaires", "Historique"].findIndex((tab) => tab === activeTab)}
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
                "tw-flex tw-w-full tw-flex-wrap tw-overflow-hidden sm:tw-h-[60vh] sm:tw-min-h-min",
                activeTab !== "Informations" && "tw-hidden",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="tw-flex tw-h-full tw-w-full tw-flex-col tw-overflow-y-auto tw-py-4 tw-text-left sm:tw-flex-row ">
                <div id="right" className="tw-grid tw-min-h-full tw-flex-[2] tw-basis-2/3 tw-grid-cols-[1fr_2px] tw-pl-4 tw-pr-8">
                  <div className="tw-flex tw-flex-col tw-pr-8">
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
                      <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-main"} htmlFor="person">
                        {isMulti ? "Personne(s) suivie(s)" : "Personne suivie"}
                      </label>
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
                              Action familiale <br />
                              <small className="text-muted">Cette action sera à effectuer pour toute la famille</small>
                            </>
                          ) : action.group ? (
                            <>
                              Action familiale <br />
                              <small className="text-muted">Cette action sera à effectuer pour toute la famille</small>
                            </>
                          ) : null}
                        </label>
                      </div>
                    )}
                  </div>
                  <div id="separator" className="tw-flex tw-w-2 tw-shrink-0 tw-flex-col tw-pb-4">
                    <hr className="tw-m-0 tw-w-px tw-shrink-0 tw-basis-full tw-border tw-bg-gray-300" />
                  </div>
                </div>
                <div id="left" className="tw-flex tw-flex-[1] tw-basis-1/3 tw-flex-col tw-pr-4">
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
                          defaultValue={action.dueAt ?? new Date()}
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
                      Action prioritaire <br />
                      <small className="text-muted">Cette action sera mise en avant par rapport aux autres</small>
                    </label>
                  </div>
                  <div className="tw-mb-4 tw-flex tw-flex-col tw-items-start tw-justify-start">
                    <label htmlFor="update-action-select-status">Statut</label>
                    <div className="tw-w-full">
                      <SelectStatus
                        name="status"
                        value={action.status || ""}
                        onChange={handleChange}
                        inputId="update-action-select-status"
                        classNamePrefix="update-action-select-status"
                      />
                    </div>
                  </div>
                  <div
                    className={["tw-mb-4 tw-flex tw-flex-1 tw-flex-col", [DONE, CANCEL].includes(action.status) ? "tw-visible" : "tw-invisible"].join(
                      " "
                    )}
                  >
                    <label htmlFor="completedAt">{action.status === DONE ? "Faite le" : "Annulée le"}</label>
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
                  </div>
                </div>
              </div>
            </div>
          </form>
          <div
            className={["tw-flex tw-h-[50vh] tw-w-full tw-flex-col tw-gap-4 tw-overflow-y-auto", activeTab !== "Documents" && "tw-hidden"]
              .filter(Boolean)
              .join(" ")}
          >
            <DocumentsModule
              personId={Array.isArray(action.person) && action.person.length === 1 ? action.person[0] : action.person}
              showAssociatedItem={false}
              documents={action.documents.map((doc) => ({
                ...doc,
                type: doc.type ?? "document", // or 'folder'
                linkedItem: { _id: action?._id, type: "action" },
              }))}
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
              canToggleUrgentCheck
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
                    const [error, response] = await tryFetchExpectOk(async () => API.post({ path: "/comment", body: await encryptComment(comment) }));
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
          <div
            className={["tw-flex tw-h-[50vh] tw-w-full tw-flex-col tw-gap-4 tw-overflow-y-auto", activeTab !== "Historique" && "tw-hidden"]
              .filter(Boolean)
              .join(" ")}
          >
            <ActionHistory action={action} />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
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
              if (!window.confirm("Voulez-vous supprimer cette action ?")) return;
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
              refresh();
              toast.success("Suppression réussie");
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
        {!isEditing && (
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
        )}
      </ModalFooter>
    </>
  );
}

function ActionHistory({ action }) {
  const history = useMemo(() => [...(action?.history || [])].reverse(), [action?.history]);
  const teams = useRecoilValue(teamsState);

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
