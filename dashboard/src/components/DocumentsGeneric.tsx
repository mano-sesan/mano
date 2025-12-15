import { useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useHistory, useLocation } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { userState, organisationAuthentifiedState, userAuthentifiedState } from "../atoms/auth";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "./tailwind/Modal";
import { formatDateTimeWithNameOfDay } from "../services/date";
import { FullScreenIcon } from "../assets/icons/FullScreenIcon";
import UserName from "./UserName";
import type { DocumentWithLinkedItem, Document, FolderWithLinkedItem, Folder } from "../types/document";
import type { UUIDV4 } from "../types/uuid";
import PersonName from "./PersonName";
import { toast } from "react-toastify";
import DocumentsOrganizer from "./DocumentsOrganizer";
import { defaultModalActionState, modalActionState } from "../atoms/modal";
import { itemsGroupedByActionSelector } from "../atoms/selectors";
import { capture } from "../services/sentry";
// Shared implementations (used by both legacy + new document UIs).
import { UploadProgressProvider, handleFilesUpload } from "./document/DocumentsUpload";
import { ButtonDownloadAll } from "./document/ButtonDownloadAll";
import { DocumentModal } from "./document/DocumentModal";

export { UploadProgressProvider, handleFilesUpload, ButtonDownloadAll, DocumentModal };

interface DocumentsModuleProps<T> {
  documents: T[];
  title?: string;
  personId: UUIDV4;
  showPanel?: boolean;
  showAssociatedItem?: boolean;
  showAddDocumentButton?: boolean;
  canToggleGroupCheck?: boolean;
  socialOrMedical: "social" | "medical";
  onDeleteDocument: (item: DocumentWithLinkedItem) => Promise<boolean>;
  onSubmitDocument: (item: T) => Promise<void>;
  onAddDocuments?: (items: Array<Document | Folder>) => Promise<void>;
  onSaveNewOrder?: (items: T[]) => Promise<boolean>;
  onDeleteFolder?: (item: FolderWithLinkedItem) => Promise<boolean>;
  color?: "main" | "blue-900";
  tableWithFolders?: boolean;
}

