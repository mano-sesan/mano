import React, { useMemo, useState } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { useHistory, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik } from "formik";
import ExclamationMarkButton from "./tailwind/ExclamationMarkButton";
import TagTeam from "./TagTeam";
import { currentTeamState, organisationState, teamsState, userState } from "../recoil/auth";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "./tailwind/Modal";
import { dayjsInstance, formatDateTimeWithNameOfDay } from "../services/date";
import { outOfBoundariesDate } from "../services/date";
import { FullScreenIcon } from "../assets/icons/FullScreenIcon";
import SelectUser from "./SelectUser";
import DatePicker from "./DatePicker";
import AutoResizeTextarea from "./AutoresizeTextArea";
import UserName from "./UserName";
import CustomFieldDisplay from "./CustomFieldDisplay";
import ConsultationButton from "./ConsultationButton";
import SelectTeam from "./SelectTeam";
import { defaultModalActionState, modalActionState } from "../recoil/modal";
import { itemsGroupedByActionSelector } from "../recoil/selectors";
import CommentsSortableList from "./CommentsSortableList";

/*
3 components:
- CommentsPanel for Person Summary / Person Medical File
- CommentsTable when
  - expanding the CommentsPanel (full screen)
  - reading a Consultation/Treatment/Action
- CommentModal for creating/editing a comment
*/

interface Comment {
  _id: string;
  type: "person" | "action" | "passage" | "rencontre" | "medical-file" | "consultation" | "treatment";
  user: string;
  date?: Date;
  createdAt?: Date;
  comment: string;
  urgent?: boolean;
  group?: boolean;
  share?: boolean;
  team: string;
  person?: string;
  action?: string;
  passage?: string;
  rencontre?: string;
  consultation?: { _id: string };
  treatment?: { _id: string };
  isMedicalCommentShared?: boolean;
  organisation?: string;
}

interface CommentsModuleProps {
  comments?: Comment[];
  title?: string;
  typeForNewComment: "person" | "action" | "passage" | "rencontre" | "medical-file" | "consultation" | "treatment";
  personId?: string | null;
  actionId?: string | null;
  showPanel?: boolean;
  canToggleGroupCheck?: boolean;
  canToggleUrgentCheck?: boolean;
  canToggleShareComment?: boolean;
  showAddCommentButton?: boolean;
  onDeleteComment: (comment: Comment) => Promise<void>;
  onSubmitComment: (comment: Partial<Comment>, isNew: boolean) => Promise<void>;
  hiddenColumns?: string[];
  color?: "main" | "blue-900";
  withFilters?: boolean;
}

