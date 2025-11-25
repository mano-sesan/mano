import { useMemo, useState, useEffect } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { useHistory, useLocation } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { FolderIcon } from "@heroicons/react/24/outline";
import { userState, organisationAuthentifiedState, userAuthentifiedState } from "../recoil/auth";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "./tailwind/Modal";
import { formatDateTimeWithNameOfDay } from "../services/date";
import { FullScreenIcon } from "../assets/icons/FullScreenIcon";
import UserName from "./UserName";
import type { DocumentWithLinkedItem, Document, FileMetadata, FolderWithLinkedItem, Folder } from "../types/document";
import API, { tryFetch, tryFetchBlob } from "../services/api";
import { download, errorMessage } from "../utils";
import type { UUIDV4 } from "../types/uuid";
import PersonName from "./PersonName";
import { toast } from "react-toastify";
import DocumentsOrganizer from "./DocumentsOrganizer";
import { decryptFile, encryptFile, getHashedOrgEncryptionKey } from "../services/encryption";
import { ZipWriter, BlobWriter, BlobReader } from "@zip.js/zip.js";
import { defaultModalActionState, modalActionState } from "../recoil/modal";
import { itemsGroupedByActionSelector } from "../recoil/selectors";
import { capture } from "../services/sentry";
import SelectCustom from "./SelectCustom";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