export function DocumentsModule<T extends DocumentWithLinkedItem | FolderWithLinkedItem>({
  documents = [],
  title = "Documents",
  socialOrMedical,
  personId,
  showPanel = false,
  tableWithFolders = false,
  canToggleGroupCheck = false,
  showAssociatedItem = true,
  showAddDocumentButton = true,
  onDeleteDocument,
  onSubmitDocument,
  onAddDocuments,
  onSaveNewOrder,
  onDeleteFolder = async () => false,
  color = "main",
}: DocumentsModuleProps<T>) {
  if (!onDeleteDocument) throw new Error("onDeleteDocument is required");
  if (!onSubmitDocument) throw new Error("onSubmitDocument is required");
  const [documentToEdit, setDocumentToEdit] = useState<DocumentWithLinkedItem | null>(null);
  const [folderToEdit, setFolderToEdit] = useState<FolderWithLinkedItem | null>(null);
  const [addFolder, setAddFolder] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  const withDocumentOrganizer = !!onSaveNewOrder;
  if (withDocumentOrganizer) {
    if (!onSaveNewOrder) throw new Error("onSaveNewOrder is required");
    if (!onDeleteFolder) throw new Error("onDeleteFolder is required");
  }
  const onlyDocuments = useMemo(() => documents.filter((d) => d.type !== "folder") as DocumentWithLinkedItem[], [documents]) as T[];

  return (
    <>
      {showPanel ? (
        <DocumentsDropZone
          showAddDocumentButton={showAddDocumentButton}
          personId={personId}
          onAddDocuments={onAddDocuments}
          className="tw-h-full"
          color={color}
        >
          <div className="tw-sticky tw-top-0 tw-z-10 tw-flex tw-items-center tw-bg-white tw-p-3">
            <h4 className="tw-flex-1 tw-text-xl">Documents {onlyDocuments.length ? `(${onlyDocuments.length})` : ""}</h4>
            <div className="tw-flex tw-items-center tw-gap-2">
              <label
                aria-label="Ajouter des documents"
                className={`tw-text-md tw-mb-0 tw-h-8 tw-w-8 tw-cursor-pointer tw-rounded-full tw-font-bold tw-text-white tw-transition hover:tw-scale-125 tw-bg-${color} tw-inline-flex tw-items-center tw-justify-center`}
              >
                ＋
                <AddDocumentInput onAddDocuments={onAddDocuments} personId={personId} />
              </label>
              <button
                title="Passer les documents en plein écran"
                className={`tw-h-6 tw-w-6 tw-rounded-full tw-text-${color} tw-transition hover:tw-scale-125`}
                onClick={() => setFullScreen(true)}
              >
                <FullScreenIcon />
              </button>
            </div>
          </div>
          {tableWithFolders ? (
            <DocumentTableWithFolders
              withClickableLabel
              documents={documents as DocumentWithLinkedItem[]}
              color={color}
              onDisplayDocument={setDocumentToEdit}
              onAddDocuments={onAddDocuments}
              onFolderClick={setFolderToEdit}
              // Already in the panel (see above)
              // Still we want to display if no document at all.
              showAddDocumentButton={!onlyDocuments.length}
              personId={personId}
            />
          ) : (
            <DocumentTable
              withClickableLabel
              documents={onlyDocuments as DocumentWithLinkedItem[]}
              color={color}
              onDisplayDocument={setDocumentToEdit}
              onAddDocuments={onAddDocuments}
              // Already in the panel (see above)
              // Still we want to display if no document at all.
              showAddDocumentButton={!onlyDocuments.length}
              personId={personId}
            />
          )}
        </DocumentsDropZone>
      ) : (
        <DocumentsDropZone
          showAddDocumentButton={showAddDocumentButton}
          personId={personId}
          onAddDocuments={onAddDocuments}
          className="tw-h-full"
          color={color}
        >
          <DocumentTable
            documents={onlyDocuments as DocumentWithLinkedItem[]}
            color={color}
            onDisplayDocument={setDocumentToEdit}
            onAddDocuments={onAddDocuments}
            showAddDocumentButton={showAddDocumentButton}
            personId={personId}
          />
        </DocumentsDropZone>
      )}
      {!!documentToEdit && (
        <DocumentModal
          document={documentToEdit}
          key={documentToEdit.name}
          personId={personId}
          onClose={() => setDocumentToEdit(null)}
          onDelete={onDeleteDocument}
          onSubmit={(item: DocumentWithLinkedItem) => onSubmitDocument(item as T)}
          canToggleGroupCheck={canToggleGroupCheck}
          color={color}
          showAssociatedItem={showAssociatedItem}
        />
      )}
      {withDocumentOrganizer && (!!addFolder || !!folderToEdit) && (
        <FolderModal
          key={`${addFolder}${folderToEdit?._id}`}
          folder={folderToEdit}
          onClose={() => {
            setFolderToEdit(null);
            setAddFolder(false);
          }}
          onDelete={onDeleteFolder}
          onSubmit={(item: FolderWithLinkedItem) => onSubmitDocument(item as T)}
          onAddFolder={(folder) => onAddDocuments([folder])}
          color={color}
        />
      )}
      <DocumentsFullScreen
        open={!!fullScreen}
        documents={withDocumentOrganizer ? documents : onlyDocuments}
        personId={personId}
        socialOrMedical={socialOrMedical}
        onDisplayDocument={setDocumentToEdit}
        onAddDocuments={onAddDocuments}
        onAddFolderRequest={() => setAddFolder(true)}
        onEditFolderRequest={setFolderToEdit}
        onSaveNewOrder={onSaveNewOrder}
        onClose={() => setFullScreen(false)}
        title={title}
        color={color}
      />
    </>
  );
}

