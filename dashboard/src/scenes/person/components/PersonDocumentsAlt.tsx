import { useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useRecoilValue } from "recoil";
import { v4 as uuidv4 } from "uuid";
import { organisationAuthentifiedState, userState } from "../../../recoil/auth";
import { usePreparePersonForEncryption } from "../../../recoil/persons";
import API, { tryFetchExpectOk } from "../../../services/api";
import type { PersonPopulated } from "../../../types/person";
import type { DocumentWithLinkedItem, FolderWithLinkedItem, Document, Folder, LinkedItem } from "../../../types/document";
import { encryptAction } from "../../../recoil/actions";
import { useDataLoader } from "../../../services/dataLoader";
import isEqual from "react-fast-compare";
import { removeOldDefaultFolders } from "../../../utils/documents";
import { createOnDropHandler, dragAndDropFeature, hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import cn from "classnames";
import { handleFilesUpload } from "../../../components/DocumentsGeneric";
import { loadFreshPersonData } from "../../../utils/loadFreshPersonData";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../../../components/tailwind/Modal";

interface PersonDocumentsAltProps {
  person: PersonPopulated;
}

type DocumentOrFolder = DocumentWithLinkedItem | FolderWithLinkedItem;

// Separate tree component that can be remounted with a key
function DocumentTree({
  treeData,
  onSaveOrder,
}: {
  treeData: Record<string, DocumentOrFolder & { children?: string[] }>;
  onSaveOrder: (itemId: string, newChildren: string[]) => void;
}) {
  const syncDataLoader = {
    getItem: (id: string) => treeData[id],
    getChildren: (id: string) => treeData[id]?.children ?? [],
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
      onSaveOrder(item.getId(), newChildren);
    }),
    indent: 20,
    dataLoader: syncDataLoader,
    features: [syncDataLoaderFeature, hotkeysCoreFeature, dragAndDropFeature],
  });

  return (
    <div {...tree.getContainerProps()} className="tw-flex tw-flex-col">
      {tree.getItems().map((item, _index) => {
        const itemData = item.getItemData();
        if (item.getId() === "root") return null;

        const isFolder = itemData.type === "folder";
        const level = item.getItemMeta().level;
        const isDraggingOver = (item.isDraggingOver?.() && item.isUnorderedDragTarget?.()) || false;

        return (
          <div
            key={item.getId()}
            {...item.getProps()}
            style={{ paddingLeft: `${level * 20}px` }}
            className={cn("tw-py-2 tw-px-2 tw-flex tw-items-center tw-gap-2 tw-cursor-pointer", {
              "tw-bg-blue-50": item.isFocused() && !isDraggingOver,
              "tw-bg-main/50": isDraggingOver && isFolder,
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
              {itemData.movable === false && (
                <span className="tw-text-gray-400" title="Ne peut pas être déplacé">
                  🔒
                </span>
              )}
            </span>
          </div>
        );
      })}
      <div
        style={{
          ...tree.getDragLineStyle(),
          background: "black",
          height: "3px",
        }}
      />
    </div>
  );
}

export default function PersonDocumentsAlt({ person }: PersonDocumentsAltProps) {
  const { refresh } = useDataLoader();
  const organisation = useRecoilValue(organisationAuthentifiedState);
  const { encryptPerson } = usePreparePersonForEncryption();
  const user = useRecoilValue(userState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resetFileInputKey, setResetFileInputKey] = useState(0);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Create a key that changes when documents change to force tree re-render
  const treeKey = useMemo(() => {
    return allDocuments.map((d) => d._id).join("-");
  }, [allDocuments]);

  const handleSaveOrder = async (itemId: string, newChildren: string[]) => {
    if (!person) return;

    const callId = Date.now();
    console.log(`=== handleSaveOrder CALLED [${callId}] ===`);
    console.log("itemId:", itemId);
    console.log("newChildren:", newChildren);

    // Update the tree data structure immediately for UI responsiveness
    treeData[itemId].children = newChildren;

    // Debounce the actual save - if multiple drops happen within 100ms, only save once
    if (saveTimeoutRef.current) {
      console.log(`=== Clearing previous save timeout [${callId}] ===`);
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      console.log(`=== handleSaveOrder EXECUTING SAVE [${callId}] ===`);
      console.log("treeData to save:", JSON.parse(JSON.stringify(treeData)));

      // Convert back to flat array with parentId
      const updatedDocs: DocumentOrFolder[] = [];
      const processItem = (id: string, parentId: string | undefined, position: number) => {
        const item = treeData[id];
        if (!item || id === "root") return;

        console.log(`Processing item: ${id}, parentId: ${parentId}, position: ${position}`, item);

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

      console.log("updatedDocs (all):", updatedDocs);

      // Load fresh person data to avoid overwriting concurrent changes
      const freshPerson = await loadFreshPersonData(person._id);
      if (!freshPerson) {
        toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
        console.log("=== handleSaveOrder ERROR: Could not load fresh data ===");
        return;
      }
      console.log("Fresh person loaded, documents count:", freshPerson.documents?.length || 0);

      // Save to API
      const personNextDocuments = updatedDocs.filter((d) => d.linkedItem.type === "person" && d._id !== "actions");
      console.log("personNextDocuments (filtered):", personNextDocuments);

      const groupDocuments = (freshPerson.documents || []).filter((docOrFolder) => {
        const document = docOrFolder as unknown as Document;
        return !!document.group;
      });
      console.log("groupDocuments:", groupDocuments);

      const finalDocuments = [...personNextDocuments, ...groupDocuments];
      console.log("finalDocuments to save:", finalDocuments);

      const [personError] = await tryFetchExpectOk(async () => {
        return API.put({
          path: `/person/${person._id}`,
          body: await encryptPerson({
            ...freshPerson,
            documents: finalDocuments,
          }),
        });
      });

      if (personError) {
        toast.error("Erreur lors de l'enregistrement des documents");
        console.log("=== handleSaveOrder ERROR ===");
        return;
      }

      // Update action documents
      const actionNextDocuments = updatedDocs.filter((d) => d.linkedItem.type === "action");
      const actionIds = [...new Set(actionNextDocuments.map((d) => d.linkedItem._id))];

      console.log("actionNextDocuments:", actionNextDocuments);
      console.log("actionIds:", actionIds);

      for (const actionId of actionIds) {
        const action = freshPerson.actions.find((a) => a._id === actionId);
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

      console.log(`=== handleSaveOrder SUCCESS [${callId}] ===`);
      toast.success("Documents mis à jour");
      refresh();
    }, 100); // Wait 100ms to see if more drops come in
  };

  // Safety check after all hooks
  if (!person) {
    return <div className="tw-p-4">Chargement...</div>;
  }

  const defaultFolders: Array<FolderWithLinkedItem> = (organisation.defaultPersonsFolders || []).map((folder) => ({
    ...folder,
    movable: false,
    linkedItem: {
      _id: person._id,
      type: "person",
    } as LinkedItem,
  }));

  const handleAddDocuments = async (newDocuments: Array<Document | Folder>) => {
    if (!newDocuments || newDocuments.length === 0) return;

    // Load fresh person data to prevent race conditions during long uploads
    const freshPerson = await loadFreshPersonData(person._id);
    if (!freshPerson) {
      toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
      return;
    }

    const [personError] = await tryFetchExpectOk(async () => {
      // Use fresh person data instead of stale prop
      const oldDocuments = freshPerson.documents?.length ? [...freshPerson.documents] : [...defaultFolders];
      return API.put({
        path: `/person/${person._id}`,
        body: await encryptPerson({
          ...freshPerson, // Use fresh person data
          // If there are no document yet and default documents are present,
          // we save the default documents since they are modified by the user.
          documents: [...oldDocuments, ...newDocuments],
        }),
      });
    });
    if (personError) {
      toast.error("Erreur lors de la création du document, vous pouvez contactez le support");
      return;
    }
    if (newDocuments.filter((d) => d.type === "document").length > 1) toast.success("Documents enregistrés !");
    if (newDocuments.filter((d) => d.type === "folder").length > 0) toast.success("Dossier créé !");
    refresh();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Veuillez entrer un nom pour le dossier");
      return;
    }

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
  };

  return (
    <div className="tw-p-4">
      <div className="tw-flex tw-justify-between tw-items-center">
        <h3 className="tw-text-xl tw-mb-4">Documents</h3>
        <div className="tw-flex tw-gap-2">
          <button
            type="button"
            className="tw-text-sm tw-text-blue-600 hover:tw-text-blue-800 tw-font-medium"
            onClick={() => setShowCreateFolderModal(true)}
          >
            📁 Créer un dossier
          </button>
          <button
            type="button"
            className="tw-text-sm tw-text-blue-600 hover:tw-text-blue-800 tw-font-medium"
            onClick={() => fileInputRef.current?.click()}
          >
            + Ajouter un document
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          key={resetFileInputKey}
          className="tw-hidden"
          onChange={async (e) => {
            const docsResponses = await handleFilesUpload({
              files: e.target.files,
              personId: person._id,
              user,
            });
            if (docsResponses) {
              await handleAddDocuments(docsResponses);
            }
            setResetFileInputKey((k) => k + 1);
          }}
        />
      </div>

      <DocumentTree key={treeKey} treeData={treeData} onSaveOrder={handleSaveOrder} />

      {showCreateFolderModal && (
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
              className="tw-rounded tw-bg-gray-200 tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-gray-700 hover:tw-bg-gray-300"
              onClick={() => {
                setShowCreateFolderModal(false);
                setNewFolderName("");
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="tw-rounded tw-bg-blue-600 tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-white hover:tw-bg-blue-700"
              onClick={handleCreateFolder}
            >
              Créer
            </button>
          </ModalFooter>
        </ModalContainer>
      )}
    </div>
  );
}
