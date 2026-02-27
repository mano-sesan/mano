import { useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAtomValue } from "jotai";
import { FolderPlusIcon, DocumentPlusIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import { userAuthentifiedState } from "../../atoms/auth";
import { encryptObs } from "../../atoms/territoryObservations";
import API, { tryFetchExpectOk } from "../../services/api";
import { capture } from "../../services/sentry";
import type { TerritoryObservationInstance } from "../../types/territoryObs";
import type { DocumentWithLinkedItem, FolderWithLinkedItem, Document, Folder } from "../../types/document";
import type { CustomField } from "../../types/field";
import { useDataLoader } from "../../services/dataLoader";
import { handleFilesUpload } from "./DocumentsUpload";
import { DocumentModal } from "./DocumentModal";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../tailwind/Modal";
import { DocumentsTreeWrapper, DocumentsDropzone, useDocumentTreeData, useFolderOptions, type DocumentOrFolder } from "./DocumentTree";
import { CreateFolderModal, EditFolderModal } from "./FolderModals";

interface ObservationDocumentsProps {
  observation: TerritoryObservationInstance;
  customFieldsObs: CustomField[];
  onObservationUpdated: () => void;
}

export default function ObservationDocuments({ observation, customFieldsObs, onObservationUpdated }: ObservationDocumentsProps) {
  const { refresh } = useDataLoader();
  const user = useAtomValue(userAuthentifiedState);

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

  const uploadBasePath = `/territory-observation/${observation._id}/document`;

  const allDocuments = useMemo(() => {
    const docs: Array<DocumentWithLinkedItem | FolderWithLinkedItem> = [];
    for (const document of observation.documents || []) {
      const docWithLinkedItem = {
        ...document,
        type: document.type ?? "document",
        linkedItem: {
          _id: observation._id!,
          type: "territory-observation" as const,
        },
        parentId: document.parentId ?? "root",
      } as DocumentWithLinkedItem;
      docs.push(docWithLinkedItem);
    }
    return docs.sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [observation]);

  const { treeData, defaultExpandedItems, treeKey } = useDocumentTreeData(
    allDocuments as DocumentOrFolder[],
    observation._id ?? "",
    "territory-observation"
  );
  const folderOptions = useFolderOptions(allDocuments as DocumentOrFolder[]);

  const saveObservationDocuments = async (documents: Array<Document | Folder>) => {
    const [error] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/territory-observation/${observation._id}`,
        body: await encryptObs(customFieldsObs)({ ...observation, documents }, { checkRequiredFields: false }),
      })
    );
    return error;
  };

  const handleSaveOrder = async (itemId: string, newChildren: string[]) => {
    treeData[itemId].children = newChildren;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
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

        // Strip linkedItem from documents before saving
        const cleanDocs = updatedDocs.map((d) => {
          const { linkedItem, ...rest } = d as DocumentWithLinkedItem;
          return rest as Document | Folder;
        });

        const error = await saveObservationDocuments(cleanDocs);
        if (!error) {
          toast.success("Documents mis à jour");
          await refresh();
          onObservationUpdated();
        } else {
          toast.error("Erreur lors de la mise à jour des documents");
        }
      } catch (e) {
        toast.error("Erreur lors de la mise à jour des documents");
        capture(e, { extra: { message: "Error while updating observation documents order" } });
      }
    }, 0);
  };

  const handleAddDocuments = async (newDocuments: Array<Document | Folder>) => {
    if (!newDocuments || newDocuments.length === 0) return;

    const error = await saveObservationDocuments([...(observation.documents || []), ...newDocuments]);

    if (!error) {
      if (newDocuments.filter((d) => d.type === "document").length > 1) toast.success("Documents enregistrés !");
      if (newDocuments.filter((d) => d.type === "folder").length > 0) toast.success("Dossier créé !");
      await refresh();
      onObservationUpdated();
    } else {
      toast.error("Erreur lors de la création du document");
    }
  };

  const handleCreateFolder = async (folder: Folder) => {
    await handleAddDocuments([folder]);
    setShowCreateFolderModal(false);
  };

  const handleUpdateFolder = async (folder: FolderWithLinkedItem, newName: string) => {
    const error = await saveObservationDocuments(
      (observation.documents || []).map((d) => {
        if (d._id === folder._id) return { ...d, name: newName };
        return d;
      })
    );
    if (!error) {
      await refresh();
      onObservationUpdated();
      setFolderToEdit(null);
      toast.success("Dossier mis à jour");
    } else {
      toast.error("Erreur lors de la mise à jour du dossier");
    }
  };

  const handleDeleteFolder = async (folder: FolderWithLinkedItem) => {
    const error = await saveObservationDocuments(
      (observation.documents || [])
        .filter((f) => f._id !== folder._id)
        .map((item) => {
          if (item.parentId === folder._id) return { ...item, parentId: undefined };
          return item;
        })
    );
    if (!error) {
      await refresh();
      onObservationUpdated();
      setFolderToEdit(null);
      toast.success("Dossier supprimé");
    } else {
      toast.error("Erreur lors de la suppression du dossier");
    }
  };

  const handleDeleteDocument = async (document: DocumentWithLinkedItem): Promise<boolean> => {
    setIsDeletingDocument(true);

    if (document.type === "document") {
      const [error] = await tryFetchExpectOk(async () =>
        API.delete({ path: document.downloadPath ?? `${uploadBasePath}/${document.file.filename}` })
      );
      if (error) {
        toast.error("Erreur lors de la suppression du document");
        setIsDeletingDocument(false);
        return false;
      }
    }

    const err = await saveObservationDocuments((observation.documents || []).filter((d) => d._id !== document._id));
    if (err) {
      toast.error("Erreur lors de la suppression du document");
      setIsDeletingDocument(false);
      return false;
    }

    await refresh();
    onObservationUpdated();
    setIsDeletingDocument(false);
    setDocumentToEdit(null);
    toast.success("Document supprimé");
    return true;
  };

  const handleSubmitDocument = async (documentOrFolder: DocumentWithLinkedItem) => {
    setIsUpdatingDocument(true);

    const error = await saveObservationDocuments(
      (observation.documents || []).map((d) => {
        if (d._id === documentOrFolder._id) {
          const { linkedItem, ...rest } = documentOrFolder;
          return rest as Document | Folder;
        }
        return d;
      })
    );

    if (!error) {
      await refresh();
      onObservationUpdated();
      setIsUpdatingDocument(false);
      setDocumentToEdit(null);
      toast.success("Document mis à jour");
    } else {
      toast.error("Erreur lors de la mise à jour du document");
      setIsUpdatingDocument(false);
    }
  };

  return (
    <div className="tw-relative">
      {isInDropzone && !isFullScreen && (
        <DocumentsDropzone
          setIsInDropzone={setIsInDropzone}
          onAddDocuments={handleAddDocuments}
          user={user}
          folderOptions={folderOptions}
          uploadBasePath={uploadBasePath}
        />
      )}
      <div className="tw-flex tw-justify-between tw-items-center tw-border-b tw-border-main tw-border-opacity-25 tw-py-2 tw-px-4">
        <h3 className="tw-text-xl tw-mb-0 tw-text-main">Documents</h3>
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
              uploadBasePath,
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
        currentId={observation._id ?? ""}
        isInDropzone={isInDropzone}
        setIsInDropzone={setIsInDropzone}
      />

      <ModalContainer open={isFullScreen} onClose={() => setIsFullScreen(false)} size="full">
        <ModalHeader title="Documents de l'observation" onClose={() => setIsFullScreen(false)} />
        <ModalBody>
          {isInDropzone && isFullScreen && (
            <DocumentsDropzone
              setIsInDropzone={setIsInDropzone}
              onAddDocuments={handleAddDocuments}
              user={user}
              folderOptions={folderOptions}
              uploadBasePath={uploadBasePath}
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
            currentId={observation._id ?? ""}
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
          onClose={() => setDocumentToEdit(null)}
          onDelete={handleDeleteDocument}
          onSubmit={handleSubmitDocument}
          canToggleGroupCheck={false}
          showAssociatedItem={false}
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