export function CommentsModule({
  comments = [],
  title = "Commentaires",
  typeForNewComment,
  personId = null,
  actionId = null,
  showPanel = false,
  canToggleGroupCheck = false,
  canToggleUrgentCheck = false,
  canToggleShareComment = false,
  showAddCommentButton = true,
  onDeleteComment,
  onSubmitComment,
  color = "main",
  hiddenColumns = [],
  withFilters = false,
}: CommentsModuleProps) {
  if (!typeForNewComment) throw new Error("typeForNewComment is required");
  if (!onDeleteComment) throw new Error("onDeleteComment is required");
  if (!onSubmitComment) throw new Error("onSubmitComment is required");
  const [modalCreateOpen, setModalCreateOpen] = useState(false);
  const [commentToDisplay, setCommentToDisplay] = useState(null);
  const [commentToEdit, setCommentToEdit] = useState(null);
  const [fullScreen, setFullScreen] = useState(false);

  return (
    <>
      {showPanel ? (
        <div className="tw-relative">
          <div className="tw-sticky tw-top-0 tw-z-10 tw-flex tw-bg-white tw-p-3 tw-shadow-sm">
            <h4 className="tw-flex-1 tw-text-xl">
              {title} {comments.length ? `(${comments.length})` : ""}
            </h4>
            <div className="flex-col tw-flex tw-items-center tw-gap-2">
              <button
                aria-label="Ajouter un commentaire"
                className={`tw-text-md tw-h-8 tw-w-8 tw-rounded-full tw-bg-${color} tw-font-bold tw-text-white tw-transition hover:tw-scale-125`}
                onClick={() => setModalCreateOpen(true)}
              >
                ＋
              </button>
              {Boolean(comments.length) && (
                <button
                  title="Passer les commentaires en plein écran"
                  className={`tw-h-6 tw-w-6 tw-rounded-full tw-text-${color} tw-transition hover:tw-scale-125`}
                  onClick={() => setFullScreen(true)}
                >
                  <FullScreenIcon />
                </button>
              )}
            </div>
          </div>
          <CommentsTable
            withClickableLabel
            comments={comments}
            color={color}
            onDisplayComment={setCommentToDisplay}
            onEditComment={setCommentToEdit}
            onAddComment={() => setModalCreateOpen(true)}
            hiddenColumns={hiddenColumns}
            small
          />
        </div>
      ) : (
        <CommentsTable
          showAddCommentButton={showAddCommentButton}
          comments={comments}
          color={color}
          onDisplayComment={setCommentToDisplay}
          onEditComment={setCommentToEdit}
          onAddComment={() => setModalCreateOpen(true)}
          hiddenColumns={hiddenColumns}
        />
      )}
      {!!modalCreateOpen && (
        <CommentModal
          isNewComment={true}
          onClose={() => setModalCreateOpen(false)}
          onDelete={onDeleteComment}
          onSubmit={onSubmitComment}
          typeForNewComment={typeForNewComment}
          canToggleGroupCheck={canToggleGroupCheck}
          canToggleShareComment={canToggleShareComment}
          canToggleUrgentCheck={canToggleUrgentCheck}
          personId={personId}
          actionId={actionId}
          color={color}
        />
      )}
      {!!commentToEdit && (
        <CommentModal
          comment={commentToEdit}
          isNewComment={false}
          onClose={() => setCommentToEdit(null)}
          onDelete={onDeleteComment}
          onSubmit={onSubmitComment}
          typeForNewComment={typeForNewComment}
          canToggleGroupCheck={canToggleGroupCheck}
          canToggleShareComment={canToggleShareComment}
          canToggleUrgentCheck={canToggleUrgentCheck}
          personId={personId}
          actionId={actionId}
          color={color}
        />
      )}
      {!!commentToDisplay && (
        <CommentDisplay
          comment={commentToDisplay}
          onClose={() => setCommentToDisplay(null)}
          onEditComment={() => {
            setCommentToDisplay(null);
            setCommentToEdit(commentToDisplay);
          }}
          canToggleGroupCheck={canToggleGroupCheck}
          canToggleShareComment={canToggleShareComment}
          canToggleUrgentCheck={canToggleUrgentCheck}
          color={color}
        />
      )}
      <CommentsFullScreen
        open={!!fullScreen}
        comments={comments}
        onDisplayComment={setCommentToDisplay}
        onAddComment={() => setModalCreateOpen(true)}
        onClose={() => setFullScreen(false)}
        title={title}
        color={color}
        hiddenColumns={hiddenColumns}
        withFilters={withFilters}
      />
    </>
  );
}

interface CommentsFullScreenProps {
  open: boolean;
  comments: Comment[];
  onClose: () => void;
  title: string;
  color: string;
  onDisplayComment: (comment: Comment) => void;
  onAddComment: () => void;
  hiddenColumns?: string[];
  withFilters?: boolean;
}

function CommentsFullScreen({
  open,
  comments,
  onClose,
  title,
  color,
  onDisplayComment,
  onAddComment,
  hiddenColumns = [],
  withFilters = false,
}: CommentsFullScreenProps) {
  return (
    <ModalContainer open={open} size="5xl" onClose={onClose}>
      <ModalHeader title={title} />
      <ModalBody>
        <CommentsTable
          comments={comments}
          onDisplayComment={onDisplayComment}
          onAddComment={onAddComment}
          withClickableLabel
          color={color}
          hiddenColumns={hiddenColumns}
          withFilters={withFilters}
        />
      </ModalBody>
      <ModalFooter>
        <button type="button" name="cancel" className="button-cancel" onClick={onClose}>
          Fermer
        </button>
        <button type="button" className={`button-submit !tw-bg-${color}`} onClick={onAddComment}>
          ＋ Ajouter un commentaire
        </button>
      </ModalFooter>
    </ModalContainer>
  );
}