interface DocumentsFullScreenProps<T> {
  open: boolean;
  documents: T[];
  socialOrMedical: "social" | "medical";
  personId: UUIDV4;
  onSaveNewOrder?: (documents: T[]) => Promise<boolean>;
  onEditFolderRequest: (folder: FolderWithLinkedItem) => void;
  onAddDocuments: (documents: Document[]) => Promise<void>;
  onDisplayDocument: (document: DocumentWithLinkedItem) => void;
  onClose: () => void;
  onAddFolderRequest: () => void;
  title: string;
  color: "main" | "blue-900";
}

function DocumentsFullScreen<T extends DocumentWithLinkedItem | FolderWithLinkedItem>({
  open,
  personId,
  documents,
  socialOrMedical,
  onClose,
  title,
  color,
  onDisplayDocument,
  onAddDocuments,
  onSaveNewOrder,
  onAddFolderRequest,
  onEditFolderRequest,
}: DocumentsFullScreenProps<T>) {
  const withDocumentOrganizer = !!onSaveNewOrder;
  const organisation = useAtomValue(organisationAuthentifiedState);
  const [enableDropZone, setEnableDropZone] = useState(true);
  const [debug, setDebug] = useState(false);

  return (
    <ModalContainer open={open} size={withDocumentOrganizer ? "full" : "prose"} onClose={onClose}>
      <ModalHeader title={title} />
      <ModalBody>
        <DocumentsDropZone enabled={enableDropZone} showAddDocumentButton personId={personId} onAddDocuments={onAddDocuments} color={color}>
          {!documents.length && (
            <div className="tw-flex tw-flex-col tw-items-center tw-gap-6 tw-pb-6">
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
                Aucun document pour le moment
              </div>
              <label aria-label="Ajouter des documents" className={`button-submit mb-0 !tw-bg-${color}`}>
                ＋ Ajouter des documents
                <AddDocumentInput onAddDocuments={onAddDocuments} personId={personId} />
              </label>
            </div>
          )}
          {withDocumentOrganizer ? (
            <div className="tw-min-h-1/2 ">
              {socialOrMedical === "social" && (
                <>
                  <DocumentsOrganizer
                    debug={debug}
                    onDragStart={() => setEnableDropZone(false)}
                    onDragEnd={() => setEnableDropZone(true)}
                    items={documents
                      .filter((doc) => {
                        if (doc.type === "document") {
                          const document = doc as DocumentWithLinkedItem;
                          if (document.group) return false;
                        }
                        return true;
                      })
                      .map((doc) => {
                        if (doc.parentId) return doc;
                        return {
                          ...doc,
                          parentId: "root",
                        };
                      })}
                    onSave={(newOrder) => {
                      const ok = onSaveNewOrder(newOrder);
                      if (!ok) onClose();
                      return ok;
                    }}
                    htmlId="social"
                    onFolderClick={onEditFolderRequest}
                    onDocumentClick={onDisplayDocument}
                    color={color}
                  />
                  {!!organisation.groupsEnabled && (
                    <DocumentsOrganizer
                      debug={debug}
                      onDragStart={() => setEnableDropZone(false)}
                      onDragEnd={() => setEnableDropZone(true)}
                      items={documents
                        .filter((item) => {
                          if (item.type !== "document") return false;
                          const doc = item as DocumentWithLinkedItem;
                          return !!doc.group;
                        })
                        .map((doc) => {
                          return {
                            ...doc,
                            parentId: "root",
                          };
                        })}
                      htmlId="family"
                      rootFolderName="👪 Documents familiaux"
                      onSave={(newOrder) => {
                        const ok = onSaveNewOrder(newOrder);
                        if (!ok) onClose();
                        return ok;
                      }}
                      onFolderClick={onEditFolderRequest}
                      onDocumentClick={onDisplayDocument}
                      color={color}
                    />
                  )}
                </>
              )}
              {socialOrMedical === "medical" && (
                <DocumentsOrganizer
                  debug={debug}
                  onDragStart={() => setEnableDropZone(false)}
                  onDragEnd={() => setEnableDropZone(true)}
                  htmlId="medical"
                  items={documents}
                  onSave={(newOrder) => {
                    const ok = onSaveNewOrder(newOrder);
                    if (!ok) onClose();
                    return ok;
                  }}
                  onFolderClick={onEditFolderRequest}
                  onDocumentClick={onDisplayDocument}
                  color={color}
                />
              )}
            </div>
          ) : (
            <DocumentTable
              documents={documents as DocumentWithLinkedItem[]}
              onDisplayDocument={onDisplayDocument}
              onAddDocuments={onAddDocuments}
              withClickableLabel
              color={color}
              personId={personId}
            />
          )}
        </DocumentsDropZone>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          name="cancel"
          className="button-cancel tw-mr-auto tw-opacity-5 hover:tw-opacity-100"
          onClick={() => setDebug((d) => !d)}
        >
          Debug
        </button>
        <button type="button" name="cancel" className="button-cancel" onClick={onClose}>
          Fermer
        </button>
        <ButtonDownloadAll documents={documents as DocumentWithLinkedItem[]} />
        <label aria-label="Ajouter des documents" className={`button-submit mb-0 !tw-bg-${color}`}>
          ＋ Ajouter des documents
          <AddDocumentInput onAddDocuments={onAddDocuments} personId={personId} />
        </label>
        {!!withDocumentOrganizer && (
          <button type="button" onClick={onAddFolderRequest} className={`button-submit mb-0 !tw-bg-${color}`}>
            ＋ Ajouter un dossier
          </button>
        )}
      </ModalFooter>
    </ModalContainer>
  );
}

