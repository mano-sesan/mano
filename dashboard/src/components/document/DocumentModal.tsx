import { useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useHistory, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { Cog6ToothIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import type { DocumentWithLinkedItem } from "../../types/document";
import type { UUIDV4 } from "../../types/uuid";
import API, { tryFetchBlob } from "../../services/api";
import { decryptFile, getHashedOrgEncryptionKey } from "../../services/encryption";
import { download, errorMessage } from "../../utils";
import { itemsGroupedByActionSelector } from "../../atoms/selectors";
import { defaultModalActionState, modalActionState } from "../../atoms/modal";
import { organisationState } from "../../atoms/auth";
import { formatDateTimeWithNameOfDay } from "../../services/date";
import PersonName from "../PersonName";
import UserName from "../UserName";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../tailwind/Modal";

interface DocumentModalProps<T extends DocumentWithLinkedItem> {
  document: T;
  personId: UUIDV4;
  onClose: () => void;
  onSubmit: (document: T) => Promise<void>;
  onDelete: (document: T) => Promise<boolean>;
  canToggleGroupCheck: boolean;
  showAssociatedItem: boolean;
  color: string;
  externalIsUpdating?: boolean;
  externalIsDeleting?: boolean;
}

export function DocumentModal<T extends DocumentWithLinkedItem>({
  document,
  onClose,
  personId,
  onDelete,
  onSubmit,
  showAssociatedItem,
  canToggleGroupCheck,
  color,
  externalIsUpdating,
  externalIsDeleting,
}: DocumentModalProps<T>) {
  const actionsObjects = useAtomValue(itemsGroupedByActionSelector);
  const setModalAction = useSetAtom(modalActionState);
  const organisation = useAtomValue(organisationState);
  const location = useLocation();
  const initialName = useMemo(() => document.name, [document.name]);
  const [name, setName] = useState(initialName);
  const [internalIsUpdating, setInternalIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const canSave = useMemo(() => isEditing && name !== initialName, [name, initialName, isEditing]);
  const history = useHistory();

  const isUpdating = externalIsUpdating !== undefined ? externalIsUpdating : internalIsUpdating;
  const isDeleting = externalIsDeleting !== undefined ? externalIsDeleting : false;

  const contentType = document.file.mimetype;

  const isLinkedToOtherPerson = !!document.group && personId !== document.linkedItem._id;

  return (
    <ModalContainer open className="[overflow-wrap:anywhere]" size="prose">
      <ModalHeader title={name} />
      <ModalBody className="tw-pb-4">
        <div className="tw-flex tw-w-full tw-flex-col tw-justify-between tw-gap-4 tw-px-8 tw-py-4">
          {isEditing ? (
            <form
              id="edit-document-form"
              className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (externalIsUpdating === undefined) setInternalIsUpdating(true);
                await onSubmit({ ...document, name });
                if (externalIsUpdating === undefined) setInternalIsUpdating(false);
                setIsEditing(false);
              }}
            >
              <label className={isEditing ? "" : `tw-text-sm tw-font-semibold tw-blue-${color}`} htmlFor="document-name">
                Nom
              </label>
              <input
                required
                className="tailwindui"
                autoComplete="off"
                id="document-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </form>
          ) : (
            <div className="tw-flex tw-w-full tw-items-center tw-justify-center tw-gap-2">
              <button
                type="button"
                className={`button-submit !tw-bg-${color}`}
                onClick={async () => {
                  const [error, blob] = await tryFetchBlob(() => {
                    return API.download({ path: document.downloadPath ?? `/person/${personId}/document/${document.file.filename}` });
                  });
                  if (error) {
                    toast.error(errorMessage(error) || "Une erreur est survenue lors du téléchargement du document");
                    return;
                  }
                  const file = await decryptFile(blob, document.encryptedEntityKey, getHashedOrgEncryptionKey());
                  download(file, name);
                  onClose();
                }}
              >
                Télécharger
              </button>
              {(contentType === "application/pdf" || contentType.startsWith("image/")) && (
                <button
                  type="button"
                  className={`button-submit tw-inline-flex tw-flex-col tw-items-center !tw-bg-${color}`}
                  onClick={async () => {
                    const [error, blob] = await tryFetchBlob(() => {
                      return API.download({ path: document.downloadPath ?? `/person/${personId}/document/${document.file.filename}` });
                    });
                    if (error) {
                      toast.error(errorMessage(error) || "Une erreur est survenue lors du téléchargement du document");
                      return;
                    }
                    const file = await decryptFile(blob, document.encryptedEntityKey, getHashedOrgEncryptionKey());

                    const viewableBlob = new Blob([file], { type: contentType });
                    const url = URL.createObjectURL(viewableBlob);

                    const newWindow = window.open(url, "_blank");
                    if (newWindow) {
                      newWindow.onload = () => {
                        URL.revokeObjectURL(url);
                      };
                    }
                  }}
                >
                  Ouvrir dans une nouvelle fenêtre
                </button>
              )}
            </div>
          )}

          {!!canToggleGroupCheck && document.linkedItem.type !== "action" && (
            <div>
              <label htmlFor="document-for-group">
                <input
                  type="checkbox"
                  disabled={isLinkedToOtherPerson}
                  className="tw-mr-2"
                  id="document-for-group"
                  name="group"
                  defaultChecked={document.group}
                  value={document?.group ? "true" : "false"}
                  onChange={async () => {
                    if (externalIsUpdating === undefined) setInternalIsUpdating(true);
                    await onSubmit({ ...document, group: !document.group });
                    if (externalIsUpdating === undefined) setInternalIsUpdating(false);
                    setIsEditing(false);
                  }}
                />
                Document familial
                <br />
                <small className="tw-block tw-text-gray-500">Ce document sera visible pour toute la famille</small>
              </label>
              {isLinkedToOtherPerson && (
                <div className="tw-rounded tw-border tw-mt-4 tw-border-orange-50 tw-mb-2 tw-bg-amber-100 tw-px-5 tw-py-3 tw-text-orange-900 tw-flex tw-items-center tw-gap-2 tw-text-sm">
                  <InformationCircleIcon className="tw-w-4 tw-h-4" />
                  <div>
                    Ce document est lié à{" "}
                    <b>
                      <PersonName item={{ person: document.linkedItem._id }} />
                    </b>
                    , vous devez aller sur sa fiche pour le modifier.
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="tw-text-sm tw-pt-4 tw-opacity-60 tw-flex tw-items-center tw-gap-1">
            Créé par <UserName id={document.createdBy} /> le {formatDateTimeWithNameOfDay(document.createdAt)}
            <button
              type="button"
              className="tw-ml-2 tw-inline-flex tw-items-center tw-justify-center hover:tw-text-main"
              onClick={() => setShowJson(!showJson)}
              title="Voir les données brutes"
              aria-label="Voir les données brutes"
            >
              <Cog6ToothIcon className="tw-h-4 tw-w-4" />
            </button>
          </div>
          {showJson && (
            <div className="tw-w-full tw-overflow-auto tw-rounded tw-bg-gray-100 tw-p-2 tw-text-xs tw-font-mono">
              <pre>{JSON.stringify(document, null, 2)}</pre>
            </div>
          )}
          {!!showAssociatedItem && document?.linkedItem?.type === "treatment" && (
            <button
              onClick={() => {
                const searchParams = new URLSearchParams(history.location.search);
                searchParams.set("treatmentId", document.linkedItem._id);
                history.push(`?${searchParams.toString()}`);
                onClose();
              }}
              className="button-classic"
            >
              Voir le traitement associé
            </button>
          )}
          {!!showAssociatedItem && document?.linkedItem?.type === "action" && (
            <button
              onClick={() => {
                setModalAction({
                  ...defaultModalActionState(),
                  open: true,
                  from: location.pathname,
                  action: actionsObjects[document.linkedItem._id],
                });
                onClose();
              }}
              className="button-classic"
            >
              Voir l'action associée
            </button>
          )}
          {!!showAssociatedItem && document?.linkedItem?.type === "consultation" && (
            <button
              onClick={() => {
                const searchParams = new URLSearchParams(history.location.search);
                searchParams.set("consultationId", document.linkedItem._id);
                history.push(`?${searchParams.toString()}`);
                onClose();
              }}
              className="button-classic"
            >
              Voir la consultation associée
            </button>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          name="cancel"
          className="button-cancel"
          disabled={isUpdating || isDeleting}
          onClick={() => {
            onClose();
          }}
        >
          Fermer
        </button>
        <button
          type="button"
          className="button-destructive"
          disabled={isUpdating || isDeleting || isLinkedToOtherPerson}
          onClick={async () => {
            if (!window.confirm("Voulez-vous vraiment supprimer ce document ?")) return;
            const ok = await onDelete(document);
            if (ok) onClose();
          }}
        >
          {isDeleting ? "Suppression..." : "Supprimer"}
        </button>
        {(isEditing || canSave) && (
          <button
            title="Sauvegarder ce document"
            type="submit"
            className={`button-submit !tw-bg-${color}`}
            form="edit-document-form"
            disabled={isUpdating || isDeleting}
          >
            {isUpdating ? "Enregistrement..." : "Sauvegarder"}
          </button>
        )}
        {!isEditing && (
          <button
            title="Modifier le nom de ce document"
            type="button"
            className={`button-submit !tw-bg-${color}`}
            disabled={isUpdating || isDeleting || isLinkedToOtherPerson}
            onClick={(e) => {
              e.preventDefault();
              setIsEditing(true);
            }}
          >
            Modifier
          </button>
        )}
      </ModalFooter>
    </ModalContainer>
  );
}
