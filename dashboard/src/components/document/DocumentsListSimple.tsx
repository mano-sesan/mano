import { useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAtomValue } from "jotai";
import { userState, organisationAuthentifiedState } from "../../atoms/auth";
import type { DocumentWithLinkedItem, Document, FolderWithLinkedItem } from "../../types/document";
import type { UUIDV4 } from "../../types/uuid";
import UserName from "../UserName";
import PersonName from "../PersonName";
import { formatDateTimeWithNameOfDay } from "../../services/date";
import { DocumentModal } from "./DocumentModal";
import { handleFilesUpload } from "./DocumentsUpload";
import { UserGroupIcon } from "@heroicons/react/16/solid";

type Color = "main" | "blue-900";

interface DocumentsListSimpleProps {
  documents: Array<DocumentWithLinkedItem | FolderWithLinkedItem>;
  personId: UUIDV4 | UUIDV4[];
  color?: Color;
  showAddDocumentButton?: boolean;
  showAssociatedItem?: boolean;
  canToggleGroupCheck?: boolean;
  onAddDocuments?: (documents: Document[]) => Promise<void>;
  onDeleteDocument: (document: DocumentWithLinkedItem) => Promise<boolean>;
  onSubmitDocument: (document: DocumentWithLinkedItem) => Promise<void>;
}

export default function DocumentsListSimple({
  documents,
  personId,
  color = "main",
  showAddDocumentButton = true,
  showAssociatedItem = true,
  canToggleGroupCheck = false,
  onAddDocuments,
  onDeleteDocument,
  onSubmitDocument,
}: DocumentsListSimpleProps) {
  const organisation = useAtomValue(organisationAuthentifiedState);
  const user = useAtomValue(userState);

  const [documentToEdit, setDocumentToEdit] = useState<DocumentWithLinkedItem | null>(null);
  const [isInDropzone, setIsInDropzone] = useState(false);
  const [resetFileInputKey, setResetFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onlyDocuments = useMemo(() => documents.filter((d) => d.type === "document") as DocumentWithLinkedItem[], [documents]);
  const resolvedPersonId = useMemo(() => (Array.isArray(personId) ? personId[0] : personId), [personId]);

  const canUpload = showAddDocumentButton && !!onAddDocuments;

  return (
    <div
      className="tw-relative tw-h-full"
      onDragEnter={(e) => {
        if (!canUpload) return;
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        if (!isInDropzone) setIsInDropzone(true);
      }}
      onDragOver={(e) => {
        if (!canUpload) return;
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
      }}
    >
      {canUpload && isInDropzone && (
        <div
          className={[
            "tw-absolute tw-inset-0 tw-bg-white tw-flex tw-items-center tw-justify-center tw-border-dashed tw-border-4 tw-z-50",
            `tw-border-${color} tw-text-${color}`,
          ].join(" ")}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setIsInDropzone(false);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsInDropzone(false);
            if (!onAddDocuments) return;
            const docsResponses = await handleFilesUpload({
              files: e.dataTransfer.files,
              personId,
              user,
            });
            if (Array.isArray(docsResponses) && docsResponses.length) await onAddDocuments(docsResponses);
          }}
        >
          <div className="tw-mb-2 tw-mt-8 tw-w-full tw-text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="tw-mx-auto tw-h-16 tw-w-16"
              width={24}
              height={24}
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            Déposer vos fichiers ici
          </div>
        </div>
      )}

      {canUpload && (
        <>
          <div className="tw-my-1.5 tw-flex tw-justify-center tw-self-center">
            <button
              type="button"
              className={`button-submit mb-0 !tw-bg-${color}`}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Ajouter des documents"
            >
              ＋ Ajouter des documents
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            key={resetFileInputKey}
            className="tw-hidden"
            onClick={(e) => {
              // Match legacy behavior (actions can have multiple persons).
              if (!personId || (Array.isArray(personId) && personId.length === 0)) {
                e.preventDefault();
                toast.error("Veuillez sélectionner une personne auparavant");
                return;
              }
              if (Array.isArray(personId) && personId.length > 1) {
                e.preventDefault();
                toast.error(
                  "Ajouter un document pour une action concernant plusieurs personnes n'est pas possible. Veuillez sélectionner uniquement une personne."
                );
              }
            }}
            onChange={async (e) => {
              if (!onAddDocuments) return;
              const docsResponses = await handleFilesUpload({
                files: e.target.files,
                personId,
                user,
              });
              if (Array.isArray(docsResponses) && docsResponses.length) await onAddDocuments(docsResponses);
              setResetFileInputKey((k) => k + 1);
            }}
          />
        </>
      )}

      {!onlyDocuments.length ? (
        <div className="tw-flex tw-flex-col tw-items-center tw-gap-6 tw-pb-6">
          <div className="tw-mb-2 tw-mt-8 tw-w-full tw-text-center tw-text-gray-300">Aucun document pour le moment</div>
        </div>
      ) : (
        <table className="tw-w-full tw-table-fixed">
          <tbody className="tw-text-sm">
            {onlyDocuments.map((doc, index) => {
              const isLinkedToOtherPerson = !!organisation.groupsEnabled && !!doc.group && resolvedPersonId !== doc.linkedItem?._id;
              return (
                <tr
                  key={doc._id}
                  data-test-id={doc.downloadPath}
                  aria-label={`Document ${doc.name}`}
                  className={[`tw-w-full tw-border-t tw-border-zinc-200 tw-bg-${color}`, index % 2 ? "tw-bg-opacity-0" : "tw-bg-opacity-5"].join(" ")}
                  onClick={() => setDocumentToEdit(doc)}
                >
                  <td className="tw-p-3">
                    <p className="tw-m-0 tw-flex tw-items-center tw-overflow-hidden tw-font-bold">
                      {!!organisation.groupsEnabled && !!doc.group && (
                        <UserGroupIcon className="tw-mr-2 tw-w-6 tw-h-6 tw-text-main" aria-label="Document familial" title="Document familial" />
                      )}
                      {doc.name}
                    </p>
                    {isLinkedToOtherPerson && (
                      <p className="tw--xs tw-m-0 tw-mt-1">
                        Ce document est lié à <PersonName item={{ person: doc.linkedItem._id }} />
                      </p>
                    )}
                    <div className="tw-flex tw-text-xs">
                      <div className="tw-flex-1 tw-grow">
                        <p className="tw-m-0 tw-mt-1">{formatDateTimeWithNameOfDay(doc.createdAt)}</p>
                        <p className="tw-m-0">
                          Créé par <UserName id={doc.createdBy} />
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {!!documentToEdit && (
        <DocumentModal
          document={documentToEdit}
          key={documentToEdit._id}
          personId={resolvedPersonId as UUIDV4}
          onClose={() => setDocumentToEdit(null)}
          onDelete={onDeleteDocument}
          onSubmit={onSubmitDocument}
          canToggleGroupCheck={canToggleGroupCheck}
          showAssociatedItem={showAssociatedItem}
          color={color}
        />
      )}
    </div>
  );
}
