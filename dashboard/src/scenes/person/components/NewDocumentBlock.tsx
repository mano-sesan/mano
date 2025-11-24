import { useMemo } from "react";
import { toast } from "react-toastify";
import { useRecoilValue } from "recoil";
import { organisationAuthentifiedState } from "../../../recoil/auth";
import { usePreparePersonForEncryption } from "../../../recoil/persons";
import API, { tryFetchExpectOk } from "../../../services/api";
import type { PersonPopulated } from "../../../types/person";
import type { DocumentWithLinkedItem, FolderWithLinkedItem, Document, LinkedItem } from "../../../types/document";
import { encryptAction } from "../../../recoil/actions";
import { useDataLoader } from "../../../services/dataLoader";
import isEqual from "react-fast-compare";
import { removeOldDefaultFolders } from "../../../utils/documents";
import { createOnDropHandler, dragAndDropFeature, hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import cn from "classnames";
import { formatDateTimeWithNameOfDay } from "../../../services/date";
import UserName from "../../../components/UserName";

interface NewDocumentBlockProps {
  person: PersonPopulated;
}

type DocumentOrFolder = DocumentWithLinkedItem | FolderWithLinkedItem;

export default function NewDocumentBlock({ person }: NewDocumentBlockProps) {
  const { refresh } = useDataLoader();
  const organisation = useRecoilValue(organisationAuthentifiedState);
  const { encryptPerson } = usePreparePersonForEncryption();

  // Build default folders and all documents
  const allDocuments = useMemo(() => {
    if (!person) return [];

    const needsActionsFolder =
      !person.documentsForModule?.some((d) => d._id === "actions") && person.documentsForModule?.some((d) => d.linkedItem.type === "action");

    const actionsFolder: FolderWithLinkedItem = {
      _id: "actions",
      name: "Actions",
      position: -1,
      parentId: "root",
      type: "folder",
      linkedItem: {
        _id: person._id,
        type: "person",
      } as LinkedItem,
      movable: false,
      createdAt: new Date(),
      createdBy: "admin",
    };

    const defaultFolders: Array<FolderWithLinkedItem> = (organisation.defaultPersonsFolders || []).map((folder) => ({
      ...folder,
      movable: false,
      linkedItem: {
        _id: person._id,
        type: "person",
      } as LinkedItem,
    }));

    return [
      needsActionsFolder ? actionsFolder : undefined,
      ...removeOldDefaultFolders([...(person.documentsForModule || []), ...(person.groupDocuments || [])], defaultFolders),
    ]
      .filter((e) => e)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [person, organisation.defaultPersonsFolders]);

  // Convert to tree data structure
  const treeData = useMemo(() => {
    if (!person) {
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
        linkedItem: { _id: person._id, type: "person" } as LinkedItem,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDocuments, person?._id]);

  const syncDataLoader = {
    getItem: (id: string) => treeData[id],
    getChildren: (id: string) => treeData[id]?.children ?? [],
  };

  const handleSaveOrder = async (itemId: string, newChildren: string[]) => {
    if (!person) return;

    // Update the tree data structure
    treeData[itemId].children = newChildren;

    // Convert back to flat array with parentId
    const updatedDocs: DocumentOrFolder[] = [];
    const processItem = (id: string, parentId: string | undefined, position: number) => {
      const item = treeData[id];
      if (!item || id === "root") return;

      updatedDocs.push({
        ...item,
        parentId: parentId === "root" ? undefined : parentId,
        position,
      });

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

    // Save to API
    const personNextDocuments = updatedDocs.filter((d) => d.linkedItem.type === "person" && d._id !== "actions");

    const [personError] = await tryFetchExpectOk(async () => {
      return API.put({
        path: `/person/${person._id}`,
        body: await encryptPerson({
          ...person,
          documents: [
            ...personNextDocuments,
            ...(person.documents || []).filter((docOrFolder) => {
              const document = docOrFolder as unknown as Document;
              return !!document.group;
            }),
          ],
        }),
      });
    });

    if (personError) {
      toast.error("Erreur lors de l'enregistrement des documents");
      return;
    }

    // Update action documents
    const actionNextDocuments = updatedDocs.filter((d) => d.linkedItem.type === "action");
    const actionIds = [...new Set(actionNextDocuments.map((d) => d.linkedItem._id))];

    for (const actionId of actionIds) {
      const action = person.actions.find((a) => a._id === actionId);
      if (!action) continue;

      const actionDocs = actionNextDocuments.filter((d) => d.linkedItem._id === actionId);
      if (isEqual(action.documents, actionDocs)) continue;

      await tryFetchExpectOk(async () => {
        return API.put({
          path: `/action/${actionId}`,
          body: await encryptAction({
            ...action,
            documents: actionDocs,
          }),
        });
      });
    }

    toast.success("Documents mis à jour");
    refresh();
  };

  const tree = useTree<DocumentOrFolder & { children?: string[] }>({
    initialState: {
      expandedItems: ["root"],
    },
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().type === "folder",
    canDrag: (items) => items.every((item) => item.getItemData().movable !== false),
    canReorder: true,
    onDrop: createOnDropHandler((item, newChildren) => {
      handleSaveOrder(item.getId(), newChildren);
    }),
    indent: 20,
    dataLoader: syncDataLoader,
    features: [syncDataLoaderFeature, hotkeysCoreFeature, dragAndDropFeature],
  });

  // Safety check after all hooks
  if (!person) {
    return <div className="tw-p-4">Chargement...</div>;
  }

  return (
    <div className="tw-p-4">
      <h3 className="tw-text-xl tw-mb-4">Documents de {person.name}</h3>

      <div {...tree.getContainerProps()} className="tw-flex tw-flex-col">
        {tree.getItems().map((item, index) => {
          const itemData = item.getItemData();
          if (item.getId() === "root") return null;

          const isFolder = itemData.type === "folder";
          const level = item.getItemMeta().level - 1;

          return (
            <div
              key={item.getId()}
              {...item.getProps()}
              style={{ paddingLeft: `${level * 20}px` }}
              className={cn("tw-py-2 tw-px-2 tw-flex tw-items-center tw-gap-2 tw-border-b tw-cursor-pointer hover:tw-bg-gray-50", {
                "tw-bg-blue-50": item.isFocused(),
                "tw-bg-gray-100": index % 2 === 0,
              })}
            >
              {/* Expand/collapse button for folders */}
              {isFolder && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.isExpanded()) {
                      item.collapse();
                    } else {
                      item.expand();
                    }
                  }}
                  className="tw-w-4 tw-text-gray-600"
                >
                  {item.isExpanded() ? "▼" : "►"}
                </button>
              )}
              {!isFolder && <span className="tw-w-4" />}

              {/* Icon */}
              <span className="tw-text-lg">{isFolder ? (item.isExpanded() ? "📂" : "📁") : "📃"}</span>

              {/* Name */}
              <span className="tw-flex-1 tw-truncate">
                {itemData.name}
                {String(itemData.movable)}
              </span>

              {/* Locked indicator */}
              {itemData.movable === false && (
                <span className="tw-text-gray-400" title="Ne peut pas être déplacé">
                  🔒
                </span>
              )}

              {/* Metadata */}
              <div className="tw-flex tw-gap-4 tw-text-xs tw-text-gray-500">
                <span>
                  <UserName id={itemData.createdBy} />
                </span>
                <span>{formatDateTimeWithNameOfDay(itemData.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
