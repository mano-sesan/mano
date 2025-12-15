import { useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAtomValue } from "jotai";
import { FolderPlusIcon, DocumentPlusIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import { organisationAuthentifiedState, userState } from "../../atoms/auth";
import { usePreparePersonForEncryption } from "../../atoms/persons";
import API, { tryFetchExpectOk } from "../../services/api";
import { capture } from "../../services/sentry";
import type { PersonPopulated } from "../../types/person";
import type { DocumentWithLinkedItem, FolderWithLinkedItem, Document, Folder, LinkedItem } from "../../types/document";
import { encryptAction } from "../../atoms/actions";
import { useDataLoader } from "../../services/dataLoader";
import isEqual from "react-fast-compare";
import { removeOldDefaultFolders } from "../../utils/documents";
import { handleFilesUpload } from "./DocumentsUpload";
import { DocumentModal, ButtonDownloadAll } from "./DocumentModals";
import { loadFreshPersonData } from "../../utils/loadFreshPersonData";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../tailwind/Modal";
import { groupsState } from "../../atoms/groups";
import { DocumentsTreeWrapper, DocumentsDropzone, useDocumentTreeData, useFolderOptions, type DocumentOrFolder } from "./DocumentTree";
import { CreateFolderModal, EditFolderModal } from "./FolderModals";

interface PersonDocumentsAltProps {
  person: PersonPopulated;
}

export default function PersonDocumentsAlt({ person }: PersonDocumentsAltProps) {
  const { refresh } = useDataLoader();
  const organisation = useAtomValue(organisationAuthentifiedState);
  const { encryptPerson } = usePreparePersonForEncryption();
  const user = useAtomValue(userState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resetFileInputKey, setResetFileInputKey] = useState(0);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<DocumentWithLinkedItem | null>(null);
  const [folderToEdit, setFolderToEdit] = useState<FolderWithLinkedItem | null>(null);
  const [isUpdatingDocument, setIsUpdatingDocument] = useState(false);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [isInDropzone, setIsInDropzone] = useState(false);
  const groups = useAtomValue(groupsState);

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

  // Use extracted utility hooks
  const { treeData, defaultExpandedItems, treeKey } = useDocumentTreeData(allDocuments as DocumentOrFolder[], person?._id);
  const folderOptions = useFolderOptions(allDocuments as DocumentOrFolder[]);

  const canToggleGroupCheck = useMemo(() => {
    if (!organisation.groupsEnabled) return false;
    const group = groups.find((group) => (group.persons || []).includes(person._id));
    if (!group) return false;
    return true;
  }, [groups, person._id, organisation.groupsEnabled]);

  const handleSaveOrder = async (itemId: string, newChildren: string[]) => {
    if (!person) return;

    // Update the tree data structure immediately for UI responsiveness
    treeData[itemId].children = newChildren;

    // Debounce the actual save - if multiple drops happen within 100ms, only save once
    // TODO: note de raph : probablement que cette histoire de timeout ne sert à rien
    // En fait si, sinon ça pète le tree, donc il faut postpone.
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
      // Save to API
      const personNextDocuments = updatedDocs.filter((d) => d.linkedItem.type === "person" && d._id !== "actions");

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

      if (isEqual(currentPersonDocuments, nextPersonDocsSimplified)) {
        return;
      }

      // Load fresh person data to avoid overwriting concurrent changes
      const freshPerson = await loadFreshPersonData(person._id);
      if (!freshPerson) {
        toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
        return;
      }

      const groupDocuments = (freshPerson.documents || []).filter((docOrFolder) => {
        const document = docOrFolder as unknown as Document;
        return !!document.group;
      });

      const finalDocuments = [...personNextDocuments, ...groupDocuments];

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
        return;
      }

      // Update action documents
      const actionNextDocuments = updatedDocs.filter((d) => d.linkedItem.type === "action");
      const actionIds = [...new Set(actionNextDocuments.map((d) => d.linkedItem._id))];

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

      // Wait for refresh to complete before showing success message
      await refresh();
      toast.success("Documents mis à jour");
    }, 0);
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
      toast.error("Erreur lors de la création du document, vous pouvez contacter le support");
      return;
    }

    // Wait for refresh to complete before showing success message
    await refresh();

    // Show success toast after data is refreshed and visible
    if (newDocuments.filter((d) => d.type === "document").length > 1) toast.success("Documents enregistrés !");
    if (newDocuments.filter((d) => d.type === "folder").length > 0) toast.success("Dossier créé !");
  };

  const handleCreateFolder = async (folder: Folder) => {
    await handleAddDocuments([folder]);
    setShowCreateFolderModal(false);
  };

  const handleUpdateFolder = async (folder: FolderWithLinkedItem, newName: string) => {
    // Load fresh person data
    const freshPerson = await loadFreshPersonData(person._id);
    if (!freshPerson) {
      toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
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
      return;
    }

    await refresh();
    setFolderToEdit(null);
    toast.success("Dossier mis à jour");
  };

  const handleDeleteFolder = async (folder: FolderWithLinkedItem) => {
    // Load fresh person data to prevent race conditions
    const freshPerson = await loadFreshPersonData(person._id);
    if (!freshPerson) {
      toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
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
      return;
    }

    await refresh();
    setFolderToEdit(null);
    toast.success("Dossier supprimé");
  };

  return (
    <div>
      {isInDropzone && !isFullScreen && (
        <DocumentsDropzone
          setIsInDropzone={setIsInDropzone}
          onAddDocuments={handleAddDocuments}
          personId={person._id}
          user={user}
          folderOptions={folderOptions}
        />
      )}
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
          <button
            type="button"
            aria-label="Passer en plein écran"
            className="tw-h-8 tw-w-8 tw-rounded-full tw-bg-main tw-text-white tw-transition hover:tw-scale-110 tw-flex tw-items-center tw-justify-center"
            onClick={() => setIsFullScreen(true)}
          >
            <ArrowsPointingOutIcon className="tw-w-5 tw-h-5" />
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

      <DocumentsTreeWrapper
        treeKey={treeKey}
        treeData={treeData}
        onSaveOrder={handleSaveOrder}
        expandedItems={defaultExpandedItems}
        onDocumentClick={setDocumentToEdit}
        onFolderEdit={setFolderToEdit}
        currentId={person._id}
        isInDropzone={isInDropzone}
        setIsInDropzone={setIsInDropzone}
      />

      <ModalContainer open={isFullScreen} onClose={() => setIsFullScreen(false)} size="full">
        <ModalHeader title="Documents" onClose={() => setIsFullScreen(false)} />
        <ModalBody>
          {isInDropzone && isFullScreen && (
            <DocumentsDropzone
              setIsInDropzone={setIsInDropzone}
              onAddDocuments={handleAddDocuments}
              personId={person._id}
              user={user}
              folderOptions={folderOptions}
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
            currentId={person._id}
            isInDropzone={isInDropzone}
            setIsInDropzone={setIsInDropzone}
            isFullScreen={true}
          />
        </ModalBody>
        <ModalFooter>
          <button type="button" className="button-cancel" onClick={() => setIsFullScreen(false)}>
            Fermer
          </button>
          <ButtonDownloadAll documents={allDocuments as DocumentWithLinkedItem[]} />
          <button type="button" className="button-submit" onClick={() => setShowCreateFolderModal(true)}>
            Créer un dossier
          </button>
          <button type="button" className="button-submit" onClick={() => fileInputRef.current?.click()}>
            Ajouter un document
          </button>
        </ModalFooter>
      </ModalContainer>

      {documentToEdit && (
        <DocumentModal
          document={documentToEdit}
          key={documentToEdit._id}
          personId={person._id}
          onClose={() => setDocumentToEdit(null)}
          onDelete={async (document) => {
            // Prevent deletion of documents from other persons in the group
            if (document.linkedItem && document.linkedItem.type === "person" && document.linkedItem._id !== person._id) {
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

            if (document.linkedItem.type === "action") {
              const action = person.actions?.find((a) => a._id === document.linkedItem._id);
              if (!action) {
                toast.error("Erreur lors de la suppression du document pour les actions liées, vous pouvez contactez le support");
                capture(new Error("Error while deleting document (action not found)"), { extra: { document } });
                setIsDeletingDocument(false);
                return false;
              }
              const [actionError] = await tryFetchExpectOk(async () => {
                return API.put({
                  path: `/action/${action._id}`,
                  body: await encryptAction({
                    ...action,
                    documents: action.documents.filter((d) => d._id !== document._id),
                  }),
                });
              });
              if (actionError) {
                toast.error("Erreur lors de la suppression du document pour les actions liées, vous pouvez contactez le support");
                setIsDeletingDocument(false);
                return false;
              }
            } else {
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
            }

            await refresh();
            setIsDeletingDocument(false);
            setDocumentToEdit(null);
            toast.success("Document supprimé");
            return true;
          }}
          onSubmit={async (documentOrFolder) => {
            setIsUpdatingDocument(true);

            if (documentOrFolder.linkedItem.type === "action") {
              const action = person.actions?.find((a) => a._id === documentOrFolder.linkedItem._id);
              if (!action) {
                toast.error("Erreur lors de la mise à jour du document pour les actions liées, vous pouvez contactez le support");
                capture(new Error("Error while updating document (action not found)"), { extra: { documentOrFolder } });
                setIsUpdatingDocument(false);
                return;
              }
              const [actionError] = await tryFetchExpectOk(async () => {
                return API.put({
                  path: `/action/${action._id}`,
                  body: await encryptAction({
                    ...action,
                    documents: action.documents.map((d) => {
                      if (d._id === documentOrFolder._id) return documentOrFolder;
                      return d;
                    }),
                  }),
                });
              });
              if (actionError) {
                toast.error("Erreur lors de la mise à jour du document pour les actions liées, vous pouvez contactez le support");
                setIsUpdatingDocument(false);
                return;
              }
            } else {
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
            }

            await refresh();
            setIsUpdatingDocument(false);
            setDocumentToEdit(null);
            toast.success("Document mis à jour");
          }}
          canToggleGroupCheck={canToggleGroupCheck}
          showAssociatedItem={true}
          color="main"
          externalIsUpdating={isUpdatingDocument}
          externalIsDeleting={isDeletingDocument}
        />
      )}

      <CreateFolderModal
        open={showCreateFolderModal}
        onClose={() => setShowCreateFolderModal(false)}
        onCreateFolder={handleCreateFolder}
        userId={user?._id ?? ""}
      />
      <EditFolderModal
        folder={folderToEdit}
        onClose={() => setFolderToEdit(null)}
        onUpdateFolder={handleUpdateFolder}
        onDeleteFolder={handleDeleteFolder}
      />
    </div>
  );
}
