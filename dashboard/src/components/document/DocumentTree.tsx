import { useMemo } from "react";
import { FolderIcon, FolderOpenIcon, DocumentIcon, PencilSquareIcon, PhotoIcon, DocumentPlusIcon } from "@heroicons/react/24/outline";
import { UsersIcon } from "@heroicons/react/16/solid";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { createOnDropHandler, dragAndDropFeature, hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import cn from "classnames";
import type { DocumentWithLinkedItem, FolderWithLinkedItem, Document, Folder, LinkedItemType } from "../../types/document";
import type { UserInstance } from "../../types/user";
import { handleFilesUpload, type FolderOption } from "./DocumentsUpload";
import UserName from "../../components/UserName";
import { formatDateWithFullMonth, formatTime } from "../../services/date";

export type DocumentOrFolder = DocumentWithLinkedItem | FolderWithLinkedItem;

interface DocumentTreeProps {
  treeData: Record<string, DocumentOrFolder & { children?: string[] }>;
  onSaveOrder: (itemId: string, newChildren: string[]) => void;
  expandedItems: string[];
  onDocumentClick: (document: DocumentWithLinkedItem) => void;
  onFolderEdit: (folder: FolderWithLinkedItem) => void;
  currentId: string;
  isFullScreen?: boolean;
}

export function DocumentTree({ treeData, onSaveOrder, expandedItems, onDocumentClick, onFolderEdit, currentId, isFullScreen }: DocumentTreeProps) {
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
      items.every((item) => {
        const data = item.getItemData();
        // Can't drag if explicitly not movable
        if (data.movable === false) return false;
        // Can't drag documents that belong to other persons in the group (family documents)
        if (data.type === "document") {
          const doc = data as DocumentWithLinkedItem;
          if (doc.linkedItem && doc.linkedItem.type === "person" && doc.linkedItem._id !== currentId) return false;
        }
        return true;
      }),
    canReorder: true,
    onDrop: createOnDropHandler((item, newChildren) => {
      if (!item.isExpanded()) item.expand();
      onSaveOrder(item.getId(), newChildren);
    }),
    indent: 20,
    dataLoader: syncDataLoader,
    features: [syncDataLoaderFeature, hotkeysCoreFeature, dragAndDropFeature],
  });

  return (
    <div {...tree.getContainerProps()} className={cn("tw-flex tw-flex-col", isFullScreen ? "tw-text-sm" : "tw-text-xs")}>
      {tree.getItems().map((item, _index) => {
        const itemData = item.getItemData();
        if (item.getId() === "root") return null;

        const isFolder = itemData.type === "folder";
        const level = item.getItemMeta().level;
        const isDraggingOver = (item.isDraggingOver?.() && item.isUnorderedDragTarget?.()) || false;

        // Check if document is from another person in the group (family documents)
        const isFromOtherPerson =
          !isFolder &&
          (itemData as DocumentWithLinkedItem).linkedItem &&
          (itemData as DocumentWithLinkedItem).linkedItem.type === "person" &&
          (itemData as DocumentWithLinkedItem).linkedItem._id !== currentId;
        const isGroupDocument = !isFolder && (itemData as DocumentWithLinkedItem).group;

        return (
          <div
            key={item.getId()}
            {...item.getProps()}
            className={cn("tw-flex tw-items-center tw-cursor-pointer tw-group", {
              // "tw-bg-blue-50": item.isFocused() && !isDraggingOver,
              "tw-bg-main50": isDraggingOver && isFolder,
              "hover:tw-bg-gray-50": isFullScreen,
              "hover:tw-text-main": !isFullScreen,
              "tw-py-1": isFullScreen,
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
                "tw-px-1": !isFullScreen,
              })}
              style={{ paddingLeft: isFullScreen ? `${level * 20 + 4}px` : `${level * 20}px` }}
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
                {isGroupDocument && (
                  <UsersIcon aria-label="Document familial" title="Document familial" className="tw-min-w-4 tw-w-4 tw-h-4 tw-text-main75" />
                )}
                {(itemData.movable === false || isFromOtherPerson) && (
                  <LockClosedIcon
                    className="tw-w-3 tw-h-3 tw-text-gray-700"
                    title={isFromOtherPerson ? "Document d'un autre membre de la famille" : "Ne peut pas être déplacé"}
                  />
                )}
              </span>

              {/* Edit button for folders (only visible on hover and if movable) */}
              {isFolder && itemData.movable !== false && (
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
            {isFullScreen && (
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
      <div
        className="tw-bg-main75"
        style={{
          ...tree.getDragLineStyle(),
          height: "3px",
        }}
      />
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
  currentId: string;
  className?: string;
  isFullScreen?: boolean;
  isInDropzone: boolean;
  setIsInDropzone: (isInDropzone: boolean) => void;
}

export function DocumentsTreeWrapper({
  treeKey,
  treeData,
  onSaveOrder,
  expandedItems,
  onDocumentClick,
  onFolderEdit,
  currentId,
  isInDropzone,
  setIsInDropzone,
  className = "tw-relative tw-p-4",
  isFullScreen,
}: DocumentsTreeWrapperProps) {
  return (
    <div
      data-testid="documents-tree-wrapper"
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
        currentId={currentId}
        isFullScreen={isFullScreen}
      />
    </div>
  );
}

interface DocumentsDropzoneProps {
  setIsInDropzone: (val: boolean) => void;
  onAddDocuments: (docs: Array<Document | Folder>) => Promise<void>;
  personId?: string;
  user: UserInstance | null;
  folderOptions: Array<FolderOption & { level: number }>;
  uploadBasePath?: string;
}

export function DocumentsDropzone({ setIsInDropzone, onAddDocuments, personId, user, folderOptions, uploadBasePath }: DocumentsDropzoneProps) {
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
            personId,
            user,
            folders: folderOptions,
            onSave: onAddDocuments,
            uploadBasePath,
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

// Utility hook for building tree data
export function useDocumentTreeData(allDocuments: DocumentOrFolder[], currentId: string, entityType: LinkedItemType = "person") {
  const treeData = useMemo(() => {
    if (!currentId) {
      return {
        root: {
          _id: "root",
          name: "Documents",
          type: "folder",
          children: [],
          createdAt: new Date(),
          createdBy: "system",
        } as DocumentOrFolder & { children: string[] },
      };
    }

    const data: Record<string, DocumentOrFolder & { children?: string[] }> = {
      root: {
        _id: "root",
        name: "Documents",
        type: "folder",
        children: [],
        createdAt: new Date(),
        createdBy: "system",
        linkedItem: { _id: currentId, type: entityType },
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
  }, [allDocuments, currentId, entityType]);

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

  return { treeData, defaultExpandedItems, treeKey };
}

// Utility function for building folder options for upload modal
export function useFolderOptions(allDocuments: DocumentOrFolder[]) {
  return useMemo(() => {
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
}
