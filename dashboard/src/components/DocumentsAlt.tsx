import { useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useRecoilValue } from "recoil";
import { v4 as uuidv4 } from "uuid";
import {
  FolderPlusIcon,
  DocumentPlusIcon,
  LockClosedIcon,
  FolderIcon,
  FolderOpenIcon,
  DocumentIcon,
  PencilSquareIcon,
  PhotoIcon,
  ArrowsPointingOutIcon,
} from "@heroicons/react/24/outline";
import { UsersIcon } from "@heroicons/react/16/solid";
import { userState } from "../recoil/auth";
import type { DocumentWithLinkedItem, FolderWithLinkedItem, Document, Folder, LinkedItem } from "../types/document";
import { useDataLoader } from "../services/dataLoader";
import isEqual from "react-fast-compare";
import { removeOldDefaultFolders } from "../utils/documents";
import { createOnDropHandler, dragAndDropFeature, hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import cn from "classnames";
import { handleFilesUpload, DocumentModal, ButtonDownloadAll } from "./DocumentsGeneric";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "./tailwind/Modal";
import UserName from "./UserName";
import { formatDateWithFullMonth, formatTime } from "../services/date";

type DocumentOrFolder = DocumentWithLinkedItem | FolderWithLinkedItem;

interface DocumentsAltConfig {
  // Core data
  documents: Array<DocumentWithLinkedItem | FolderWithLinkedItem>;

  // Item configuration
  linkedItem: LinkedItem; // The main linked item (person, action, consultation, treatment, medical-file)
  personId?: string; // Optional person ID for file uploads (required when linkedItem is not a person)

  // Folder configuration
  supportsFolders?: boolean; // Whether this context supports folder creation
  defaultFolders?: Array<FolderWithLinkedItem>; // Default folders to show (e.g., from organization settings)
  readOnlyFolders?: Array<FolderWithLinkedItem>; // Folders that cannot be moved or deleted (e.g., Actions, Treatments, Consultations)

  // Group configuration (for family documents)
  canToggleGroupCheck?: boolean;

  // UI configuration
  title?: string;
  color?: "main" | "blue-900";
  showFullScreen?: boolean;
  isInsideModal?: boolean; // If true, shows simplified view without header actions
  hideLinkedItemType?: "action" | "consultation" | "treatment"; // Hide "View X" link for this type to avoid recursion

  // Callbacks
  onSaveDocuments: (documents: Array<Document | Folder>) => Promise<void>;
  onDeleteDocument?: (document: DocumentWithLinkedItem) => Promise<boolean>;
  onDeleteFolder?: (folder: FolderWithLinkedItem) => Promise<boolean>;
  onUpdateDocument?: (document: DocumentWithLinkedItem) => Promise<void>;
  onUpdateFolder?: (folder: FolderWithLinkedItem) => Promise<void>;

  // Additional associated documents (e.g., from actions for a person)
  additionalDocuments?: Array<DocumentWithLinkedItem | FolderWithLinkedItem>;
}

interface DocumentsAltProps {
  config: DocumentsAltConfig;
}

// Separate tree component that can be remounted with a key
function DocumentTree({
  treeData,
  onSaveOrder,
  expandedItems,
  onDocumentClick,
  onFolderEdit,
  currentLinkedItemId,
  isFullScreen,
  isInsideModal,
  supportsFolders,
}: {
  treeData: Record<string, DocumentOrFolder & { children?: string[] }>;
  onSaveOrder: (itemId: string, newChildren: string[]) => void;
  expandedItems: string[];
  onDocumentClick: (document: DocumentWithLinkedItem) => void;
  onFolderEdit: (folder: FolderWithLinkedItem) => void;
  currentLinkedItemId: string;
  isFullScreen?: boolean;
  isInsideModal?: boolean;
  supportsFolders?: boolean;
}) {
  const syncDataLoader = {
    getItem: (id: string) => treeData[id],
    getChildren: (id: string) => treeData[id]?.children ?? [],
  };

  const tree = useTree<DocumentOrFolder & { children?: string[] }>({
    initialState: {
      expandedItems: expandedItems,
    },
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().type === "folder",
    canDrag: (items) =>
      supportsFolders &&
      items.every((item) => {
        const data = item.getItemData();
        // Can't drag if explicitly not movable
        if (data.movable === false) return false;
        // Can't drag documents that belong to other items
        if (data.type === "document") {
          const doc = data as DocumentWithLinkedItem;
          if (doc.linkedItem && doc.linkedItem._id !== currentLinkedItemId) return false;
        }
        return true;
      }),
    canReorder: supportsFolders,
    onDrop: supportsFolders
      ? createOnDropHandler((item, newChildren) => {
          if (!item.isExpanded()) item.expand();
          onSaveOrder(item.getId(), newChildren);
        })
      : undefined,
    indent: 20,
    dataLoader: syncDataLoader,
    features: [syncDataLoaderFeature, hotkeysCoreFeature, ...(supportsFolders ? [dragAndDropFeature] : [])],
  });

  return (
    <div {...tree.getContainerProps()} className={cn("tw-flex tw-flex-col", isFullScreen || isInsideModal ? "tw-text-sm" : "tw-text-xs")}>
      {tree.getItems().map((item, _index) => {
        const itemData = item.getItemData();
        if (item.getId() === "root") return null;

        const isFolder = itemData.type === "folder";
        const level = item.getItemMeta().level;
        const isDraggingOver = (item.isDraggingOver?.() && item.isUnorderedDragTarget?.()) || false;

        // Check if document is from another item
        const isFromOtherItem =
          !isFolder && (itemData as DocumentWithLinkedItem).linkedItem && (itemData as DocumentWithLinkedItem).linkedItem._id !== currentLinkedItemId;
        const isGroupDocument = !isFolder && (itemData as DocumentWithLinkedItem).group;

        return (
          <div
            key={item.getId()}
            {...item.getProps()}
            className={cn("tw-flex tw-items-center tw-cursor-pointer tw-group", {
              "tw-bg-main50": isDraggingOver && isFolder,
              "hover:tw-bg-gray-50": isFullScreen || isInsideModal,
              "hover:tw-text-main": !isFullScreen && !isInsideModal,
              "tw-py-1": isFullScreen || isInsideModal,
            })}
            onClick={(e) => {
              // Only handle click on documents, not folders
              if (!isFolder) {
                e.stopPropagation();
                onDocumentClick(itemData as DocumentWithLinkedItem);
              } else {
                e.stopPropagation();
                if (item.isExpanded()) {
                  item.collapse();
                } else {
                  item.expand();
                }
              }
            }}
          >
            <div
              className={cn("tw-flex-grow tw-flex tw-items-center tw-gap-2 tw-overflow-hidden", {
                "hover:tw-text-main": isFullScreen,
                "tw-px-1": !isFullScreen && !isInsideModal,
                "tw-px-2": isInsideModal,
              })}
              style={{ paddingLeft: isFullScreen || isInsideModal ? `${level * 20 + 4}px` : `${level * 20}px` }}
            >
              {/* Icon */}
              {isFolder ? (
                item.isExpanded() ? (
                  <FolderOpenIcon className="tw-min-w-5 tw-w-5 tw-h-5 tw-text-yellow-600" />
                ) : (
                  <FolderIcon className="tw-min-w-5 tw-w-5 tw-h-5 tw-text-yellow-600/60" />
                )
              ) : // If it's an image use the image icon
              itemData.file?.mimetype?.startsWith("image/") ? (
                <PhotoIcon className="tw-min-w-5 tw-w-5 tw-h-5 tw-text-gray-600" />
              ) : (
                <DocumentIcon className="tw-min-w-5 tw-w-5 tw-h-5 tw-text-gray-600" />
              )}

              {/* Name */}
              <span className="tw-truncate tw-flex tw-items-center tw-gap-1">
                <span>{itemData.name}</span>
                {isGroupDocument && <UsersIcon className="tw-min-w-4 tw-w-4 tw-h-4 tw-text-main75" />}
                {(itemData.movable === false || isFromOtherItem) && (
                  <LockClosedIcon
                    className="tw-w-3 tw-h-3 tw-text-gray-700"
                    title={isFromOtherItem ? "Document d'un autre élément" : "Ne peut pas être déplacé"}
                  />
                )}
              </span>

              {/* Edit button for folders (only visible on hover and if movable) */}
              {isFolder && itemData.movable !== false && supportsFolders && (
                <button
                  type="button"
                  className="tw-p-1 tw-rounded hover:tw-scale-125 hover:tw-text-main tw-transition-colors tw-invisible group-hover:tw-visible focus:tw-visible"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFolderEdit(itemData as FolderWithLinkedItem);
                  }}
                  title="Éditer le dossier"
                  aria-label="Éditer le dossier"
                >
                  <PencilSquareIcon className="tw-w-4 tw-h-4 tw-text-gray-600" />
                </button>
              )}
            </div>
            {(isFullScreen || isInsideModal) && (
              <div className="tw-flex tw-items-center tw-gap-8 tw-px-4 tw-shrink-0 tw-text-xs tw-text-gray-500">
                <div className="tw-w-40">
                  Créé par <UserName id={itemData.createdBy} />
                </div>
                <div className="tw-w-40 tw-text-right">
                  {formatDateWithFullMonth(itemData.createdAt)} {formatTime(itemData.createdAt)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface DocumentsTreeWrapperProps {
  treeKey: string;
  treeData: Record<string, DocumentOrFolder & { children?: string[] }>;
  onSaveOrder: (itemId: string, newChildren: string[]) => void;
  expandedItems: string[];
  onDocumentClick: (document: DocumentWithLinkedItem) => void;
  onFolderEdit: (folder: FolderWithLinkedItem) => void;
  linkedItem: LinkedItem;
  className?: string;
  isFullScreen?: boolean;
  isInsideModal?: boolean;
  isInDropzone: boolean;
  setIsInDropzone: (isInDropzone: boolean) => void;
  supportsFolders?: boolean;
}

function DocumentsTreeWrapper({
  treeKey,
  treeData,
  onSaveOrder,
  expandedItems,
  onDocumentClick,
  onFolderEdit,
  linkedItem,
  isInDropzone,
  setIsInDropzone,
  className = "tw-relative tw-p-4",
  isFullScreen,
  isInsideModal,
  supportsFolders,
}: DocumentsTreeWrapperProps) {
  return (
    <div
      className={className}
      onDragEnter={(e) => {
        // Only show drop zone if files are being dragged from outside (not internal tree items)
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          if (!isInDropzone) setIsInDropzone(true);
        }
      }}
      onDragOver={(e) => {
        // Only prevent default if files are being dragged from outside
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
        }
      }}
    >
      <DocumentTree
        key={treeKey}
        treeData={treeData}
        onSaveOrder={onSaveOrder}
        expandedItems={expandedItems}
        onDocumentClick={onDocumentClick}
        onFolderEdit={onFolderEdit}
        currentLinkedItemId={linkedItem._id}
        isFullScreen={isFullScreen}
        isInsideModal={isInsideModal}
        supportsFolders={supportsFolders}
      />
    </div>
  );
}

function DocumentsDropzone({
  setIsInDropzone,
  onAddDocuments,
  linkedItemId,
  user,
  folderOptions,
  supportsFolders,
}: {
  setIsInDropzone: (val: boolean) => void;
  onAddDocuments: (docs: Array<Document | Folder>) => Promise<void>;
  linkedItemId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  folderOptions: Array<{ _id: string; name: string; level: number }> | null;
  supportsFolders?: boolean;
}) {
  return (
    <div
      className="tw-absolute tw-inset-0 tw-bg-white tw-flex tw-items-center tw-justify-center tw-border-dashed tw-border-4 tw-border-main tw-text-main tw-z-50"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setIsInDropzone(false);
        }
      }}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsInDropzone(false);

        if (e.dataTransfer.files.length > 0) {
          await handleFilesUpload({
            files: e.dataTransfer.files,
            personId: linkedItemId,
            user,
            folders: supportsFolders ? folderOptions : null,
            onSave: onAddDocuments,
          });
        }
      }}
    >
      <div className="tw-mb-2 tw-mt-8 tw-w-full tw-text-center">
        <DocumentPlusIcon className="tw-mx-auto tw-h-16 tw-w-16" />
        <p className="tw-mt-4 tw-text-lg tw-font-medium">Déposez vos fichiers ici</p>
      </div>
    </div>
  );
}

export default function DocumentsAlt({ config }: DocumentsAltProps) {
  const { refresh } = useDataLoader();
  const user = useRecoilValue(userState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resetFileInputKey, setResetFileInputKey] = useState(0);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isUpdatingFolder, setIsUpdatingFolder] = useState(false);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<DocumentWithLinkedItem | null>(null);
  const [folderToEdit, setFolderToEdit] = useState<FolderWithLinkedItem | null>(null);
  const [isUpdatingDocument, setIsUpdatingDocument] = useState(false);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [isInDropzone, setIsInDropzone] = useState(false);

  const {
    documents,
    linkedItem,
    personId,
    supportsFolders = true,
    defaultFolders = [],
    readOnlyFolders = [],
    canToggleGroupCheck = false,
    title = "Documents",
    color = "main",
    showFullScreen = true,
    isInsideModal = false,
    hideLinkedItemType,
    onSaveDocuments,
    onDeleteDocument,
    onDeleteFolder,
    onUpdateDocument,
    onUpdateFolder,
    additionalDocuments = [],
  } = config;

  // Determine the correct person ID for file uploads
  const uploadPersonId = personId || linkedItem._id;

  // Build all documents including defaults and read-only folders
  const allDocuments = useMemo(() => {
    return [...readOnlyFolders, ...removeOldDefaultFolders([...(documents || []), ...additionalDocuments], defaultFolders)]
      .filter((e) => e)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [documents, defaultFolders, readOnlyFolders, additionalDocuments]);

  // Convert to tree data structure
  const treeData = useMemo(() => {
    const data: Record<string, DocumentOrFolder & { children?: string[] }> = {
      root: {
        _id: "root",
        name: "Documents",
        type: "folder",
        children: [],
        createdAt: new Date(),
        createdBy: "system",
        linkedItem: linkedItem,
        movable: false,
      } as FolderWithLinkedItem & { children: string[] },
    };

    // Add all items to data
    allDocuments.forEach((item) => {
      data[item._id] = { ...item, children: [] };
    });

    // Build children arrays
    allDocuments.forEach((item) => {
      const parentId = item.parentId || "root";
      if (data[parentId] && item.type === "folder") {
        data[parentId].children = data[parentId].children || [];
      }
      if (data[parentId]) {
        if (!data[parentId].children) data[parentId].children = [];
        if (!data[parentId].children.includes(item._id)) {
          data[parentId].children.push(item._id);
        }
      }
    });

    return data;
  }, [allDocuments, linkedItem]);

  // Calculate which folders should be expanded - all non-empty folders
  const defaultExpandedItems = useMemo(() => {
    const expanded = ["root"];
    Object.entries(treeData).forEach(([id, item]) => {
      if (item.type === "folder" && item.children && item.children.length > 0) {
        expanded.push(id);
      }
    });
    return expanded;
  }, [treeData]);

  // Create a key that changes when documents change to force tree re-render
  const treeKey = useMemo(() => {
    return allDocuments.map((d) => d._id).join("-") + "-" + defaultExpandedItems.join("-");
  }, [allDocuments, defaultExpandedItems]);

  // Build folder options for upload modal with tree structure
  const folderOptions = useMemo(() => {
    const buildFolderTree = (parentId: string | undefined, level: number = 0): Array<{ _id: string; name: string; level: number }> => {
      return allDocuments
        .filter((doc) => {
          if (doc.type !== "folder") return false;
          // At root level, include folders with parentId === undefined OR "root"
          if (parentId === undefined) {
            return doc.parentId === undefined || doc.parentId === "root";
          }
          return doc.parentId === parentId;
        })
        .flatMap((folder) => [
          {
            _id: folder._id,
            name: folder.name,
            level,
          },
          ...buildFolderTree(folder._id, level + 1),
        ]);
    };
    return buildFolderTree(undefined, 0);
  }, [allDocuments]);

  const handleSaveOrder = async (itemId: string, newChildren: string[]) => {
    if (!supportsFolders) return;

    // Update the tree data structure immediately for UI responsiveness
    treeData[itemId].children = newChildren;

    // Debounce the actual save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      // Convert back to flat array with parentId
      const updatedDocs: DocumentOrFolder[] = [];
      const processItem = (id: string, parentId: string | undefined, position: number) => {
        const item = treeData[id];
        if (!item || id === "root") return;

        // Remove the children property before saving (it's only for tree rendering, not part of document schema)
        const { children, ...itemWithoutChildren } = item;
        updatedDocs.push({
          ...itemWithoutChildren,
          parentId: parentId === "root" ? undefined : parentId,
          position,
        } as DocumentOrFolder);

        if (item.children) {
          item.children.forEach((childId, idx) => {
            processItem(childId, id, idx);
          });
        }
      };

      if (treeData.root.children) {
        treeData.root.children.forEach((childId, idx) => {
          processItem(childId, "root", idx);
        });
      }

      // Filter out read-only folders and documents from other linked items
      const docsToSave = updatedDocs.filter((d) => {
        if (readOnlyFolders.some((rf) => rf._id === d._id)) return false;
        if (d.linkedItem._id !== linkedItem._id) return false;
        return true;
      });

      // Check if anything actually changed
      const currentDocs = documents
        .filter((d) => d.linkedItem._id === linkedItem._id)
        .map((d) => ({ _id: d._id, parentId: d.parentId, position: d.position }));

      const nextDocsSimplified = docsToSave.map((d) => ({
        _id: d._id,
        parentId: d.parentId,
        position: d.position,
      }));

      if (isEqual(currentDocs, nextDocsSimplified)) {
        return;
      }

      await onSaveDocuments(docsToSave as Array<Document | Folder>);
      await refresh();
      toast.success("Documents mis à jour");
    }, 0);
  };

  const handleAddDocuments = async (newDocuments: Array<Document | Folder>) => {
    if (!newDocuments || newDocuments.length === 0) return;
    await onSaveDocuments([...(documents || []), ...newDocuments]);
    await refresh();

    if (newDocuments.filter((d) => d.type === "document").length > 1) toast.success("Documents enregistrés !");
    if (newDocuments.filter((d) => d.type === "folder").length > 0) toast.success("Dossier créé !");
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Veuillez entrer un nom pour le dossier");
      return;
    }

    setIsCreatingFolder(true);

    const newFolder: Folder = {
      _id: uuidv4(),
      name: newFolderName.trim(),
      type: "folder",
      parentId: undefined,
      position: undefined,
      createdAt: new Date(),
      createdBy: user?._id ?? "",
    };

    await handleAddDocuments([newFolder]);
    setShowCreateFolderModal(false);
    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  const handleUpdateFolder = async (folder: FolderWithLinkedItem, newName: string) => {
    if (!onUpdateFolder) return;
    setIsUpdatingFolder(true);
    await onUpdateFolder({ ...folder, name: newName });
    await refresh();
    setIsUpdatingFolder(false);
    setFolderToEdit(null);
    toast.success("Dossier mis à jour");
  };

  const handleDeleteFolder = async (folder: FolderWithLinkedItem) => {
    if (!onDeleteFolder) return;
    setIsDeletingFolder(true);
    const success = await onDeleteFolder(folder);
    if (success) {
      await refresh();
      setIsDeletingFolder(false);
      setFolderToEdit(null);
      toast.success("Dossier supprimé");
    } else {
      setIsDeletingFolder(false);
    }
  };

  return (
    <div>
      {isInDropzone && !isFullScreen && (
        <DocumentsDropzone
          setIsInDropzone={setIsInDropzone}
          onAddDocuments={handleAddDocuments}
          linkedItemId={linkedItem._id}
          user={user}
          folderOptions={folderOptions}
          supportsFolders={supportsFolders}
        />
      )}
      {!isInsideModal && (
        <div className="tw-flex tw-justify-between tw-items-center tw-border-b tw-border-main25 tw-py-2 tw-px-4">
          <h3 className="tw-text-xl tw-mb-0">{title}</h3>
          <div className="tw-flex tw-gap-2">
            {supportsFolders && (
              <button
                type="button"
                aria-label="Créer un dossier"
                className={`tw-h-8 tw-w-8 tw-rounded-full tw-bg-${color} tw-text-white tw-transition hover:tw-scale-110 tw-flex tw-items-center tw-justify-center`}
                onClick={() => setShowCreateFolderModal(true)}
              >
                <FolderPlusIcon className="tw-w-5 tw-h-5" />
              </button>
            )}
            <button
              type="button"
              aria-label="Ajouter un document"
              className={`tw-h-8 tw-w-8 tw-rounded-full tw-bg-${color} tw-text-white tw-transition hover:tw-scale-110 tw-flex tw-items-center tw-justify-center`}
              onClick={() => fileInputRef.current?.click()}
            >
              <DocumentPlusIcon className="tw-w-5 tw-h-5" />
            </button>
            {showFullScreen && (
              <button
                type="button"
                aria-label="Passer en plein écran"
                className={`tw-h-8 tw-w-8 tw-rounded-full tw-bg-${color} tw-text-white tw-transition hover:tw-scale-110 tw-flex tw-items-center tw-justify-center`}
                onClick={() => setIsFullScreen(true)}
              >
                <ArrowsPointingOutIcon className="tw-w-5 tw-h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input for all contexts */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        key={resetFileInputKey}
        className="tw-hidden"
        onChange={async (e) => {
          await handleFilesUpload({
            files: e.target.files,
            personId: uploadPersonId,
            user,
            folders: supportsFolders ? folderOptions : null,
            onSave: handleAddDocuments,
          });
          setResetFileInputKey((k) => k + 1);
        }}
      />

      {/* Empty state for modal context */}
      {isInsideModal && allDocuments.length === 0 && (
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
          <label aria-label="Ajouter des documents" className={`button-submit mb-0 !tw-bg-${color} tw-cursor-pointer`}>
            ＋ Ajouter des documents
            <input
              type="file"
              multiple
              className="tw-hidden"
              onChange={async (e) => {
                await handleFilesUpload({
                  files: e.target.files,
                  personId: uploadPersonId,
                  user,
                  folders: supportsFolders ? folderOptions : null,
                  onSave: handleAddDocuments,
                });
              }}
            />
          </label>
        </div>
      )}

      {/* Add document button for modal context when there are documents */}
      {isInsideModal && allDocuments.length > 0 && (
        <div className="tw-my-1.5 tw-flex tw-justify-center tw-self-center">
          <label aria-label="Ajouter des documents" className={`button-submit mb-0 !tw-bg-${color} tw-cursor-pointer`}>
            ＋ Ajouter des documents
            <input
              type="file"
              multiple
              className="tw-hidden"
              onChange={async (e) => {
                await handleFilesUpload({
                  files: e.target.files,
                  personId: uploadPersonId,
                  user,
                  folders: supportsFolders ? folderOptions : null,
                  onSave: handleAddDocuments,
                });
              }}
            />
          </label>
        </div>
      )}

      {/* Document tree (only show if not in modal or if there are documents) */}
      {(!isInsideModal || allDocuments.length > 0) && (
        <DocumentsTreeWrapper
          treeKey={treeKey}
          treeData={treeData}
          onSaveOrder={handleSaveOrder}
          expandedItems={defaultExpandedItems}
          onDocumentClick={setDocumentToEdit}
          onFolderEdit={setFolderToEdit}
          linkedItem={linkedItem}
          isInDropzone={isInDropzone}
          setIsInDropzone={setIsInDropzone}
          isInsideModal={isInsideModal}
          supportsFolders={supportsFolders}
        />
      )}

      {showFullScreen && (
        <ModalContainer open={isFullScreen} onClose={() => setIsFullScreen(false)} size="full">
          <ModalHeader title={title} onClose={() => setIsFullScreen(false)} />
          <ModalBody>
            {isInDropzone && isFullScreen && (
              <DocumentsDropzone
                setIsInDropzone={setIsInDropzone}
                onAddDocuments={handleAddDocuments}
                linkedItemId={linkedItem._id}
                user={user}
                folderOptions={folderOptions}
                supportsFolders={supportsFolders}
              />
            )}
            <DocumentsTreeWrapper
              className="tw-relative tw-p-4 tw-min-h-[80vh]"
              treeKey={treeKey}
              treeData={treeData}
              onSaveOrder={handleSaveOrder}
              expandedItems={defaultExpandedItems}
              onDocumentClick={setDocumentToEdit}
              onFolderEdit={setFolderToEdit}
              linkedItem={linkedItem}
              isInDropzone={isInDropzone}
              setIsInDropzone={setIsInDropzone}
              isFullScreen={true}
              isInsideModal={false}
              supportsFolders={supportsFolders}
            />
          </ModalBody>
          <ModalFooter>
            <button type="button" className="button-cancel" onClick={() => setIsFullScreen(false)}>
              Fermer
            </button>
            <ButtonDownloadAll documents={allDocuments as DocumentWithLinkedItem[]} />
            {supportsFolders && (
              <button type="button" className="button-submit" onClick={() => setShowCreateFolderModal(true)}>
                Créer un dossier
              </button>
            )}
            <button type="button" className="button-submit" onClick={() => fileInputRef.current?.click()}>
              Ajouter un document
            </button>
          </ModalFooter>
        </ModalContainer>
      )}

      {supportsFolders && showCreateFolderModal && (
        <ModalContainer open onClose={() => setShowCreateFolderModal(false)}>
          <ModalHeader title="Créer un nouveau dossier" />
          <ModalBody>
            <div className="tw-p-4">
              <label htmlFor="folder-name" className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-2">
                Nom du dossier
              </label>
              <input
                id="folder-name"
                type="text"
                className="tw-w-full tw-rounded tw-border tw-border-gray-300 tw-px-3 tw-py-2 focus:tw-border-blue-500 focus:tw-outline-none"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateFolder();
                  }
                }}
                autoFocus
                placeholder="Entrez le nom du dossier"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="button-cancel"
              onClick={() => {
                setShowCreateFolderModal(false);
                setNewFolderName("");
              }}
            >
              Annuler
            </button>
            <button type="button" className="button-submit" onClick={handleCreateFolder} disabled={isCreatingFolder}>
              {isCreatingFolder ? "Enregistrement..." : "Enregistrer"}
            </button>
          </ModalFooter>
        </ModalContainer>
      )}

      {documentToEdit && onDeleteDocument && onUpdateDocument && (
        <DocumentModal
          document={documentToEdit}
          key={documentToEdit._id}
          personId={linkedItem._id}
          onClose={() => setDocumentToEdit(null)}
          onDelete={async (document) => {
            setIsDeletingDocument(true);
            const success = await onDeleteDocument(document);
            if (success) {
              await refresh();
              setIsDeletingDocument(false);
              setDocumentToEdit(null);
              toast.success("Document supprimé");
            } else {
              setIsDeletingDocument(false);
            }
            return success;
          }}
          onSubmit={async (documentOrFolder) => {
            setIsUpdatingDocument(true);
            await onUpdateDocument(documentOrFolder);
            await refresh();
            setIsUpdatingDocument(false);
            setDocumentToEdit(null);
            toast.success("Document mis à jour");
          }}
          canToggleGroupCheck={canToggleGroupCheck}
          showAssociatedItem={true}
          hideLinkedItemType={hideLinkedItemType}
          color={color}
          externalIsUpdating={isUpdatingDocument}
          externalIsDeleting={isDeletingDocument}
        />
      )}

      {supportsFolders && folderToEdit && (
        <ModalContainer open onClose={() => setFolderToEdit(null)}>
          <ModalHeader title="Éditer le dossier" />
          <ModalBody>
            <div className="tw-p-4">
              <label htmlFor="edit-folder-name" className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-2">
                Nom du dossier
              </label>
              <input
                id="edit-folder-name"
                type="text"
                className="tw-w-full tw-rounded tw-border tw-border-gray-300 tw-px-3 tw-py-2 focus:tw-border-blue-500 focus:tw-outline-none disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
                defaultValue={folderToEdit.name}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isUpdatingFolder && !isDeletingFolder) {
                    const newName = (e.target as HTMLInputElement).value.trim();
                    if (newName) {
                      handleUpdateFolder(folderToEdit, newName);
                    }
                  }
                }}
                disabled={isUpdatingFolder || isDeletingFolder}
                autoFocus
                placeholder="Nom du dossier"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <button type="button" className="button-cancel" onClick={() => setFolderToEdit(null)} disabled={isUpdatingFolder || isDeletingFolder}>
              Annuler
            </button>
            <button
              type="button"
              className="button-destructive"
              onClick={async () => {
                if (window.confirm("Voulez-vous vraiment supprimer ce dossier ?")) {
                  await handleDeleteFolder(folderToEdit);
                }
              }}
              disabled={isUpdatingFolder || isDeletingFolder}
            >
              {isDeletingFolder ? "Suppression..." : "Supprimer"}
            </button>
            <button
              type="button"
              className="button-submit"
              onClick={() => {
                const input = document.getElementById("edit-folder-name") as HTMLInputElement;
                const newName = input?.value.trim();
                if (newName) {
                  handleUpdateFolder(folderToEdit, newName);
                }
              }}
              disabled={isUpdatingFolder || isDeletingFolder}
            >
              {isUpdatingFolder ? "Enregistrement..." : "Enregistrer"}
            </button>
          </ModalFooter>
        </ModalContainer>
      )}
    </div>
  );
}