interface DocumentTableProps {
  documents: DocumentWithLinkedItem[];
  personId: UUIDV4;
  onAddDocuments: (documents: Document[]) => Promise<void>;
  onDisplayDocument: (document: DocumentWithLinkedItem) => void;
  color: "main" | "blue-900";
  showAddDocumentButton?: boolean;
  withClickableLabel?: boolean;
  onFolderClick?: (folder: FolderWithLinkedItem) => void;
}

export function DocumentTableWithFolders({
  documents,
  onDisplayDocument,
  personId,
  color,
  showAddDocumentButton,
  withClickableLabel,
  onFolderClick,
  onAddDocuments,
}: DocumentTableProps) {
  const organisation = useAtomValue(organisationAuthentifiedState);

  const sortedDocuments = useMemo(() => {
    const flattenTree = (
      items: DocumentWithLinkedItem[],
      parentId: string = "root",
      level: number = 0,
      visitedIds: Set<string> = new Set()
    ): ((DocumentWithLinkedItem | FolderWithLinkedItem) & { tabLevel: number; isEmpty?: boolean })[] => {
      // If we've seen this parentId before, we have a cycle - stop recursing
      if (visitedIds.has(parentId)) {
        console.warn(`Detected circular reference in document structure with ID: ${parentId}`);
        capture(new Error(`Detected circular reference in document structure with ID: ${parentId}`), {
          extra: {
            documents: documents.map((doc) => ({
              _id: doc._id,
              name: doc.name,
              parentId: doc.parentId,
              position: doc.position,
            })),
          },
        });
        return [];
      }

      // Add current parentId to visited set
      visitedIds.add(parentId);

      // const children = items.filter((item) => (!item.parentId && parentId === "root") || item.parentId === parentId);
      const children = items.filter((item) => {
        if (!item.parentId && parentId === "root") return true;
        if (item.parentId === parentId) return true;
        return false;
      });

      return children
        .sort((a, b) => {
          if (!a.position && a.position !== 0) return 1;
          if (!b.position && b.position !== 0) return -1;
          return a.position - b.position;
        })
        .reduce(
          (acc, item) => {
            // Pass the visited set to track the path
            const subItems = flattenTree(items, item._id, level + 1, new Set(visitedIds));
            const isEmpty = !items.some((doc) => doc.parentId === item._id);
            return [...acc, { ...item, tabLevel: level, isEmpty }, ...subItems];
          },
          [] as ((DocumentWithLinkedItem | FolderWithLinkedItem) & { tabLevel: number; isEmpty?: boolean })[]
        );
    };

    const documentsWithNoBug = documents.filter((item) => {
      if (item._id === item.parentId) return false; // to avoid infinite loop, caused by a bug somewhere
      return true;
    });
    return flattenTree(documentsWithNoBug);
  }, [documents]);

  if (!documents.length) {
    return <NoDocumentsInTable showAddDocumentButton={showAddDocumentButton} color={color} onAddDocuments={onAddDocuments} personId={personId} />;
  }

  return (
    <div className="tw-flex tw-flex-col tw-gap-2 tw-text-sm tw-px-4">
      {sortedDocuments.map((doc) => (
        <div
          onClick={() => {
            if (doc.type !== "folder") {
              onDisplayDocument(doc);
            } else if (doc.movable !== false) {
              onFolderClick?.(doc);
            }
          }}
          aria-label={`Document ${doc.name}`}
          data-test-id={doc.type === "folder" ? undefined : doc.downloadPath}
          key={doc._id}
          style={{ marginLeft: `${doc.tabLevel * 20}px` }}
          className={[
            "tw-flex tw-items-center tw-gap-y-2 tw-gap-x-1 tw-text-left",
            doc.movable !== false ? "tw-cursor-pointer hover:tw-bg-gray-100" : "tw-cursor-default",
          ].join(" ")}
        >
          <div>{doc.type === "folder" ? "📁" : "📄"}</div>
          {!!organisation.groupsEnabled && doc.type === "document" && doc.group && (
            <div aria-label="Document familial" title="Document familial">
              👪
            </div>
          )}
          <div className="tw-flex-1 tw-grow tw-truncate">
            {doc.type === "folder" && doc.isEmpty ? (
              <div className="tw-ml-1 tw-text-gray-500">
                {doc.name} <span className="tw-italic tw-text-xs">[vide]</span>
              </div>
            ) : (
              doc.name
            )}
          </div>
          {!!withClickableLabel && doc.type === "document" && !["medical-file", "person"].includes(doc.linkedItem?.type) && (
            <ClickableLabel doc={doc} color={color} />
          )}
        </div>
      ))}
    </div>
  );
}

