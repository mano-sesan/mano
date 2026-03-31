import { useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAtomValue } from "jotai";
import { FolderPlusIcon, DocumentPlusIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import { userState } from "../../atoms/auth";
import { encryptTerritory } from "../../atoms/territory";
import { customFieldsObsSelector, encryptObs } from "../../atoms/territoryObservations";
import API, { tryFetchExpectOk } from "../../services/api";
import { capture } from "../../services/sentry";
import type { TerritoryInstance } from "../../types/territory";
import type { TerritoryObservationInstance } from "../../types/territoryObs";
import type { DocumentWithLinkedItem, FolderWithLinkedItem, Document, Folder, LinkedItem } from "../../types/document";
import isEqual from "react-fast-compare";
import { handleFilesUpload } from "./DocumentsUpload";
import { DocumentModal } from "./DocumentModal";
import { useDataLoader } from "../../services/dataLoader";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../tailwind/Modal";
import { DocumentsTreeWrapper, DocumentsDropzone, useDocumentTreeData, useFolderOptions, type DocumentOrFolder } from "./DocumentTree";
import { CreateFolderModal, EditFolderModal } from "./FolderModals";

interface TerritoryDocumentsProps {
  territory: TerritoryInstance;
  observations: TerritoryObservationInstance[];
}

export default function TerritoryDocuments({ territory, observations }: TerritoryDocumentsProps) {
  const { refresh } = useDataLoader();
  const customFieldsObs = useAtomValue(customFieldsObsSelector);
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

  // Build virtual "Observations" folder + all documents
  const allDocuments = useMemo(() => {
    if (!territory) return [];

    // Territory's own documents
    const territoryDocs: Array<DocumentOrFolder> = (territory.documents || []).map((doc) => ({
      ...doc,
      linkedItem: { _id: territory._id, type: "territory" } as LinkedItem,
    }));

    // Observation documents
    const obsDocs: Array<DocumentOrFolder> = [];
    let hasObsDocs = false;
    for (const obs of observations) {
      if (!obs.documents?.length) continue;
      hasObsDocs = true;
      for (const doc of obs.documents) {
        obsDocs.push({
          ...doc,
          linkedItem: { _id: obs._id!, type: "territory-observation" } as LinkedItem,
          parentId: !doc.parentId || doc.parentId === "root" ? "observations" : doc.parentId,
        } as DocumentOrFolder);
      }
    }

    const observationsFolder: FolderWithLinkedItem | undefined = hasObsDocs
      ? {
          _id: "observations",
          name: "Observations",
          position: -1,
          parentId: "root",
          type: "folder",
          linkedItem: { _id: territory._id, type: "territory" } as LinkedItem,
          movable: false,
          createdAt: new Date(),
          createdBy: "admin",
        }
      : undefined;

    return [observationsFolder, ...territoryDocs, ...obsDocs]
      .filter((e) => e)
      .sort((a, b) => {
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;
        return a.name.localeCompare(b.name);
      });
  }, [territory, observations]);

  const { treeData, defaultExpandedItems, treeKey } = useDocumentTreeData(allDocuments as DocumentOrFolder[], territory?._id, "territory");
  const folderOptions = useFolderOptions(allDocuments as DocumentOrFolder[]);

  const handleSaveOrder = async (itemId: string, newChildren: string[]) => {
    if (!territory) return;

    treeData[itemId].children = newChildren;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const updatedDocs: DocumentOrFolder[] = [];
      const processItem = (id: string, parentId: string | undefined, position: number) => {
        const item = treeData[id];
        if (!item || id === "root") return;

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

      // Separate territory docs from observation docs
      const territoryNextDocuments = updatedDocs.filter((d) => d.linkedItem.type === "territory" && d._id !== "observations");
      const currentTerritoryDocuments = (territory.documents || []).map((d) => ({ _id: d._id, parentId: d.parentId, position: d.position }));
      const nextTerritoryDocsSimplified = territoryNextDocuments.map((d) => ({
        _id: d._id,
        parentId: d.parentId,
        position: d.position,
      }));

      let hasChanges = !isEqual(currentTerritoryDocuments, nextTerritoryDocsSimplified);

      if (hasChanges) {
        const [territoryError] = await tryFetchExpectOk(async () => {
          return API.put({
            path: `/territory/${territory._id}`,
            body: await encryptTerritory({
              ...territory,
              documents: territoryNextDocuments,
            }),
          });
        });
        if (territoryError) {
          toast.error("Erreur lors de l'enregistrement des documents");
          return;
        }
      }

      // Update observation documents
      const obsNextDocuments = updatedDocs.filter((d) => d.linkedItem.type === "territory-observation");
      const obsIds = [...new Set(obsNextDocuments.map((d) => d.linkedItem._id))];

      for (const obsId of obsIds) {
        const obs = observations.find((o) => o._id === obsId);
        if (!obs) continue;

        const obsDocs = obsNextDocuments.filter((d) => d.linkedItem._id === obsId);
        if (isEqual(obs.documents, obsDocs)) continue;

        await tryFetchExpectOk(async () => {
          return API.put({
            path: `/territory-observation/${obsId}`,
            body: await encryptObs(customFieldsObs)({
              ...obs,
              documents: obsDocs,
            }),
          });
        });
      }

      await refresh();
      toast.success("Documents mis à jour");
    }, 0);
  };

  if (!territory) {
    return <div className="tw-p-4">Chargement...</div>;
  }

  const handleAddDocuments = async (newDocuments: Array<Document | Folder>) => {
    if (!newDocuments || newDocuments.length === 0) return;

    const oldDocuments = territory.documents?.length ? [...territory.documents] : [];

    const [territoryError] = await tryFetchExpectOk(async () => {
      return API.put({
        path: `/territory/${territory._id}`,
        body: await encryptTerritory({
          ...territory,
          documents: [...oldDocuments, ...newDocuments],
        }),
      });
    });
    if (territoryError) {
      toast.error("Erreur lors de la création du document, vous pouvez contacter le support");
      return;
    }

    await refresh();

    if (newDocuments.filter((d) => d.type === "document").length > 1) toast.success("Documents enregistrés !");
    if (newDocuments.filter((d) => d.type === "folder").length > 0) toast.success("Dossier créé !");
  };

  const handleCreateFolder = async (folder: Folder) => {
    await handleAddDocuments([folder]);
    setShowCreateFolderModal(false);
  };

  const handleUpdateFolder = async (folder: FolderWithLinkedItem, newName: string) => {
    const [territoryError] = await tryFetchExpectOk(async () => {
      return API.put({
        path: `/territory/${territory._id}`,
        body: await encryptTerritory({
          ...territory,
          documents: (territory.documents || []).map((d) => {
            if (d._id === folder._id) return { ...d, name: newName };
            return d;
          }),
        }),
      });
    });
    if (territoryError) {
      toast.error("Erreur lors de la mise à jour du dossier");
      return;
    }

    await refresh();
    setFolderToEdit(null);
    toast.success("Dossier mis à jour");
  };

  const handleDeleteFolder = async (folder: FolderWithLinkedItem) => {
    const [territoryError] = await tryFetchExpectOk(async () => {
      return API.put({
        path: `/territory/${territory._id}`,
        body: await encryptTerritory({
          ...territory,
          documents: (territory.documents || [])
            .filter((f) => f._id !== folder._id)
            .map((item) => {
              if (item.parentId === folder._id) return { ...item, parentId: undefined };
              return item;
            }),
        }),
      });
    });
    if (territoryError) {
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
          user={user}
          folderOptions={folderOptions}
          uploadBasePath={`/territory/${territory._id}/document`}
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
              user,
              folders: folderOptions,
              onSave: handleAddDocuments,
              uploadBasePath: `/territory/${territory._id}/document`,
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
        currentId={territory._id}
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
              user={user}
              folderOptions={folderOptions}
              uploadBasePath={`/territory/${territory._id}/document`}
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
            currentId={territory._id}
            isInDropzone={isInDropzone}
            setIsInDropzone={setIsInDropzone}
            isFullScreen={true}
          />
        </ModalBody>
        <ModalFooter>
          <button type="button" className="button-cancel" onClick={() => setIsFullScreen(false)}>
            Fermer
          </button>
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
          personId={territory._id}
          onClose={() => setDocumentToEdit(null)}
          onDelete={async (document) => {
            setIsDeletingDocument(true);

            const [documentError] = await tryFetchExpectOk(async () => {
              return API.delete({ path: document.downloadPath ?? `/territory/${territory._id}/document/${document.file.filename}` });
            });
            if (documentError) {
              toast.error("Erreur lors de la suppression du document");
              setIsDeletingDocument(false);
              return false;
            }

            if (document.linkedItem.type === "territory-observation") {
              const obs = observations.find((o) => o._id === document.linkedItem._id);
              if (!obs) {
                toast.error("Erreur lors de la suppression du document pour l'observation liée");
                capture(new Error("Error while deleting document (observation not found)"), { extra: { document } });
                setIsDeletingDocument(false);
                return false;
              }
              const [obsError] = await tryFetchExpectOk(async () => {
                return API.put({
                  path: `/territory-observation/${obs._id}`,
                  body: await encryptObs(customFieldsObs)({
                    ...obs,
                    documents: (obs.documents || []).filter((d) => d._id !== document._id),
                  }),
                });
              });
              if (obsError) {
                toast.error("Erreur lors de la suppression du document pour l'observation liée");
                setIsDeletingDocument(false);
                return false;
              }
            } else {
              const [territoryError] = await tryFetchExpectOk(async () => {
                return API.put({
                  path: `/territory/${territory._id}`,
                  body: await encryptTerritory({
                    ...territory,
                    documents: (territory.documents || []).filter((d) => d._id !== document._id),
                  }),
                });
              });
              if (territoryError) {
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

            if (documentOrFolder.linkedItem.type === "territory-observation") {
              const obs = observations.find((o) => o._id === documentOrFolder.linkedItem._id);
              if (!obs) {
                toast.error("Erreur lors de la mise à jour du document pour l'observation liée");
                capture(new Error("Error while updating document (observation not found)"), { extra: { documentOrFolder } });
                setIsUpdatingDocument(false);
                return;
              }
              const [obsError] = await tryFetchExpectOk(async () => {
                return API.put({
                  path: `/territory-observation/${obs._id}`,
                  body: await encryptObs(customFieldsObs)({
                    ...obs,
                    documents: (obs.documents || []).map((d) => {
                      if (d._id === documentOrFolder._id) return documentOrFolder;
                      return d;
                    }),
                  }),
                });
              });
              if (obsError) {
                toast.error("Erreur lors de la mise à jour du document pour l'observation liée");
                setIsUpdatingDocument(false);
                return;
              }
            } else {
              const [territoryError] = await tryFetchExpectOk(async () => {
                return API.put({
                  path: `/territory/${territory._id}`,
                  body: await encryptTerritory({
                    ...territory,
                    documents: (territory.documents || []).map((d) => {
                      if (d._id === documentOrFolder._id) return documentOrFolder;
                      return d;
                    }),
                  }),
                });
              });
              if (territoryError) {
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
          canToggleGroupCheck={false}
          showAssociatedItem={false}
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
