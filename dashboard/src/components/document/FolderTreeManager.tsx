import { useMemo, useRef, useState } from "react";
import { createOnDropHandler, dragAndDropFeature, hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import cn from "classnames";
import { FolderIcon, FolderOpenIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { v4 as uuidv4 } from "uuid";
import type { Folder } from "../../types/document";
import { CreateFolderModal, EditFolderModal } from "./FolderModals";

type TreeItem = Folder & { children?: string[] };

function buildTreeData(folders: Folder[]): Record<string, TreeItem> {
  const data: Record<string, TreeItem> = {
    root: {
      _id: "root",
      name: "Dossier Racine",
      type: "folder",
      parentId: "NA",
      position: 0,
      createdAt: new Date(),
      createdBy: "system",
      movable: false,
      children: [],
    } as unknown as TreeItem,
  };

  folders.forEach((folder) => {
    data[folder._id] = { ...folder, children: [] };
  });

  folders.forEach((folder) => {
    const parentId = folder.parentId || "root";
    if (!data[parentId]) return;
    if (!data[parentId].children) data[parentId].children = [];
    data[parentId].children.push(folder._id);
  });

  // Respect saved ordering (position) for each folder's children.
  for (const item of Object.values(data)) {
    if (!item.children?.length) continue;
    item.children.sort((aId, bId) => {
      const aPos = data[aId]?.position;
      const bPos = data[bId]?.position;
      if (aPos === undefined && bPos === undefined) return 0;
      if (aPos === undefined) return 1;
      if (bPos === undefined) return -1;
      return aPos - bPos;
    });
  }

  return data;
}

function computeDefaultExpandedItems(treeData: Record<string, TreeItem>): string[] {
  const expanded = ["root"];
  for (const [id, item] of Object.entries(treeData)) {
    if (id === "root") continue;
    if (item.children?.length) expanded.push(id);
  }
  return expanded;
}

function flattenTreeToFolders(treeData: Record<string, TreeItem>): Folder[] {
  const result: Folder[] = [];

  const walk = (id: string, parentId: string, position: number) => {
    const item = treeData[id];
    if (!item || id === "root") return;
    const { children: _children, ...folder } = item;
    result.push({
      ...folder,
      parentId: parentId === "root" ? "root" : parentId,
      position,
      type: "folder",
    });
    (item.children || []).forEach((childId, idx) => walk(childId, id, idx));
  };

  (treeData.root.children || []).forEach((childId, idx) => walk(childId, "root", idx));
  return result;
}

export default function FolderTreeManager({
  folders,
  onChange,
  userId,
}: {
  folders: Folder[];
  onChange: (folders: Folder[]) => void;
  userId: string;
}) {
  // Keep treeData as a memo and mutate it like we already do elsewhere (simple + responsive).
  const treeData = useMemo(() => buildTreeData(folders), [folders]);
  const expandedItems = useMemo(() => computeDefaultExpandedItems(treeData), [treeData]);
  const treeKey = useMemo(() => folders.map((f) => f._id).join("-") + "-" + expandedItems.join("-"), [folders, expandedItems]);

  const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const syncDataLoader = {
    getItem: (id: string) => treeData[id],
    getChildren: (id: string) => treeData[id]?.children ?? [],
  };

  const tree = useTree<TreeItem>({
    initialState: {
      expandedItems,
    },
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: () => true,
    canDrag: (items) => items.every((item) => item.getId() !== "root"),
    canReorder: true,
    onDrop: createOnDropHandler((item, newChildren) => {
      if (!item.isExpanded()) item.expand();
      treeData[item.getId()].children = newChildren;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        onChange(flattenTreeToFolders(treeData));
      }, 0);
    }),
    indent: 20,
    dataLoader: syncDataLoader,
    features: [syncDataLoaderFeature, hotkeysCoreFeature, dragAndDropFeature],
  });

  return (
    <div className="tw-flex tw-flex-col tw-gap-3 tw-p-4">
      <div className="tw-flex tw-justify-between tw-items-center">
        <h3 className="tw-text-lg tw-mb-0">Dossiers par défaut</h3>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          Ajouter un dossier
        </button>
      </div>

      <div key={treeKey} {...tree.getContainerProps()} className="tw-flex tw-flex-col tw-text-sm">
        {tree.getItems().map((item) => {
          const data = item.getItemData();
          if (item.getId() === "root") return null;
          const level = item.getItemMeta().level;
          const isDraggingOver = (item.isDraggingOver?.() && item.isUnorderedDragTarget?.()) || false;

          return (
            <div
              key={item.getId()}
              {...item.getProps()}
              className={cn("tw-flex tw-items-center tw-cursor-pointer tw-group tw-rounded", {
                "tw-bg-main50": isDraggingOver,
                "hover:tw-bg-gray-50": true,
              })}
              onClick={(e) => {
                e.stopPropagation();
                if (item.isExpanded()) item.collapse();
                else item.expand();
              }}
            >
              <div className="tw-flex-grow tw-flex tw-items-center tw-gap-2 tw-overflow-hidden" style={{ paddingLeft: `${level * 20}px` }}>
                {item.isExpanded() ? (
                  <FolderOpenIcon className="tw-min-w-5 tw-w-5 tw-h-5 tw-text-yellow-600" />
                ) : (
                  <FolderIcon className="tw-min-w-5 tw-w-5 tw-h-5 tw-text-yellow-600/60" />
                )}
                <span className="tw-truncate">{data.name}</span>
                <button
                  type="button"
                  className="tw-p-1 tw-rounded hover:tw-scale-125 hover:tw-text-main tw-transition-colors tw-invisible group-hover:tw-visible focus:tw-visible"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFolderToEdit(data);
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
        <div className="tw-bg-main75" style={{ ...tree.getDragLineStyle(), height: "3px" }} />
      </div>

      <CreateFolderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        userId={userId}
        onCreateFolder={async (folder) => {
          onChange([
            ...folders,
            {
              ...folder,
              parentId: folder.parentId ?? "root",
              position: folder.position ?? folders.length,
              _id: folder._id || uuidv4(),
              createdBy: folder.createdBy || userId,
            },
          ]);
        }}
      />
      <EditFolderModal
        folder={folderToEdit}
        onClose={() => setFolderToEdit(null)}
        onUpdateFolder={async (folder, newName) => {
          onChange(folders.map((f) => (f._id === folder._id ? { ...f, name: newName } : f)));
          setFolderToEdit(null);
        }}
        onDeleteFolder={async (folder) => {
          onChange(
            folders
              .filter((f) => f._id !== folder._id)
              .map((f) => {
                if (f.parentId === folder._id) return { ...f, parentId: "root" };
                return f;
              })
          );
          setFolderToEdit(null);
        }}
      />
    </div>
  );
}