function NoDocumentsInTable({
  showAddDocumentButton,
  color,
  onAddDocuments,
  personId,
}: {
  showAddDocumentButton: boolean;
  color: "main" | "blue-900";
  onAddDocuments: (documents: Document[]) => Promise<void>;
  personId: UUIDV4;
}) {
  return (
    <div className="tw-flex tw-flex-col tw-items-center tw-gap-6 tw-pb-6">
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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        Aucun document pour le moment
      </div>
      {showAddDocumentButton && (
        <label aria-label="Ajouter des documents" className={`button-submit mb-0 !tw-bg-${color}`}>
          ＋ Ajouter des documents
          <AddDocumentInput onAddDocuments={onAddDocuments} personId={personId} />
        </label>
      )}
    </div>
  );
}

export function ClickableLabel({ doc, color }: { doc: DocumentWithLinkedItem; color: "main" | "blue-900" }) {
  const actionsObjects = useAtomValue(itemsGroupedByActionSelector);
  const setModalAction = useSetAtom(modalActionState);
  const location = useLocation();
  const history = useHistory();
  return (
    <div>
      {doc.linkedItem.type === "action" ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setModalAction({
              ...defaultModalActionState(),
              open: true,
              from: location.pathname,
              action: actionsObjects[doc.linkedItem._id],
            });
          }}
          type="button"
          className={`tw-rounded tw-border tw-border-${color} tw-bg-${color} tw-bg-opacity-10 tw-px-1`}
        >
          Action
        </button>
      ) : doc.linkedItem.type === "consultation" ? (
        <button
          type="button"
          className={`tw-rounded tw-border tw-border-${color} tw-bg-${color} tw-bg-opacity-10 tw-px-1`}
          onClick={(e) => {
            e.stopPropagation();
            const searchParams = new URLSearchParams(history.location.search);
            searchParams.set("consultationId", doc.linkedItem._id);
            history.push(`?${searchParams.toString()}`);
          }}
        >
          Consultation
        </button>
      ) : doc.linkedItem.type === "treatment" ? (
        <button
          type="button"
          className={`tw-rounded tw-border tw-border-${color} tw-bg-${color} tw-bg-opacity-10 tw-px-1`}
          onClick={(e) => {
            e.stopPropagation();
            const searchParams = new URLSearchParams(history.location.search);
            searchParams.set("treatmentId", doc.linkedItem._id);
            history.push(`?${searchParams.toString()}`);
          }}
        >
          Traitement
        </button>
      ) : (
        <></>
      )}
    </div>
  );
}

