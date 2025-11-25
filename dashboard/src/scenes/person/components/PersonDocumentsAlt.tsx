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
} from "@heroicons/react/24/outline";
import { UsersIcon } from "@heroicons/react/16/solid";
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
import { handleFilesUpload, DocumentModal } from "../../../components/DocumentsGeneric";
import { loadFreshPersonData } from "../../../utils/loadFreshPersonData";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../../../components/tailwind/Modal";
import { groupsState } from "../../../recoil/groups";

interface PersonDocumentsAltProps {
  person: PersonPopulated;
}

type DocumentOrFolder = DocumentWithLinkedItem | FolderWithLinkedItem;

// Separate tree component that can be remounted with a key
function DocumentTree({
  treeData,
  onSaveOrder,
  expandedItems,
  onDocumentClick,
  onFolderEdit,
  currentPersonId,
}: {
  treeData: Record<string, DocumentOrFolder & { children?: string[] }>;
  onSaveOrder: (itemId: string, newChildren: string[]) => void;
  expandedItems: string[];
  onDocumentClick: (document: DocumentWithLinkedItem) => void;
  onFolderEdit: (folder: FolderWithLinkedItem) => void;
  currentPersonId: string;
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
      items.every((item) => {
        const data = item.getItemData();
        // Can't drag if explicitly not movable
        if (data.movable === false) return false;
        // Can't drag documents that belong to other persons in the group
        if (data.type === "document") {
          const doc = data as DocumentWithLinkedItem;
          if (doc.linkedItem && doc.linkedItem._id !== currentPersonId) return false;
        }
        return true;
      }),
    canReorder: true,
    onDrop: createOnDropHandler((item, newChildren) => {
      onSaveOrder(item.getId(), newChildren);
    }),
    indent: 20,
    dataLoader: syncDataLoader,
    features: [syncDataLoaderFeature, hotkeysCoreFeature, dragAndDropFeature],
  });

  return (
    <div {...tree.getContainerProps()} className="tw-text-xs tw-flex tw-flex-col">
      {tree.getItems().map((item, _index) => {
        const itemData = item.getItemData();
        if (item.getId() === "root") return null;

        const isFolder = itemData.type === "folder";
        const level = item.getItemMeta().level;
        const isDraggingOver = (item.isDraggingOver?.() && item.isUnorderedDragTarget?.()) || false;

        // Check if document is from another person in the group
        const isFromOtherPerson =
          !isFolder && (itemData as DocumentWithLinkedItem).linkedItem && (itemData as DocumentWithLinkedItem).linkedItem._id !== currentPersonId;
        const isGroupDocument = !isFolder && (itemData as DocumentWithLinkedItem).group;

        return (
          <div
            key={item.getId()}
            {...item.getProps()}
            style={{ paddingLeft: `${level * 20}px` }}
            className={cn("hover:tw-text-main tw-px-1 tw-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-group", {
              // "tw-bg-blue-50": item.isFocused() && !isDraggingOver,
              "tw-bg-main50": isDraggingOver && isFolder,
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
            {/* Icon */}
            {isFolder ? (
              item.isExpanded() ? (
                <FolderOpenIcon className="tw-min-w-5 tw-w-5 tw-h-5 tw-text-yellow-600" />
              ) : (
                <FolderIcon className="tw-min-w-5 tw-w-5 tw-h-5 tw-text-yellow-600/60" />
              )
            ) : // If it's an image use the image icon
            itemData.file.mimetype.startsWith("image/") ? (
              <PhotoIcon className="tw-min-w-5 tw-w-5 tw-h-5 tw-text-gray-600" />
            ) : (
              <DocumentIcon className="tw-min-w-5 tw-w-5 tw-h-5 tw-text-gray-600" />
            )}

            {/* Name */}
            <span className="tw-truncate tw-flex tw-items-center tw-gap-1">
              <span>{itemData.name}</span>
              {isGroupDocument && <UsersIcon className="tw-min-w-4 tw-w-4 tw-h-4 tw-text-main75" />}
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
                className="tw-p-1 tw-rounded hover:tw-scale-125 hover:tw-text-main tw-transition-colors tw-invisible group-hover:tw-visible"
                onClick={(e) => {
                  e.stopPropagation();
                  onFolderEdit(itemData as FolderWithLinkedItem);
                }}
                title="Éditer le dossier"
              >
                <PencilSquareIcon className="tw-w-4 tw-h-4 tw-text-gray-600" />
              </button>
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

export default function PersonDocumentsAlt({ person }: PersonDocumentsAltProps) {
  const { refresh } = useDataLoader();
  const organisation = useRecoilValue(organisationAuthentifiedState);
  const { encryptPerson } = usePreparePersonForEncryption();
  const user = useRecoilValue(userState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resetFileInputKey, setResetFileInputKey] = useState(0);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isUpdatingFolder, setIsUpdatingFolder] = useState(false);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [isInDropzone, setIsInDropzone] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<DocumentWithLinkedItem | null>(null);
  const [folderToEdit, setFolderToEdit] = useState<FolderWithLinkedItem | null>(null);
  const [isUpdatingDocument, setIsUpdatingDocument] = useState(false);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const groups = useRecoilValue(groupsState);

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

  const canToggleGroupCheck = useMemo(() => {
    if (!organisation.groupsEnabled) return false;
    const group = groups.find((group) => (group.persons || []).includes(person._id));
    if (!group) return false;
    return true;
  }, [groups, person._id, organisation.groupsEnabled]);

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

      // Save to API
      const personNextDocuments = updatedDocs.filter((d) => d.linkedItem.type === "person" && d._id !== "actions");
      console.log("personNextDocuments (filtered):", personNextDocuments);

      // Check if anything actually changed (prevent unnecessary saves for accidental micro-drags)
      // Compare only the structure: _id, parentId, and position (what matters for ordering)
      const currentPersonDocuments = (person.documents || [])
        .filter((d) => {
          const doc = d as DocumentOrFolder;
          return doc.linkedItem?.type === "person" && d._id !== "actions";
        })
        .map((d) => ({ _id: d._id, parentId: d.parentId, position: d.position }));

      const nextPersonDocsSimplified = personNextDocuments.map((d) => ({
        _id: d._id,
        parentId: d.parentId,
        position: d.position,
      }));

      console.log("=== COMPARISON DEBUG ===");
      console.log("currentPersonDocuments (simplified):", currentPersonDocuments);
      console.log("personNextDocuments (simplified):", nextPersonDocsSimplified);
      console.log("Are they equal?", isEqual(currentPersonDocuments, nextPersonDocsSimplified));

      if (isEqual(currentPersonDocuments, nextPersonDocsSimplified)) {
        console.log(`=== No changes detected, skipping save [${callId}] ===`);
        return;
      }
      console.log("Changes detected, proceeding with save");

      // Load fresh person data to avoid overwriting concurrent changes
      const freshPerson = await loadFreshPersonData(person._id);
      if (!freshPerson) {
        toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
        console.log("=== handleSaveOrder ERROR: Could not load fresh data ===");
        return;
      }
      console.log("Fresh person loaded, documents count:", freshPerson.documents?.length || 0);

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

      // Wait for refresh to complete before showing success message
      await refresh();
      toast.success("Documents mis à jour");
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

    // Wait for refresh to complete before showing success message
    await refresh();

    // Show success toast after data is refreshed and visible
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
    setIsUpdatingFolder(true);

    // Load fresh person data
    const freshPerson = await loadFreshPersonData(person._id);
    if (!freshPerson) {
      toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
      setIsUpdatingFolder(false);
      return;
    }

    const [personError] = await tryFetchExpectOk(async () => {
      return API.put({
        path: `/person/${person._id}`,
        body: await encryptPerson({
          ...freshPerson,
          documents: (freshPerson.documents || []).map((d) => {
            if (d._id === folder._id) return { ...d, name: newName };
            return d;
          }),
        }),
      });
    });
    if (personError) {
      toast.error("Erreur lors de la mise à jour du dossier");
      setIsUpdatingFolder(false);
      return;
    }

    await refresh();
    setIsUpdatingFolder(false);
    setFolderToEdit(null);
    toast.success("Dossier mis à jour");
  };

  const handleDeleteFolder = async (folder: FolderWithLinkedItem) => {
    setIsDeletingFolder(true);

    // Load fresh person data to prevent race conditions
    const freshPerson = await loadFreshPersonData(person._id);
    if (!freshPerson) {
      toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
      setIsDeletingFolder(false);
      return;
    }

    const [personError] = await tryFetchExpectOk(async () => {
      return API.put({
        path: `/person/${person._id}`,
        body: await encryptPerson({
          ...freshPerson,
          documents: (freshPerson.documents || [])
            .filter((f) => f._id !== folder._id)
            .map((item) => {
              // Move children to root
              if (item.parentId === folder._id) return { ...item, parentId: undefined };
              return item;
            }),
        }),
      });
    });
    if (personError) {
      toast.error("Erreur lors de la suppression du dossier");
      setIsDeletingFolder(false);
      return;
    }

    await refresh();
    setIsDeletingFolder(false);
    setFolderToEdit(null);
    toast.success("Dossier supprimé");
  };

  return (
    <div>
      <div className="tw-flex tw-justify-between tw-items-center tw-border-b tw-border-main25 tw-py-2 tw-px-4">
        <h3 className="tw-text-xl tw-mb-0">Documents</h3>
        <div className="tw-flex tw-gap-2">
          <button
            type="button"
            aria-label="Créer un dossier"
            className="tw-h-8 tw-w-8 tw-rounded-full tw-bg-main tw-text-white tw-transition hover:tw-scale-110 tw-flex tw-items-center tw-justify-center"
            onClick={() => setShowCreateFolderModal(true)}
          >
            <FolderPlusIcon className="tw-w-5 tw-h-5" />
          </button>
          <button
            type="button"
            aria-label="Ajouter un document"
            className="tw-h-8 tw-w-8 tw-rounded-full tw-bg-main tw-text-white tw-transition hover:tw-scale-110 tw-flex tw-items-center tw-justify-center"
            onClick={() => fileInputRef.current?.click()}
          >
            <DocumentPlusIcon className="tw-w-5 tw-h-5" />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          key={resetFileInputKey}
          className="tw-hidden"
          onChange={async (e) => {
            await handleFilesUpload({
              files: e.target.files,
              personId: person._id,
              user,
              folders: folderOptions,
              onSave: handleAddDocuments,
            });
            setResetFileInputKey((k) => k + 1);
          }}
        />
      </div>

      <div
        className="tw-relative tw-p-4"
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
          onSaveOrder={handleSaveOrder}
          expandedItems={defaultExpandedItems}
          onDocumentClick={setDocumentToEdit}
          onFolderEdit={setFolderToEdit}
          currentPersonId={person._id}
        />

        {isInDropzone && (
          <div
            className="tw-absolute tw-inset-0 tw-bg-white tw-flex tw-items-center tw-justify-center tw-border-dashed tw-border-4 tw-border-main tw-text-main tw-z-50"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
              }
            }}
            onDragLeave={(e) => {
              // Only hide if we're leaving the drop zone itself (not entering a child element)
              if (e.currentTarget === e.target) {
                setIsInDropzone(false);
              }
            }}
            onDrop={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsInDropzone(false);

              // Only process if files are present
              if (e.dataTransfer.files.length > 0) {
                await handleFilesUpload({
                  files: e.dataTransfer.files,
                  personId: person._id,
                  user,
                  folders: folderOptions,
                  onSave: handleAddDocuments,
                });
              }
            }}
          >
            <div className="tw-mb-2 tw-mt-8 tw-w-full tw-text-center">
              <DocumentPlusIcon className="tw-mx-auto tw-h-16 tw-w-16" />
              <p className="tw-mt-4 tw-text-lg tw-font-medium">Déposez vos fichiers ici</p>
            </div>
          </div>
        )}
      </div>

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

      {documentToEdit && (
        <DocumentModal
          document={documentToEdit}
          key={documentToEdit._id}
          personId={person._id}
          onClose={() => setDocumentToEdit(null)}
          onDelete={async (document) => {
            // Prevent deletion of documents from other persons in the group
            if (document.linkedItem && document.linkedItem._id !== person._id) {
              toast.error("Vous pouvez supprimer ce document uniquement depuis la personne initiale de ce document familial");
              return false;
            }

            setIsDeletingDocument(true);

            // Delete the document from the API
            const [documentError] = await tryFetchExpectOk(async () => {
              return API.delete({ path: document.downloadPath ?? `/person/${person._id}/document/${document.file.filename}` });
            });
            if (documentError) {
              toast.error("Erreur lors de la suppression du document");
              setIsDeletingDocument(false);
              return false;
            }

            // Load fresh person data
            const freshPerson = await loadFreshPersonData(person._id);
            if (!freshPerson) {
              toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
              setIsDeletingDocument(false);
              return false;
            }

            // Update person documents
            const [personError] = await tryFetchExpectOk(async () => {
              return API.put({
                path: `/person/${person._id}`,
                body: await encryptPerson({
                  ...freshPerson,
                  documents: (freshPerson.documents || []).filter((d) => d._id !== document._id),
                }),
              });
            });
            if (personError) {
              toast.error("Erreur lors de la suppression du document");
              setIsDeletingDocument(false);
              return false;
            }

            await refresh();
            setIsDeletingDocument(false);
            setDocumentToEdit(null);
            toast.success("Document supprimé");
            return true;
          }}
          onSubmit={async (documentOrFolder) => {
            setIsUpdatingDocument(true);

            // Load fresh person data
            const freshPerson = await loadFreshPersonData(person._id);
            if (!freshPerson) {
              toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
              setIsUpdatingDocument(false);
              return;
            }

            const [personError] = await tryFetchExpectOk(async () => {
              return API.put({
                path: `/person/${person._id}`,
                body: await encryptPerson({
                  ...freshPerson,
                  documents: (freshPerson.documents || []).map((d) => {
                    if (d._id === documentOrFolder._id) return documentOrFolder;
                    return d;
                  }),
                }),
              });
            });
            if (personError) {
              toast.error("Erreur lors de la mise à jour du document");
              setIsUpdatingDocument(false);
              return;
            }

            await refresh();
            setIsUpdatingDocument(false);
            setDocumentToEdit(null);
            toast.success("Document mis à jour");
          }}
          canToggleGroupCheck={canToggleGroupCheck}
          showAssociatedItem={false}
          color="main"
          externalIsUpdating={isUpdatingDocument}
          externalIsDeleting={isDeletingDocument}
        />
      )}

      {folderToEdit && (
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