// Upload progress state
interface UploadProgress {
  fileName: string;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

interface FolderOption {
  _id: string;
  name: string;
  level?: number;
}

// Global upload state
const uploadProgressModal: {
  isOpen: boolean;
  files: UploadProgress[];
  folders: FolderOption[] | null;
  selectedFolderId: string;
  waitingForFolderSelection: boolean;
  isSaving: boolean;
  onFolderConfirm: ((folderId: string) => void) | null;
  setFiles: (files: UploadProgress[]) => void;
  setIsOpen: (isOpen: boolean) => void;
  setFolders: (folders: FolderOption[] | null) => void;
  setSelectedFolderId: (folderId: string) => void;
  setWaitingForFolderSelection: (waiting: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  setOnFolderConfirm: (callback: ((folderId: string) => void) | null) => void;
} = {
  isOpen: false,
  files: [],
  folders: null,
  selectedFolderId: "root",
  waitingForFolderSelection: false,
  isSaving: false,
  onFolderConfirm: null,
  setFiles: () => {},
  setIsOpen: () => {},
  setFolders: () => {},
  setSelectedFolderId: () => {},
  setWaitingForFolderSelection: () => {},
  setIsSaving: () => {},
  setOnFolderConfirm: () => {},
};

export function setUploadProgressHandlers(
  setFiles: (files: UploadProgress[]) => void,
  setIsOpen: (isOpen: boolean) => void,
  setFolders: (folders: FolderOption[] | null) => void,
  setSelectedFolderId: (folderId: string) => void,
  setWaitingForFolderSelection: (waiting: boolean) => void,
  setIsSaving: (saving: boolean) => void,
  setOnFolderConfirm: (callback: ((folderId: string) => void) | null) => void
) {
  uploadProgressModal.setFiles = setFiles;
  uploadProgressModal.setIsOpen = setIsOpen;
  uploadProgressModal.setFolders = setFolders;
  uploadProgressModal.setSelectedFolderId = setSelectedFolderId;
  uploadProgressModal.setWaitingForFolderSelection = setWaitingForFolderSelection;
  uploadProgressModal.setIsSaving = setIsSaving;
  uploadProgressModal.setOnFolderConfirm = setOnFolderConfirm;
}

// Global Upload Progress Provider Component
export function UploadProgressProvider() {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<UploadProgress[]>([]);
  const [folders, setFolders] = useState<FolderOption[] | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("root");
  const [waitingForFolderSelection, setWaitingForFolderSelection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [onFolderConfirm, setOnFolderConfirm] = useState<{ callback: ((folderId: string) => void) | null }>({ callback: null });

  // Connect to global handlers
  useEffect(() => {
    setUploadProgressHandlers(setFiles, setIsOpen, setFolders, setSelectedFolderId, setWaitingForFolderSelection, setIsSaving, (callback) =>
      setOnFolderConfirm({ callback })
    );
  }, []);

  return (
    <UploadProgressModal
      isOpen={isOpen}
      files={files}
      folders={folders}
      selectedFolderId={selectedFolderId}
      waitingForFolderSelection={waitingForFolderSelection}
      isSaving={isSaving}
      onFolderChange={setSelectedFolderId}
      onFolderConfirm={onFolderConfirm.callback}
    />
  );
}

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
  const organisation = useRecoilValue(organisationAuthentifiedState);
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

function ButtonDownloadAll({ documents }: { documents: DocumentWithLinkedItem[] }) {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!documents.filter((doc) => doc.type === "document").length) return null;

  return (
    <button
      type="button"
      disabled={isDownloading}
      className={`button-classic`}
      onClick={async () => {
        // Cette fonction permet de rajouter un fullName (avec les dossiers parents) à chaque document
        // Cela permet de respecter la hiérarchie des dossiers dans le zip.
        function documentsWithFullName(items: DocumentWithLinkedItem[]): (DocumentWithLinkedItem & { fullName: string })[] {
          const buildFullName = (item: DocumentWithLinkedItem, itemsMap: Record<string, DocumentWithLinkedItem>) => {
            let path = item.name;
            let parentId = item.parentId;
            while (parentId !== "root") {
              const parentItem = itemsMap[parentId];
              if (!parentItem) break; // sécurité pour éviter les boucles infinies ou les parents manquants
              path = `${parentItem.name}/${path}`;
              parentId = parentItem.parentId;
            }
            return path;
          };
          const itemsMap = items.reduce((map, item) => {
            map[item._id] = item;
            return map;
          }, {});
          const documents = items
            .filter((item) => item.type === "document")
            .map((document) => ({
              ...document,
              fullName: buildFullName(document, itemsMap),
            }));

          // Handle duplicate names by adding a numeric suffix
          const usedNames = new Set<string>();
          const documentsWithUniqueNames = documents.map((document) => {
            let fullName = document.fullName;
            let counter = 2;

            // If name is already used, add a suffix
            while (usedNames.has(fullName)) {
              const lastDotIndex = document.fullName.lastIndexOf(".");
              if (lastDotIndex !== -1) {
                // File has an extension
                const nameWithoutExt = document.fullName.substring(0, lastDotIndex);
                const extension = document.fullName.substring(lastDotIndex);
                fullName = `${nameWithoutExt} (${counter})${extension}`;
              } else {
                // File has no extension
                fullName = `${document.fullName} (${counter})`;
              }
              counter++;
            }

            usedNames.add(fullName);
            return {
              ...document,
              fullName,
            };
          });

          return documentsWithUniqueNames;
        }

        // Un gros try catch pour l'instant, on verra si on peut améliorer ça plus tard
        try {
          setIsDownloading(true);
          const zipWriter = new ZipWriter(new BlobWriter("application/zip"));
          const documentsPaths = documentsWithFullName(documents);

          for (const doc of documentsPaths) {
            const [error, blob] = await tryFetchBlob(() => {
              return API.download({ path: doc.downloadPath });
            });
            if (error) {
              toast.error(errorMessage(error) || "Une erreur est survenue lors du téléchargement d'un document");
              setIsDownloading(false);
              return;
            }
            const file = await decryptFile(blob, doc.encryptedEntityKey, getHashedOrgEncryptionKey());
            await zipWriter.add(doc.fullName, new BlobReader(file));
          }
          const zipBlob = await zipWriter.close();
          download(new File([zipBlob], "documents.zip", { type: "application/zip" }), "documents.zip");
          setIsDownloading(false);
        } catch (err) {
          capture(err);
          console.error("Une erreur est survenue", err);
          toast.error("Une erreur est survenue lors de la création du fichier zip.");
          setIsDownloading(false);
        }
      }}
    >
      {isDownloading ? "Téléchargement en cours..." : "Télécharger tout (.zip)"}
    </button>
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
  const organisation = useRecoilValue(organisationAuthentifiedState);

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
  const actionsObjects = useRecoilValue(itemsGroupedByActionSelector);
  const setModalAction = useSetRecoilState(modalActionState);
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
  const organisation = useRecoilValue(organisationAuthentifiedState);
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
  const user = useRecoilValue(userState);

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

  const user = useRecoilValue(userState);
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

export async function handleFilesUpload({ files, personId, user, folders = null, onSave = null }) {
  if (!files?.length) return;
  if (!personId) {
    toast.error("Veuillez sélectionner une personne auparavant");
    return;
  }

  // Initialize upload progress
  const uploadFiles: UploadProgress[] = Array.from(files).map((file: any) => ({
    fileName: file.name,
    status: "pending" as const,
  }));

  // Show upload modal
  uploadProgressModal.setFiles(uploadFiles);
  uploadProgressModal.setIsOpen(true);
  uploadProgressModal.setFolders(folders);
  uploadProgressModal.setSelectedFolderId("root");

  const docsResponses = [];
  let hasError = false;

  for (let i = 0; i < files.length; i++) {
    const fileToUpload = files[i] as any;

    // Update status to uploading
    uploadFiles[i].status = "uploading";
    uploadProgressModal.setFiles([...uploadFiles]);

    try {
      const { encryptedEntityKey, encryptedFile } = await encryptFile(fileToUpload, getHashedOrgEncryptionKey());
      const [docResponseError, docResponse] = await tryFetch(() => {
        return API.upload({ path: `/person/${personId}/document`, encryptedFile });
      });

      if (docResponseError || !docResponse.ok || !docResponse.data) {
        uploadFiles[i].status = "error";
        uploadFiles[i].error = `Erreur lors de l'envoi du document ${fileToUpload.name}`;
        uploadProgressModal.setFiles([...uploadFiles]);
        hasError = true;
        continue;
      }

      const fileUploaded = docResponse.data as FileMetadata;
      const document: Document = {
        _id: fileUploaded.filename,
        name: fileToUpload.name,
        encryptedEntityKey: encryptedEntityKey,
        createdAt: new Date(),
        createdBy: user?._id ?? "",
        downloadPath: `/person/${personId}/document/${fileUploaded.filename}`,
        file: fileUploaded,
        group: false,
        parentId: undefined,
        position: undefined,
        type: "document",
      };

      docsResponses.push(document);
      uploadFiles[i].status = "completed";
      uploadProgressModal.setFiles([...uploadFiles]);
    } catch (_error) {
      uploadFiles[i].status = "error";
      uploadFiles[i].error = `Erreur lors du traitement du fichier ${fileToUpload.name}`;
      uploadProgressModal.setFiles([...uploadFiles]);
      hasError = true;
    }
  }

  // If folders are provided and onSave callback exists, wait for user to select folder
  if (folders && onSave && docsResponses.length > 0) {
    uploadProgressModal.setWaitingForFolderSelection(true);

    return new Promise<void>((resolve) => {
      uploadProgressModal.setOnFolderConfirm(async (selectedFolderId: string) => {
        // Set saving state
        uploadProgressModal.setIsSaving(true);

        // Update documents with selected folder
        const updatedDocs = docsResponses.map((doc) => ({
          ...doc,
          parentId: selectedFolderId === "root" ? undefined : selectedFolderId,
        }));

        // Call the save function and wait for it (includes refresh)
        await onSave(updatedDocs);

        // Close modal after save completes
        uploadProgressModal.setIsOpen(false);
        uploadProgressModal.setWaitingForFolderSelection(false);
        uploadProgressModal.setIsSaving(false);
        uploadProgressModal.setFolders(null);
        uploadProgressModal.setOnFolderConfirm(null);

        resolve();
      });
    });
  }

  // Original behavior when no folders provided
  // Wait a moment to show completion state, then close modal
  setTimeout(() => {
    uploadProgressModal.setIsOpen(false);
    if (!hasError && docsResponses.length > 0) {
      if (docsResponses.length === 1) {
        toast.success(`Document ${docsResponses[0].name} ajouté !`);
      } else {
        toast.success(`${docsResponses.length} documents ajoutés !`);
      }
    }
  }, 1000);

  return docsResponses.length > 0 ? docsResponses : undefined;
}

interface DocumentModalProps<T extends DocumentWithLinkedItem> {
  document: T;
  personId: UUIDV4;
  onClose: () => void;
  onSubmit: (document: T) => Promise<void>;
  onDelete: (document: T) => Promise<boolean>;
  canToggleGroupCheck: boolean;
  showAssociatedItem: boolean;
  color: string;
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
}: DocumentModalProps<T>) {
  const actionsObjects = useRecoilValue(itemsGroupedByActionSelector);
  const setModalAction = useSetRecoilState(modalActionState);
  const location = useLocation();
  const initialName = useMemo(() => document.name, [document.name]);
  const [name, setName] = useState(initialName);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const canSave = useMemo(() => isEditing && name !== initialName, [name, initialName, isEditing]);
  const history = useHistory();

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
                setIsUpdating(true);
                await onSubmit({ ...document, name });
                setIsUpdating(false);
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

                    // Create a new blob with the appropriate content type
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
          {
            // On ne propose pas de changer l'état du document pour les documents liés à des actions
            // car ils sont ou non partagés avec la famille via l'action liée (pour ne pas créer d'absurdité).
            !!canToggleGroupCheck && document.linkedItem.type !== "action" && (
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
                      await onSubmit({ ...document, group: !document.group });
                      setIsUpdating(false);
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
                      , vous dever allez sur sa fiche pour le modifier.
                    </div>
                  </div>
                )}
              </div>
            )
          }
          <small className="tw-pt-4 tw-opacity-60">
            Créé par <UserName id={document.createdBy} /> le {formatDateTimeWithNameOfDay(document.createdAt)}
          </small>
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
          disabled={isUpdating}
          onClick={() => {
            onClose();
          }}
        >
          Fermer
        </button>
        <button
          type="button"
          className="button-destructive"
          disabled={isUpdating || isLinkedToOtherPerson}
          onClick={async () => {
            if (!window.confirm("Voulez-vous vraiment supprimer ce document ?")) return;
            const ok = await onDelete(document);
            if (ok) onClose();
          }}
        >
          Supprimer
        </button>
        {(isEditing || canSave) && (
          <button title="Sauvegarder ce document" type="submit" className={`button-submit !tw-bg-${color}`} form="edit-document-form">
            Sauvegarder
          </button>
        )}
        {!isEditing && (
          <button
            title="Modifier le nom de ce document"
            type="button"
            className={`button-submit !tw-bg-${color}`}
            disabled={isUpdating || isLinkedToOtherPerson}
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
  const user = useRecoilValue(userAuthentifiedState);

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

// Upload Progress Modal Component
interface UploadProgressModalProps {
  isOpen: boolean;
  files: UploadProgress[];
  folders?: FolderOption[] | null;
  selectedFolderId?: string;
  waitingForFolderSelection?: boolean;
  isSaving?: boolean;
  onClose?: () => void;
  onFolderChange?: (folderId: string) => void;
  onFolderConfirm?: ((folderId: string) => void) | null;
}

export function UploadProgressModal({
  isOpen,
  files,
  folders = null,
  selectedFolderId = "root",
  waitingForFolderSelection = false,
  isSaving = false,
  onClose,
  onFolderChange,
  onFolderConfirm,
}: UploadProgressModalProps) {
  const completedFiles = files.filter((f) => f.status === "completed").length;
  const totalFiles = files.length;
  const hasErrors = files.some((f) => f.status === "error");
  const isComplete = files.every((f) => f.status === "completed" || f.status === "error");

  const showFolderSelection = folders && waitingForFolderSelection && isComplete;

  return (
    <ModalContainer
      open={isOpen}
      size="lg"
      blurryBackground
      onClose={null} // Prevent closing during upload
    >
      <ModalHeader title={showFolderSelection ? "Choisir le dossier de destination" : "Téléversement en cours..."} />
      <ModalBody>
        <div className="tw-px-8 tw-py-4">
          <div className="tw-mb-4">
            <div className="tw-flex tw-justify-between tw-text-sm tw-text-gray-600 tw-mb-2">
              <span>Progression</span>
              <span>
                {completedFiles}/{totalFiles}
              </span>
            </div>
            <div className="tw-w-full tw-bg-gray-200 tw-rounded-full tw-h-2">
              <div
                className={`tw-h-2 tw-rounded-full tw-transition-all tw-duration-300 ${hasErrors ? "tw-bg-red-500" : "tw-bg-main"}`}
                style={{ width: `${totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="tw-space-y-2 tw-max-h-64 tw-overflow-y-auto">
            {files.map((file, index) => (
              <div key={index} className="tw-flex tw-items-center tw-gap-3 tw-p-2 tw-rounded tw-bg-gray-50">
                <div className="tw-flex-shrink-0">
                  {file.status === "pending" && <div className="tw-w-4 tw-h-4 tw-rounded-full tw-border-2 tw-border-gray-300" />}
                  {file.status === "uploading" && (
                    <div className="tw-w-4 tw-h-4 tw-rounded-full tw-border-2 tw-border-main tw-border-t-transparent tw-animate-spin" />
                  )}
                  {file.status === "completed" && (
                    <div className="tw-w-4 tw-h-4 tw-rounded-full tw-bg-green-500 tw-flex tw-items-center tw-justify-center">
                      <svg className="tw-w-2.5 tw-h-2.5 tw-text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                  {file.status === "error" && (
                    <div className="tw-w-4 tw-h-4 tw-rounded-full tw-bg-red-500 tw-flex tw-items-center tw-justify-center">
                      <svg className="tw-w-2.5 tw-h-2.5 tw-text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="tw-flex-1 tw-min-w-0">
                  <div className="tw-text-sm tw-font-medium tw-text-gray-900 tw-truncate">{file.fileName}</div>
                  {file.status === "uploading" && <div className="tw-text-xs tw-text-gray-500">Téléversement...</div>}
                  {file.status === "completed" && <div className="tw-text-xs tw-text-green-600">Terminé</div>}
                  {file.status === "error" && file.error && <div className="tw-text-xs tw-text-red-600">{file.error}</div>}
                </div>
              </div>
            ))}
          </div>

          {showFolderSelection && (
            <div className="tw-mt-6 tw-pt-6 tw-border-t tw-border-gray-200">
              <label htmlFor="folder-select" className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-2">
                Dossier de destination
              </label>
              <SelectCustom
                inputId="folder-select"
                name="folder-select"
                value={{
                  value: selectedFolderId,
                  label:
                    selectedFolderId === "root" ? (
                      <div className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-truncate">
                        <FolderIcon className="tw-w-4 tw-h-4 tw-text-yellow-600" />
                        <span>Racine (aucun dossier)</span>
                      </div>
                    ) : (
                      <div className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-truncate">
                        <FolderIcon className="tw-w-4 tw-h-4 tw-text-yellow-600" />
                        <span>{folders.find((f) => f._id === selectedFolderId)?.name}</span>
                      </div>
                    ),
                }}
                onChange={(option: { value: string; label: React.ReactNode } | null) => onFolderChange?.(option?.value || "root")}
                options={[
                  {
                    value: "root",
                    label: (
                      <div className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-truncate">
                        <FolderIcon className="tw-w-4 tw-h-4 tw-text-yellow-600" />
                        <span>Racine (aucun dossier)</span>
                      </div>
                    ),
                  },
                  ...folders.map((folder) => ({
                    value: folder._id,
                    label: (
                      <div
                        className="tw-flex tw-items-center tw-text-sm tw-gap-2 tw-truncate"
                        style={{ paddingLeft: `${(folder.level || 0) * 20}px` }}
                      >
                        <FolderIcon className="tw-w-4 tw-h-4 tw-text-yellow-600" />
                        <span>{folder.name}</span>
                      </div>
                    ),
                  })),
                ]}
                isDisabled={isSaving}
              />
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        {showFolderSelection && onFolderConfirm && (
          <button type="button" className="button-submit" onClick={() => onFolderConfirm(selectedFolderId)} disabled={isSaving}>
            {isSaving ? "Enregistrement..." : "Terminer"}
          </button>
        )}
        {isComplete && !showFolderSelection && onClose && (
          <button type="button" className="button-submit" onClick={onClose}>
            Fermer
          </button>
        )}
        {!isComplete && !isSaving && <div className="tw-text-sm tw-text-gray-500">Veuillez patienter pendant le téléversement...</div>}
        {isSaving && !showFolderSelection && <div className="tw-text-sm tw-text-gray-500">Enregistrement en cours...</div>}
      </ModalFooter>
    </ModalContainer>
  );
}