export function DocumentTable({
  documents,
  onDisplayDocument,
  personId,
  color,
  showAddDocumentButton,
  withClickableLabel,
  onAddDocuments,
}: DocumentTableProps) {
  const organisation = useAtomValue(organisationAuthentifiedState);
  if (!documents.length) {
    return <NoDocumentsInTable showAddDocumentButton={showAddDocumentButton} color={color} onAddDocuments={onAddDocuments} personId={personId} />;
  }

  return (
    <>
      {showAddDocumentButton && (
        <div className="tw-my-1.5 tw-flex tw-justify-center tw-self-center">
          <label aria-label="Ajouter des documents" className={`button-submit mb-0 !tw-bg-${color}`}>
            ＋ Ajouter des documents
            <AddDocumentInput onAddDocuments={onAddDocuments} personId={personId} />
          </label>
        </div>
      )}
      <table className="tw-w-full tw-table-fixed">
        <tbody className="tw-text-sm">
          {(documents || []).map((doc, index) => {
            return (
              <tr
                key={doc._id}
                data-test-id={doc.downloadPath}
                aria-label={`Document ${doc.name}`}
                className={[`tw-w-full tw-border-t tw-border-zinc-200 tw-bg-${color}`, index % 2 ? "tw-bg-opacity-0" : "tw-bg-opacity-5"].join(" ")}
                onClick={() => {
                  onDisplayDocument(doc);
                }}
              >
                <td className="tw-p-3">
                  <p className="tw-m-0 tw-flex tw-items-center tw-overflow-hidden tw-font-bold">
                    {!!organisation.groupsEnabled && !!doc.group && (
                      <span className="tw-mr-2 tw-text-xl" aria-label="Document familial" title="Document familial">
                        👪
                      </span>
                    )}
                    {doc.name}
                  </p>
                  {!!organisation.groupsEnabled && !!doc.group && personId !== doc.linkedItem._id && (
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
                    {!!withClickableLabel && !["medical-file", "person"].includes(doc.linkedItem?.type) && <ClickableLabel doc={doc} color={color} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

interface AddDocumentInputProps {
  personId: string;
  onAddDocuments: (documents: Document[]) => Promise<void>;
}

function AddDocumentInput({ personId, onAddDocuments }: AddDocumentInputProps) {
  const [resetFileInputKey, setResetFileInputKey] = useState(0); // to be able to use file input multiple times
  const user = useAtomValue(userState);

  return (
    <input
      type="file"
      multiple
      key={resetFileInputKey}
      name="file"
      className="tw-hidden"
      onClick={(e) => {
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
          return;
        }
      }}
      onChange={async (e) => {
        const docsResponses = await handleFilesUpload({
          files: e.target.files,
          personId,
          user,
        });
        if (docsResponses) {
          onAddDocuments(docsResponses);
        }
        setResetFileInputKey((k) => k + 1);
      }}
    />
  );
}

function DocumentsDropZone({ children, personId, onAddDocuments, color, className = "", showAddDocumentButton = false, enabled = true }) {
  // insipirations:
  // https://stackoverflow.com/a/35428657/5225096
  // https://stackoverflow.com/a/16403756/5225096
  // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop

  const user = useAtomValue(userState);
  const [isInDropzone, setIsInDropzone] = useState(false);

  if (!showAddDocumentButton) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={["tw-relative", className].filter(Boolean).join(" ")}
      onDragEnter={(e) => {
        e.preventDefault(); // Prevent default behavior (Prevent file from being opened)
        if (!enabled) return;
        if (!isInDropzone) setIsInDropzone(true);
      }}
      onDragOver={(e) => {
        e.preventDefault(); // Prevent default behavior (Prevent file from being opened)
      }}
    >
      {children}
      {isInDropzone && (
        <div
          className={[
            "tw-absolute tw-inset-0 tw-bg-white tw-flex tw-items-center tw-justify-center tw-border-dashed tw-border-4 tw-z-50",
            `tw-border-${color} tw-text-${color}`,
          ].join(" ")}
          onDragOver={(e) => {
            e.preventDefault(); // Prevent default behavior (Prevent file from being opened)
          }}
          onDragLeave={() => {
            if (isInDropzone) setIsInDropzone(false);
          }}
          onDrop={async (e) => {
            e.preventDefault(); // Prevent default behavior (Prevent file from being opened)
            setIsInDropzone(false);
            if (!enabled) return;
            const documentsResponse = await handleFilesUpload({ files: e.dataTransfer.files, personId, user });
            if (documentsResponse) {
              onAddDocuments(documentsResponse);
            }
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
    </div>
  );
}

interface FolderModalProps<T> {
  folder?: T | null;
  onClose: () => void;
  onDelete: (folder: T) => Promise<boolean>;
  onSubmit: (folder: T) => Promise<void>;
  onAddFolder: (items: Folder) => Promise<void>;
  color?: "main" | "blue-900";
}

export function FolderModal<T extends FolderWithLinkedItem | Folder>({
  folder,
  onClose,
  onDelete,
  onSubmit,
  onAddFolder,
  color,
}: FolderModalProps<T>) {
  const isNewFolder = !folder?._id;
  const user = useAtomValue(userAuthentifiedState);

  const initialName = useMemo(() => folder?.name, [folder?.name]);
  const [name, setName] = useState(initialName ?? "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      <ModalContainer open className="[overflow-wrap:anywhere]" size="prose">
        <ModalHeader title={isNewFolder ? "Créer un dossier" : "Éditer le dossier"} />
        <ModalBody className="tw-pb-4">
          <div className="tw-flex tw-w-full tw-flex-col tw-justify-between tw-gap-4 tw-px-8 tw-py-4">
            <form
              id="edit-folder-form"
              className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!name) {
                  toast.error("Veuillez saisir un nom");
                  return false;
                }
                setIsUpdating(true);
                if (isNewFolder) {
                  const nextFolder: Folder = {
                    _id: uuid(),
                    name,
                    createdAt: new Date(),
                    createdBy: user._id,
                    parentId: "root",
                    position: undefined,
                    type: "folder",
                  };
                  await onAddFolder(nextFolder);
                } else {
                  await onSubmit({ ...folder, name });
                }
                setIsUpdating(false);
                setIsEditing(false);
                onClose();
                return true;
              }}
            >
              <div className="tw-flex tw-w-full tw-flex-col tw-gap-6">
                <div className="tw-flex tw-flex-1 tw-flex-col">
                  <label className={isEditing ? "" : `tw-text-sm tw-font-semibold tw-text-${color}`} htmlFor="folder-name">
                    Nom
                  </label>
                  <input
                    className="tailwindui"
                    autoComplete="off"
                    placeholder="Nouveau dossier"
                    id="folder-name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
            </form>
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
            Annuler
          </button>
          {!isNewFolder && (
            <button
              type="button"
              className="button-destructive"
              disabled={isUpdating}
              onClick={async () => {
                if (!window.confirm("Voulez-vous vraiment supprimer ce dossier ?")) return;
                await onDelete(folder);
                onClose();
              }}
            >
              Supprimer
            </button>
          )}
          <button type="submit" form="edit-folder-form" className={`button-submit !tw-bg-${color}`} disabled={isUpdating}>
            Enregistrer
          </button>
        </ModalFooter>
      </ModalContainer>
    </>
  );
}
