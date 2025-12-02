import { useMemo } from "react";
import { createOnDropHandler, dragAndDropFeature, hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { FolderIcon, FolderOpenIcon, PencilSquareIcon, FolderPlusIcon } from "@heroicons/react/24/outline";
import cn from "classnames";
import type { Folder } from "../types/document";

interface FolderTreeEditorProps {
  folders: Array<Folder>;
  onFoldersChange: (folders: Array<Folder>) => void;
  onFolderEdit: (folder: Folder) => void;
  onAddFolder: () => void;
  color?: "main" | "blue-900";
  title?: string;
  description?: string;
}

type FolderWithChildren = Folder & { children?: string[] };

export default function FolderTreeEditor({
  folders,
  onFoldersChange,
  onFolderEdit,
  onAddFolder,
  color = "main",
  title = "Configuration des dossiers",
  description = "Vous pouvez ajouter des dossiers qui seront affichés dans les documents de chaque personne.",
}: FolderTreeEditorProps) {
  // Convert flat folder array to tree structure
  const treeData = useMemo(() => {
    const data: Record<string, FolderWithChildren> = {
      root: {
        _id: "root",
        name: "Racine",
        type: "folder",
        children: [],
        createdAt: new Date(),
        createdBy: "system",
        parentId: undefined,
        position: undefined,
      },
    };

    // Add all folders to data
    folders.forEach((folder) => {
      data[folder._id] = { ...folder, children: [] };
    });

    // Build children arrays
    folders.forEach((folder) => {
      const parentId = folder.parentId || "root";
      if (data[parentId]) {
        if (!data[parentId].children) data[parentId].children = [];
        if (!data[parentId].children.includes(folder._id)) {
          data[parentId].children.push(folder._id);
        }
      }
    });

    return data;
  }, [folders]);

  // Calculate expanded items
  const expandedItems = useMemo(() => {
    const expanded = ["root"];
    Object.entries(treeData).forEach(([id, item]) => {
      if (item.children && item.children.length > 0) {
        expanded.push(id);
      }
    });
    return expanded;
  }, [treeData]);

  // Create a key that changes when folders change to force tree re-render
  const treeKey = useMemo(() => {
    return folders.map((f) => f._id).join("-") + "-" + expandedItems.join("-");
  }, [folders, expandedItems]);

  const handleSaveOrder = (itemId: string, newChildren: string[]) => {
    // Update the tree data structure
    treeData[itemId].children = newChildren;

    // Convert back to flat array with parentId and position
    const updatedFolders: Folder[] = [];
    const processItem = (id: string, parentId: string | undefined, position: number) => {
      const item = treeData[id];
      if (!item || id === "root") return;

      const { children, ...folderWithoutChildren } = item;
      updatedFolders.push({
        ...folderWithoutChildren,
        parentId: parentId === "root" ? undefined : parentId,
        position,
      } as Folder);

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

    onFoldersChange(updatedFolders);
  };

  return (
    <div className="tw-flex tw-flex-col tw-gap-4">
      {/* Header with description */}
      <div>
        <h3 className="tw-text-xl tw-mb-2">{title}</h3>
        {description && (
          <div className="tw-border-l-4 tw-border-blue-500 tw-bg-blue-100 tw-p-4 tw-text-blue-700" role="alert">
            {description}
          </div>
        )}
      </div>

      {/* Tree view */}
      <div className="tw-border tw-border-gray-200 tw-rounded-lg tw-p-4 tw-bg-white">
        <FolderTree
          key={treeKey}
          treeData={treeData}
          onSaveOrder={handleSaveOrder}
          expandedItems={expandedItems}
          onFolderEdit={onFolderEdit}
          color={color}
        />
      </div>

      {/* Add folder button */}
      <div>
        <button type="button" className={`button-submit !tw-bg-${color} tw-flex tw-items-center tw-gap-2`} onClick={onAddFolder}>
          <FolderPlusIcon className="tw-w-5 tw-h-5" />
          Ajouter un dossier
        </button>
      </div>
    </div>
  );
}

// Internal tree component
function FolderTree({
  treeData,
  onSaveOrder,
  expandedItems,
  onFolderEdit,
  color,
}: {
  treeData: Record<string, FolderWithChildren>;
  onSaveOrder: (itemId: string, newChildren: string[]) => void;
  expandedItems: string[];
  onFolderEdit: (folder: Folder) => void;
  color: "main" | "blue-900";
}) {
  const syncDataLoader = {
    getItem: (id: string) => treeData[id],
    getChildren: (id: string) => treeData[id]?.children ?? [],
  };

  const tree = useTree<FolderWithChildren>({
    initialState: {
      expandedItems: expandedItems,
    },
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: () => true,
    canDrag: (items) =>
      items.every((item) => {
        return item.getId() !== "root";
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
    <div {...tree.getContainerProps()} className="tw-flex tw-flex-col tw-text-sm">
      {tree.getItems().map((item) => {
        const itemData = item.getItemData();
        if (item.getId() === "root") return null;

        const level = item.getItemMeta().level;
        const isDraggingOver = (item.isDraggingOver?.() && item.isUnorderedDragTarget?.()) || false;

        return (
          <div
            key={item.getId()}
            {...item.getProps()}
            className={cn("tw-flex tw-items-center tw-cursor-pointer tw-group tw-py-1", {
              "tw-bg-main50": isDraggingOver,
              "hover:tw-bg-gray-50": true,
            })}
            onClick={(e) => {
              e.stopPropagation();
              if (item.isExpanded()) {
                item.collapse();
              } else {
                item.expand();
              }
            }}
          >
            <div className="tw-flex-grow tw-flex tw-items-center tw-gap-2 tw-overflow-hidden tw-px-2" style={{ paddingLeft: `${level * 20 + 8}px` }}>
              {/* Folder icon */}
              {item.isExpanded() ? (
                <FolderOpenIcon className="tw-min-w-5 tw-w-5 tw-h-5 tw-text-yellow-600" />
              ) : (
                <FolderIcon className="tw-min-w-5 tw-w-5 tw-h-5 tw-text-yellow-600/60" />
              )}

              {/* Folder name */}
              <span className="tw-truncate tw-flex tw-items-center tw-gap-1">{itemData.name}</span>

              {/* Edit button */}
              <button
                type="button"
                className={`tw-p-1 tw-rounded hover:tw-scale-125 hover:tw-text-${color} tw-transition-colors tw-invisible group-hover:tw-visible focus:tw-visible`}
                onClick={(e) => {
                  e.stopPropagation();
                  onFolderEdit(itemData as Folder);
                }}
                title="Éditer le dossier"
                aria-label="Éditer le dossier"
              >
                <PencilSquareIcon className="tw-w-4 tw-h-4 tw-text-gray-600" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