interface CommentsTableProps {
  comments: Comment[];
  onDisplayComment: (comment: Comment) => void;
  onEditComment?: (comment: Comment) => void;
  onAddComment: () => void;
  color: string;
  showAddCommentButton?: boolean;
  withClickableLabel?: boolean;
  hiddenColumns?: string[];
  small?: boolean;
  withFilters?: boolean;
}

export function NoComments() {
  return (
    <div className="tw-mb-2 tw-mt-8 tw-w-full tw-text-center tw-text-gray-300">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="tw-mx-auto tw-h-16 tw-w-16 tw-text-gray-200"
        width={24}
        height={24}
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path d="M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1"></path>
        <line x1={12} y1={12} x2={12} y2="12.01"></line>
        <line x1={8} y1={12} x2={8} y2="12.01"></line>
        <line x1={16} y1={12} x2={16} y2="12.01"></line>
      </svg>
      Aucun commentaire pour le moment
    </div>
  );
}

function CommentsTable({
  comments,
  onDisplayComment,
  onEditComment,
  onAddComment,
  color,
  showAddCommentButton,
  withClickableLabel,
  hiddenColumns = [],
  small = false,
  withFilters = false,
}: CommentsTableProps) {
  const actionsObjects = useRecoilValue(itemsGroupedByActionSelector);
  const setModalAction = useSetRecoilState(modalActionState);
  const user = useRecoilValue(userState);
  const organisation = useRecoilValue(organisationState);
  const history = useHistory();
  const location = useLocation();

  const onCommentClick = (comment: Comment) => {
    if (comment.isMedicalCommentShared) return;
    switch (comment.type) {
      case "action":
      case "person":
      case "medical-file":
        onDisplayComment(comment);
        break;
      case "passage":
        history.push(`/person/${comment.person}?passageId=${comment.passage}`);
        break;
      case "rencontre":
        history.push(`/person/${comment.person}?rencontreId=${comment.rencontre}`);
        break;
      case "consultation":
        if (searchParams.get("newConsultation") === "true") {
          onEditComment(comment);
          break;
        }
        if (searchParams.get("consultationId") === comment.consultation._id) {
          if (comment.user === user._id) onEditComment(comment);
          break;
        }
        searchParams.set("consultationId", comment.consultation._id);
        history.push(`?${searchParams.toString()}`);
        break;
      case "treatment":
        if (searchParams.get("newTreatment") === "true") {
          onEditComment(comment);
          break;
        }
        if (searchParams.get("treatmentId") === comment.treatment._id) {
          if (comment.user === user._id) onEditComment(comment);
          break;
        }
        searchParams.set("treatmentId", comment.treatment._id);
        history.push(`?${searchParams.toString()}`);
        break;
      default:
        break;
    }
  };

  if (!comments.length) {
    return (
      <div className="tw-flex tw-flex-col tw-items-center tw-gap-6">
        <NoComments />
        {showAddCommentButton && (
          <button type="button" className={`button-submit !tw-bg-${color}`} onClick={onAddComment}>
            ＋ Ajouter un commentaire
          </button>
        )}
      </div>
    );
  }
  const searchParams = new URLSearchParams(location.search);
  return (
    <>
      {showAddCommentButton && (
        <div className="tw-my-1.5 tw-flex tw-justify-center tw-self-center">
          <button type="button" className={`button-submit !tw-bg-${color}`} onClick={onAddComment}>
            ＋ Ajouter un commentaire
          </button>
        </div>
      )}
      {!small ? (
        <div className="tw-px-4 tw-py-2 print:tw-mb-4 print:tw-px-0">
          <CommentsSortableList
            withFilters={withFilters}
            data={comments}
            fullScreen={true}
            hiddenColumns={hiddenColumns}
            onCommentClick={onCommentClick}
          />
        </div>
      ) : (
        <table className="table">
          <tbody className="small">
            {(comments || []).map((comment, i) => {
              if (!comment.type) throw new Error("type is required");
              const isNotEditable =
                comment.isMedicalCommentShared ||
                ((!!searchParams.get("consultationId") || !!searchParams.get("treatmentId")) && comment.user !== user._id);
              return (
                <tr
                  key={comment._id}
                  title={isNotEditable ? "Ce commentaire peut seulement être modifié par l'utilisateur qui l'a créé" : ""}
                  className={[
                    "tw-w-full",
                    comment.isMedicalCommentShared ? "tw-bg-blue-900" : `tw-bg-${color}`,
                    i % 2 && !comment.isMedicalCommentShared ? "tw-bg-opacity-0" : "tw-bg-opacity-5",
                    isNotEditable && "!tw-cursor-not-allowed",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td onClick={() => onCommentClick(comment)}>
                    <div className="tw-mx-auto tw-flex tw-w-full tw-max-w-prose tw-flex-col tw-gap-2 tw-overflow-hidden">
                      <div className="tw-mb-4 tw-flex tw-items-center tw-align-middle">
                        {!!comment.urgent && <ExclamationMarkButton className="tw-mr-4" />}
                        <div className="tw-text-xs tw-opacity-50 tw-grow">{formatDateTimeWithNameOfDay(comment.date || comment.createdAt)}</div>
                        {comment.isMedicalCommentShared ? (
                          <div>
                            <ConsultationButton />
                          </div>
                        ) : null}
                      </div>
                      <div className="tw-flex tw-w-full tw-flex-shrink tw-items-start">
                        {!!organisation.groupsEnabled && !!comment.group && (
                          <span className="tw-mr-2 tw-text-xl" aria-label="Commentaire familial" title="Commentaire familial">
                            👪
                          </span>
                        )}
                        <div className="[overflow-wrap:anywhere] tw-leading-4">
                          {(comment.comment || "").split?.("\n")?.map((sentence, index) => (
                            <React.Fragment key={sentence + index}>
                              {sentence}
                              <br />
                            </React.Fragment>
                          ))}
                        </div>
                        {!!withClickableLabel && ["treatment", "consultation", "action", "passage", "rencontre"].includes(comment.type) && (
                          <button
                            type="button"
                            className={`tw-ml-auto tw-block ${comment.isMedicalCommentShared ? "!tw-cursor-not-allowed" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const searchParams = new URLSearchParams(location.search);
                              if (comment.isMedicalCommentShared) return;
                              switch (comment.type) {
                                case "action":
                                  setModalAction({
                                    ...defaultModalActionState(),
                                    open: true,
                                    from: location.pathname,
                                    action: actionsObjects[comment.action],
                                  });
                                  break;
                                case "person":
                                  history.push(`/person/${comment.person}`);
                                  break;
                                case "passage":
                                  history.push(`/person/${comment.person}?passageId=${comment.passage}`);
                                  break;
                                case "rencontre":
                                  history.push(`/person/${comment.person}?rencontreId=${comment.rencontre}`);
                                  break;
                                case "consultation":
                                  searchParams.set("consultationId", comment.consultation._id);
                                  history.push(`?${searchParams.toString()}`);
                                  break;
                                case "treatment":
                                  searchParams.set("treatmentId", comment.treatment._id);
                                  history.push(`?${searchParams.toString()}`);
                                  break;
                                case "medical-file":
                                  history.push(`/person/${comment.person}?tab=Dossier+Médical`);
                                  break;
                                default:
                                  break;
                              }
                            }}
                          >
                            <div className="tw-rounded tw-border tw-border-blue-900 tw-bg-blue-900/10 tw-px-1">
                              {comment.type === "treatment" && "Traitement"}
                              {comment.type === "consultation" && "Consultation"}
                              {comment.type === "action" && "Action"}
                              {comment.type === "passage" && "Passage"}
                              {comment.type === "rencontre" && "Rencontre"}
                            </div>
                          </button>
                        )}
                      </div>
                      <div className="small tw-flex tw-items-end tw-justify-between">
                        <p className="tw-mb-0 tw-basis-1/2 tw-opacity-50">
                          Créé par <UserName id={comment.user} />
                        </p>
                        <div className="tw-max-w-fit tw-basis-1/2">
                          <TagTeam teamId={comment.team} />
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

interface CommentDisplayProps {
  comment: Comment;
  onClose: () => void;
  onEditComment: () => void;
  color?: string;
  canToggleGroupCheck?: boolean;
  canToggleShareComment?: boolean;
  canToggleUrgentCheck?: boolean;
}

function CommentDisplay({ comment, onClose, onEditComment, color = "main" }: CommentDisplayProps) {
  const user = useRecoilValue(userState);

  const isEditable = useMemo(() => {
    if (comment.user === user?._id) return true;
    return false;
  }, [comment, user]);

  return (
    <>
      <ModalContainer open size="4xl">
        <ModalHeader title="Commentaire" />
        <ModalBody className="tw-px-4 tw-py-2">
          <div className="tw-grid tw-w-full sm:tw-grid-cols-2 tw-gap-6 tw-py-4">
            <div className="[overflow-wrap:anywhere]">
              <div className="tw-text-sm tw-font-semibold tw-text-gray-600">Créé par</div>
              <UserName id={comment.user} />
            </div>
            <div className="[overflow-wrap:anywhere]">
              <div className="tw-text-sm tw-font-semibold tw-text-gray-600">Créé le / Concerne le</div>
              <div>
                <CustomFieldDisplay type="date" value={comment.date || comment.createdAt} />
              </div>
            </div>
            <div className="sm:tw-col-span-2">
              <div className="tw-basis-full [overflow-wrap:anywhere]">
                <div className="tw-text-sm tw-font-semibold tw-text-gray-600">Commentaire</div>
                <div>
                  <CustomFieldDisplay type="textarea" value={comment.comment} />
                </div>
              </div>
            </div>
            {comment.urgent || comment.group || comment.share ? (
              <div className="tw-flex tw-gap-8">
                {comment.urgent ? (
                  <div className="tw-flex tw-flex-1 tw-flex-col">
                    <div>✓ Commentaire prioritaire</div>
                    <div className="tw-text-xs tw-text-zinc-500">Ce commentaire est mis en avant par rapport aux autres</div>
                  </div>
                ) : null}
                {comment.group ? (
                  <div className="tw-flex tw-flex-1 tw-flex-col">
                    <div>✓ Commentaire familial</div>
                    <div className="tw-text-xs tw-text-zinc-500">Ce commentaire est valable pour chaque membre de la famille</div>
                  </div>
                ) : null}
                {comment.share ? (
                  <div className="tw-flex tw-flex-1 tw-flex-col">
                    <div>✓ Commentaire médical partagé</div>
                    <div className="tw-text-xs tw-text-zinc-500">Ce commentaire médical est partagé avec les professionnels non-médicaux</div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="[overflow-wrap:anywhere]">
              <div className="tw-text-sm tw-font-semibold tw-text-gray-600">Équipe</div>
              <TagTeam teamId={comment.team} />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            name="cancel"
            className="button-cancel"
            onClick={() => {
              onClose();
            }}
          >
            Fermer
          </button>
          <button type="submit" onClick={onEditComment} className={`button-submit !tw-bg-${color}`} disabled={!isEditable}>
            Modifier
          </button>
        </ModalFooter>
      </ModalContainer>
    </>
  );
}

interface CommentModalProps {
  comment?: Partial<Comment>;
  isNewComment: boolean;
  onClose: () => void;
  onDelete: (comment: Partial<Comment>) => Promise<void>;
  onSubmit: (comment: Partial<Comment>, isNew: boolean) => Promise<void>;
  canToggleGroupCheck: boolean;
  canToggleUrgentCheck: boolean;
  canToggleShareComment: boolean;
  typeForNewComment: "person" | "action" | "passage" | "rencontre" | "consultation" | "treatment" | "medical-file";
  actionId?: string | null;
  personId?: string | null;
  color: string;
}

function CommentModal({
  comment = {},
  isNewComment,
  onClose,
  onDelete,
  onSubmit,
  canToggleGroupCheck,
  canToggleUrgentCheck,
  canToggleShareComment,
  typeForNewComment,
  actionId,
  personId,
  color,
}: CommentModalProps) {
  const user = useRecoilValue(userState);
  const organisation = useRecoilValue(organisationState);
  const currentTeam = useRecoilValue(currentTeamState);
  const teams = useRecoilValue(teamsState);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEditable = useMemo(() => {
    if (isNewComment) return true;
    if (comment.user === user?._id) return true;
    return false;
  }, [comment.user, isNewComment, user]);

  return (
    <>
      <ModalContainer
        open
        onClose={() => {
          window.sessionStorage.removeItem("currentComment");
          onClose();
        }}
        size="4xl"
      >
        <ModalHeader title={isNewComment ? "Créer un commentaire" : "Éditer le commentaire"} />
        <Formik
          initialValues={{
            urgent: false,
            group: false,
            share: false,
            team: currentTeam._id,
            ...comment,
            comment: comment.comment || window.sessionStorage.getItem("currentComment"),
          }}
          onSubmit={async (body, actions) => {
            if (!body.date && !isNewComment) return toast.error("La date est obligatoire");
            if (!body.comment) return toast.error("Le commentaire est obligatoire");
            if (!isNewComment && (!body.date || outOfBoundariesDate(body.date)))
              return toast.error("La date de création est hors limites (entre 1900 et 2100)");

            const commentBody: Partial<Comment> = {
              comment: body.comment,
              urgent: body.urgent || false,
              group: body.group || false,
              share: body.share || false,
              user: user._id,
              date: body.date || new Date(),
              team: body.team || currentTeam._id,
              organisation: organisation._id, // TODO: vérifier si ça a du sens
              type: comment.type ?? typeForNewComment,
              action: actionId ?? body.action,
              person: personId ?? body.person,
            };

            if (comment._id) commentBody._id = comment._id;
            if (commentBody.type === "person" && !commentBody.person) throw new Error("person is required");
            if (!isNewComment && comment.user !== user._id) {
              commentBody.comment = `${commentBody.comment}\n\nModifié par ${user.name} le ${dayjsInstance().format("DD/MM/YYYY à HH:mm")}`;
            }

            await onSubmit(commentBody, isNewComment);

            actions.setSubmitting(false);
            window.sessionStorage.removeItem("currentComment");
            onClose();
          }}
        >
          {({ values, handleChange, isSubmitting, handleSubmit }) => (
            <React.Fragment>
              <ModalBody className="tw-px-4 tw-py-4">
                <div className="tw-grid sm:tw-grid-cols-2 tw-w-full tw-gap-x-8 tw-gap-y-4">
                  <div className="tw-flex tw-flex-col">
                    <label htmlFor="user">Créé par</label>
                    <SelectUser
                      inputId="user"
                      isDisabled={true}
                      value={values.user || user._id}
                      onChange={(userId) => handleChange({ target: { value: userId, name: "user" } })}
                    />
                  </div>
                  <div className="tw-flex tw-flex-col">
                    <label htmlFor="date">Créé le / Concerne le</label>
                    <DatePicker
                      required
                      withTime
                      disabled={!isEditable}
                      id="date"
                      defaultValue={(values.date || values.createdAt) ?? new Date()}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="tw-flex sm:tw-col-span-2 tw-flex-col">
                    <label htmlFor="comment">Commentaire</label>
                    <div className="tw-block tw-w-full tw-overflow-hidden tw-rounded tw-border tw-border-gray-300 tw-text-base tw-transition-all">
                      <AutoResizeTextarea
                        id="comment"
                        name="comment"
                        placeholder="Tapez votre commentaire ici..."
                        value={values.comment || ""}
                        rows={7}
                        onChange={(e) => {
                          window.sessionStorage.setItem("currentComment", e.target.value);
                          handleChange(e);
                        }}
                      />
                    </div>
                  </div>

                  {canToggleUrgentCheck || canToggleGroupCheck || canToggleShareComment ? (
                    <div className="tw-flex tw-flex-col tw-gap-4">
                      {canToggleUrgentCheck ? (
                        <div className="tw-flex tw-flex-col">
                          <label htmlFor="create-comment-urgent" className="tw-mb-0 tw-text-left">
                            <input
                              type="checkbox"
                              id="create-comment-urgent"
                              className="tw-mr-2"
                              name="urgent"
                              checked={values.urgent}
                              onChange={handleChange}
                            />
                            Commentaire prioritaire
                          </label>
                          <div className="tw-text-xs tw-text-zinc-500">Ce commentaire sera mis en avant par rapport aux autres</div>
                        </div>
                      ) : null}
                      {canToggleGroupCheck ? (
                        <div className="tw-flex tw-flex-col">
                          <label htmlFor="create-comment-for-group" className="tw-mb-0">
                            <input
                              type="checkbox"
                              className="tw-mr-2"
                              id="create-comment-for-group"
                              name="group"
                              checked={values.group}
                              onChange={handleChange}
                            />
                            Commentaire familial
                          </label>
                          <div className="tw-text-xs tw-text-zinc-500">Ce commentaire sera valable pour chaque membre de la famille</div>
                        </div>
                      ) : null}
                      {canToggleShareComment ? (
                        <div className="tw-flex tw-flex-col">
                          <label htmlFor="create-comment-for-share" className="tw-mb-0">
                            <input
                              type="checkbox"
                              className="tw-mr-2"
                              id="create-comment-for-share"
                              name="share"
                              checked={values.share}
                              onChange={handleChange}
                            />
                            Commentaire médical partagé
                          </label>
                          <div className="tw-text-xs tw-text-zinc-500">Ce commentaire médical sera partagé avec les professionnels non-médicaux</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="tw-flex tw-flex-col">
                    <label htmlFor="observation-select-team">Sous l'équipe</label>
                    <SelectTeam
                      menuPlacement="top"
                      name="team"
                      teams={user.role === "admin" ? teams : user.teams}
                      teamId={values?.team}
                      onChange={(team) => handleChange({ target: { value: team._id, name: "team" } })}
                      inputId="observation-select-team"
                      classNamePrefix="observation-select-team"
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <button
                  type="button"
                  name="cancel"
                  className="button-cancel"
                  disabled={isDeleting || isSubmitting}
                  onClick={() => {
                    window.sessionStorage.removeItem("currentComment");
                    onClose();
                  }}
                >
                  Annuler
                </button>
                {!isNewComment && (
                  <button
                    type="button"
                    className="button-destructive"
                    disabled={isSubmitting || !isEditable || isDeleting}
                    onClick={async () => {
                      setIsDeleting(true);
                      if (window.confirm("Voulez-vous vraiment supprimer ce commentaire ?")) {
                        window.sessionStorage.removeItem("currentComment");
                        await onDelete(comment);
                        onClose();
                      }
                      setIsDeleting(false);
                    }}
                  >
                    {isDeleting ? "Suppression en cours..." : "Supprimer"}
                  </button>
                )}
                <button
                  type="submit"
                  onClick={handleSubmit as (e: unknown) => void}
                  className={`button-submit !tw-bg-${color}`}
                  disabled={isSubmitting || isDeleting}
                >
                  {isSubmitting ? "Enregistrement en cours..." : "Enregistrer"}
                </button>
              </ModalFooter>
            </React.Fragment>
          )}
        </Formik>
      </ModalContainer>
    </>
  );
}
