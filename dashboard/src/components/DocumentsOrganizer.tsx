import { useMemo, useCallback, useEffect, useState } from "react";
import type { DocumentWithLinkedItem, FolderWithLinkedItem, Folder } from "../types/document";
import { useRecoilValue } from "recoil";
import { organisationAuthentifiedState } from "../recoil/auth";
import UserName from "./UserName";
import { formatDateTimeWithNameOfDay } from "../services/date";
import { useTree } from "@headless-tree/react";
import type { ItemInstance, DragTarget } from "@headless-tree/core";
import { dragAndDropFeature, hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";

type Item = DocumentWithLinkedItem | FolderWithLinkedItem | Folder;

interface DocumentForTree extends DocumentWithLinkedItem {}
interface FolderForTree extends FolderWithLinkedItem {}

interface DocumentsOrganizerProps<T extends Item> {
  items: T[];
  onSave: (newOrder: T[]) => Promise<boolean>;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onFolderClick: (folder: FolderForTree) => void;
  onDocumentClick?: (document: DocumentForTree) => void;
  color: "main" | "blue-900";
  htmlId: "social" | "family" | "medical";
  rootFolderName?: "Dossier Racine" | "👪 Documents familiaux";
  debug?: boolean;
}

const modalWidth = window.innerWidth * 0.9;
const informationsWidth = modalWidth * 0.4;
const informationsStyle = { flexBasis: informationsWidth };

export default function DocumentsOrganizer<T extends Item>({
  items,
  htmlId,
  rootFolderName = "Dossier Racine",
  onSave,
  onDragStart,
  onDragEnd,
  onFolderClick,
  onDocumentClick,
  color,
  debug = false,
}: DocumentsOrganizerProps<T>) {
  const organisation = useRecoilValue(organisationAuthentifiedState);
  const [expandedItems, setExpandedItems] = useState<string[]>(["root"]);
  const [isDraggingInternal, setIsDraggingInternal] = useState(false);

  // Build a map for quick lookups
  const itemsMap = useMemo(() => {
    const map = new Map<string, T>();
    items.forEach((item) => map.set(item._id, item));
    return map;
  }, [items]);

  // Get children for a given parent
  const getChildren = useCallback(
    (parentId: string) => {
      return items
        .filter((item) => (item.parentId || "root") === parentId)
        .sort((a, b) => {
          // Sort by position if available
          if (a.position !== undefined && b.position !== undefined) {
            return a.position - b.position;
          }
          return 0;
        })
        .map((item) => item._id);
    },
    [items]
  );

  const handleDrop = useCallback(
    async (droppedItems: ItemInstance<string>[], target: DragTarget<string>) => {
      const droppedIds = droppedItems.map((item) => item.getId());
      const targetParentId = target.item.getId();

      // Build updated items with new parent
      const newOrder = items.map((item) => {
        if (droppedIds.includes(item._id)) {
          return {
            ...item,
            parentId: targetParentId === "root" ? undefined : targetParentId,
          };
        }
        return item;
      });

      await onSave(newOrder as T[]);
      setIsDraggingInternal(false);
      onDragEnd?.();
    },
    [items, onSave, onDragEnd]
  );

  const tree = useTree<string>({
    rootItemId: "root",
    initialState: {
      expandedItems: expandedItems,
    },
    getItemName: (item) => {
      const itemId = item.getId();
      if (itemId === "root") return rootFolderName;
      const data = itemsMap.get(itemId);
      return data?.name || "";
    },
    isItemFolder: (item) => {
      const itemId = item.getId();
      if (itemId === "root") return true;
      const data = itemsMap.get(itemId);
      return data?.type === "folder";
    },
    canDrag: (items: ItemInstance<string>[]) => {
      // Check if all items are movable
      return items.every((item) => {
        const itemId = item.getId();
        const data = itemsMap.get(itemId);
        return data?.movable !== false;
      });
    },
    canDrop: (_items, target) => {
      // Only allow dropping on folders
      const targetId = target.item.getId();
      const targetData = itemsMap.get(targetId);
      return targetId === "root" || targetData?.type === "folder";
    },
    dataLoader: {
      getItem: (itemId) => itemId,
      getChildren: (itemId) => getChildren(itemId),
    },
    features: htmlId !== "family" ? [syncDataLoaderFeature, hotkeysCoreFeature, dragAndDropFeature] : [syncDataLoaderFeature, hotkeysCoreFeature],
    onDrop: handleDrop,
  });

  // Update expanded state when tree state changes
  useEffect(() => {
    const newExpandedItems = tree
      .getItems()
      .filter((item) => item.isExpanded())
      .map((item) => item.getId());
    setExpandedItems(newExpandedItems);
  }, [tree]);

  if (!items.length) return null;

  return (
    <div id={`${htmlId}-documents`}>
      {/* Header */}
      <div className="tw-flex tw-w-full tw-border tw-border-gray-100 tw-py-1 tw-text-xs tw-text-gray-400">
        <p className="tw-m-0 tw-grow tw-pl-4">Nom</p>
        <div style={informationsStyle} className="tw-flex tw-shrink-0 tw-items-center">
          <p className="m-0 tw-shrink-0 tw-grow tw-basis-0 tw-overflow-hidden tw-truncate">Créé par</p>
          <p className="m-0 tw-shrink-0 tw-grow tw-basis-0 tw-overflow-hidden tw-truncate">Créé le</p>
        </div>
      </div>

      {/* Tree */}
      <div
        {...tree.getContainerProps()}
        className="tw-overflow-x-hidden tw-pb-10 tw-text-gray-800"
        onDragStart={(e) => {
          // Mark that we're dragging internally
          setIsDraggingInternal(true);
          onDragStart?.();
          // Stop propagation
          e.stopPropagation();
        }}
        onDragEnter={(e) => {
          // Stop propagation to prevent DocumentsDropZone from showing
          if (isDraggingInternal) {
            e.stopPropagation();
          }
        }}
        onDragOver={(e) => {
          // Stop propagation to prevent DocumentsDropZone from showing
          if (isDraggingInternal) {
            e.stopPropagation();
          }
        }}
        onDragEnd={(e) => {
          // Clear internal dragging state
          setIsDraggingInternal(false);
          e.stopPropagation();
        }}
        onDrop={(e) => {
          // Stop propagation to prevent DocumentsDropZone from intercepting
          if (isDraggingInternal) {
            e.stopPropagation();
          }
        }}
      >
        {tree.getItems().map((item, index) => {
          const itemId = item.getId();

          // Skip rendering the root item
          if (itemId === "root") {
            return null;
          }

          const data = itemsMap.get(itemId);
          if (!data) return null;

          const isFolder = data.type === "folder";
          const level = item.getItemMeta().level - 1; // Subtract 1 because root is hidden
          const movable = data.movable !== false;
          const isExpanded = item.isExpanded();

          return (
            <div
              key={itemId}
              {...item.getProps()}
              className={[
                "tw-relative tw-flex tw-justify-between tw-items-center tw-py-2 tw-pr-4 tw-cursor-pointer hover:tw-bg-gray-50 tw-transition-colors",
                `before:tw-absolute before:tw-inset-0 before:tw-pointer-events-none before:tw-bg-${color}`,
                index % 2 === 0 ? "before:tw-bg-opacity-0" : "before:tw-bg-opacity-5",
              ].join(" ")}
              style={{
                paddingLeft: `${level * 40 + 16}px`,
              }}
            >
              <div className="tw-flex tw-w-full tw-items-center tw-gap-2 tw-relative tw-z-10">
                {/* Expand/Collapse Arrow */}
                {isFolder ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isExpanded) {
                        item.collapse();
                      } else {
                        item.expand();
                      }
                    }}
                    className={`tw-flex-shrink-0 tw-w-4 tw-text-${color} hover:tw-scale-110 tw-transition tw-text-center`}
                  >
                    {isExpanded ? "▼" : "►"}
                  </button>
                ) : (
                  <span className="tw-flex-shrink-0 tw-w-4" />
                )}

                {/* Icon and Name */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isFolder) {
                      if (movable) {
                        onFolderClick(data as FolderForTree);
                      }
                    } else {
                      onDocumentClick?.(data as DocumentForTree);
                    }
                  }}
                  className="tw-flex tw-items-center tw-gap-2 tw-flex-1 tw-overflow-hidden tw-text-left"
                >
                  {/* Family document icon */}
                  {!!organisation.groupsEnabled && !isFolder && (data as DocumentWithLinkedItem).group && (
                    <span className="tw-text-xl" aria-label="Document familial" title="Document familial">
                      👪
                    </span>
                  )}

                  {/* Folder/File Icon */}
                  <span className="tw-flex-shrink-0">{isFolder ? (isExpanded ? "📂" : "📁") : "📃"}</span>

                  {/* Name */}
                  <span className="tw-truncate tw-flex-1">{data.name}</span>

                  {/* Locked icon for non-movable items */}
                  {!movable && (
                    <span
                      className="tw-opacity-50 tw-flex-shrink-0"
                      title="Ce dossier est configuré par défaut. Il ne peut pas être déplacé ou renommé."
                    >
                      🔒
                    </span>
                  )}

                  {/* Children count for folders */}
                  {isFolder && <span className="tw-text-gray-500 tw-flex-shrink-0">({getChildren(itemId).length})</span>}
                </button>

                {/* Metadata */}
                <div style={informationsStyle} className="tw-flex tw-shrink-0 tw-items-center tw-text-xs tw-text-gray-600">
                  {!["root", "treatment", "consultation"].includes(data._id) && (
                    <>
                      <p className="m-0 tw-shrink-0 tw-grow tw-basis-0 tw-overflow-hidden tw-truncate">
                        <UserName id={data.createdBy} />
                      </p>
                      <p className="m-0 tw-shrink-0 tw-grow tw-basis-0 tw-overflow-hidden tw-truncate">
                        {formatDateTimeWithNameOfDay(data.createdAt)}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Debug Info */}
              {debug && (
                <div className="tw-mt-2 tw-text-xs tw-text-gray-400 tw-overflow-auto">
                  <pre>{JSON.stringify(data, null, 2)}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
