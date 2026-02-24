import { useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAtomValue } from "jotai";
import { FolderPlusIcon, DocumentPlusIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import { organisationAuthentifiedState, userAuthentifiedState } from "../../atoms/auth";
import { prepareConsultationForEncryption, encryptConsultation } from "../../atoms/consultations";
import { customFieldsMedicalFileSelector, prepareMedicalFileForEncryption, encryptMedicalFile } from "../../atoms/medicalFiles";
import { encryptTreatment } from "../../atoms/treatments";
import API, { tryFetchExpectOk } from "../../services/api";
import { capture } from "../../services/sentry";
import type { PersonPopulated } from "../../types/person";
import type { DocumentWithLinkedItem, FolderWithLinkedItem, Document, Folder } from "../../types/document";
import { useDataLoader } from "../../services/dataLoader";
import { encryptItem } from "../../services/encryption";
import { removeOldDefaultFolders } from "../../utils/documents";
import { handleFilesUpload } from "./DocumentsUpload";
import { DocumentModal } from "./DocumentModal";
import { ButtonDownloadAll } from "./ButtonDownloadAll";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../tailwind/Modal";
import { DocumentsTreeWrapper, DocumentsDropzone, useDocumentTreeData, useFolderOptions, type DocumentOrFolder } from "./DocumentTree";
import { CreateFolderModal, EditFolderModal } from "./FolderModals";

interface MedicalFileDocumentsProps {
  person: PersonPopulated;
}

export default function MedicalFileDocuments({ person }: MedicalFileDocumentsProps) {
  const { refresh } = useDataLoader();
  const organisation = useAtomValue(organisationAuthentifiedState);
  const user = useAtomValue(userAuthentifiedState);
  const customFieldsMedicalFile = useAtomValue(customFieldsMedicalFileSelector);

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

  const consultations = useMemo(() => person.consultations ?? [], [person.consultations]);
  const treatments = useMemo(() => person.treatments ?? [], [person.treatments]);
  const medicalFile = person.medicalFile;

  const defaultFolders: Array<FolderWithLinkedItem> = useMemo(
    () =>
      (organisation.defaultMedicalFolders || []).map((folder) => ({
        ...folder,
        movable: false,
        linkedItem: {
          _id: medicalFile?._id,
          type: "medical-file" as const,
        },
      })),
    [organisation.defaultMedicalFolders, medicalFile?._id]
  );

  // Build all medical documents aggregated from medicalFile, consultations, and treatments
  const allMedicalDocuments = useMemo(() => {
    if (!medicalFile) return [];

    // Virtual folder for treatments
    const treatmentsDocs: Array<DocumentWithLinkedItem | FolderWithLinkedItem> = [
      {
        _id: "treatment",
        name: "Traitements",
        position: 1,
        parentId: "root",
        type: "folder",
        linkedItem: {
          _id: medicalFile._id,
          type: "medical-file",
        },
        movable: false,
        createdAt: new Date(),
        createdBy: "system",
      },
    ];
    for (const treatment of treatments) {
      for (const document of treatment.documents || []) {
        const docWithLinkedItem = {
          ...document,
          type: document.type ?? "document",
          linkedItem: {
            _id: treatment._id,
            type: "treatment",
          },
          parentId: document.parentId ?? "treatment",
        } as DocumentWithLinkedItem;
        treatmentsDocs.push(docWithLinkedItem);
      }
    }

    // Virtual folder for consultations
    const consultationsDocs: Array<DocumentWithLinkedItem | FolderWithLinkedItem> = [
      {
        _id: "consultation",
        name: "Consultations",
        position: 0,
        parentId: "root",
        type: "folder",
        linkedItem: {
          _id: medicalFile._id,
          type: "medical-file",
        },
        movable: false,
        createdAt: new Date(),
        createdBy: "system",
      },
    ];
    for (const consultation of consultations) {
      if (consultation?.onlyVisibleBy?.length) {
        if (!consultation.onlyVisibleBy.includes(user._id)) continue;
      }
      for (const document of consultation.documents || []) {
        const docWithLinkedItem = {
          ...document,
          type: document.type ?? "document",
          linkedItem: {
            _id: consultation._id,
            type: "consultation",
          },
          parentId: document.parentId ?? "consultation",
        } as DocumentWithLinkedItem;
        consultationsDocs.push(docWithLinkedItem);
      }
    }

    // Medical file's own documents
    const otherDocs: Array<DocumentWithLinkedItem | FolderWithLinkedItem> = [];
    for (const document of medicalFile?.documents || []) {
      const docWithLinkedItem = {
        ...document,
        type: document.type ?? "document",
        linkedItem: {
          _id: medicalFile._id,
          type: "medical-file",
        },
        parentId: document.parentId ?? "root",
      } as DocumentWithLinkedItem;
      otherDocs.push(docWithLinkedItem);
    }

    return [...treatmentsDocs, ...consultationsDocs, ...removeOldDefaultFolders([...(otherDocs || [])], defaultFolders)].sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [consultations, defaultFolders, medicalFile, treatments, user._id]);

  // Use extracted utility hooks
  const { treeData, defaultExpandedItems, treeKey } = useDocumentTreeData(
    allMedicalDocuments as DocumentOrFolder[],
    medicalFile?._id ?? "",
    "medical-file"
  );
  const folderOptions = useFolderOptions(allMedicalDocuments as DocumentOrFolder[]);

  const handleSaveOrder = async (itemId: string, newChildren: string[]) => {
    if (!medicalFile) return;

    // Update the tree data structure immediately for UI responsiveness
    treeData[itemId].children = newChildren;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Convert back to flat array with parentId
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

        // Group documents by their linked item type
        const groupedById: {
          treatment: Record<string, DocumentOrFolder[]>;
          consultation: Record<string, DocumentOrFolder[]>;
          "medical-file": Record<string, DocumentOrFolder[]>;
        } = {
          treatment: {},
          consultation: {},
          "medical-file": {},
        };

        for (const document of updatedDocs) {
          // Skip virtual folders
          if (document.movable === false && (document._id === "consultation" || document._id === "treatment")) {
            continue;
          }
          const linkedType = document.linkedItem.type as keyof typeof groupedById;
          if (!groupedById[linkedType][document.linkedItem._id]) {
            groupedById[linkedType][document.linkedItem._id] = [];
          }
          groupedById[linkedType][document.linkedItem._id].push(document);
        }

        // Encrypt treatments to update
        const treatmentsToUpdate = await Promise.all(
          Object.keys(groupedById.treatment).map((treatmentId) => {
            const treatment = treatments.find((t) => t._id === treatmentId);
            if (!treatment) throw new Error("Treatment not found");
            return encryptTreatment({
              ...treatment,
              documents: groupedById.treatment[treatmentId],
            });
          })
        );

        // Encrypt consultations to update
        const consultationsToUpdate = await Promise.all(
          Object.keys(groupedById.consultation).map(async (consultationId) => {
            const consultation = consultations.find((c) => c._id === consultationId);
            if (!consultation) throw new Error("Consultation not found");
            const nextConsultation = prepareConsultationForEncryption(organisation.consultations)({
              ...consultation,
              documents: groupedById.consultation[consultationId],
            });
            return encryptItem(nextConsultation);
          })
        );

        // Encrypt medical file
        const encryptedMedicalFile = await encryptItem(
          prepareMedicalFileForEncryption(customFieldsMedicalFile)({
            ...medicalFile,
            documents: groupedById["medical-file"][medicalFile._id] || [],
          })
        );

        const [error] = await tryFetchExpectOk(async () =>
          API.put({
            path: "/medical-file/documents-reorder",
            body: {
              treatments: treatmentsToUpdate,
              consultations: consultationsToUpdate,
              medicalFile: encryptedMedicalFile,
            },
          })
        );

        if (!error) {
          toast.success("Documents mis à jour");
          await refresh();
        } else {
          toast.error("Erreur lors de la mise à jour des documents");
        }
      } catch (e) {
        toast.error("Erreur lors de la mise à jour des documents");
        capture(e, { extra: { message: "Error while updating medical documents order" } });
      }
    }, 0);
  };

  // Safety check after all hooks
  if (!medicalFile) {
    return <div className="tw-p-4">Chargement...</div>;
  }

  const handleAddDocuments = async (newDocuments: Array<Document | Folder>) => {
    if (!newDocuments || newDocuments.length === 0) return;

    const [error] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/medical-file/${medicalFile._id}`,
        body: await encryptMedicalFile(customFieldsMedicalFile)({
          ...medicalFile,
          documents: [...(medicalFile.documents?.length ? medicalFile.documents : [...defaultFolders]), ...newDocuments],
        }),
      })
    );

    if (!error) {
      if (newDocuments.filter((d) => d.type === "document").length > 1) toast.success("Documents enregistrés !");
      if (newDocuments.filter((d) => d.type === "folder").length > 0) toast.success("Dossier créé !");
      await refresh();
    } else {
      toast.error("Erreur lors de la création du document");
    }
  };

  const handleCreateFolder = async (folder: Folder) => {
    await handleAddDocuments([folder]);
    setShowCreateFolderModal(false);
  };

  const handleUpdateFolder = async (folder: FolderWithLinkedItem, newName: string) => {
    const [error] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/medical-file/${medicalFile._id}`,
        body: await encryptMedicalFile(customFieldsMedicalFile)({
          ...medicalFile,
          documents: (medicalFile.documents || []).map((d) => {
            if (d._id === folder._id) return { ...d, name: newName };
            return d;
          }),
        }),
      })
    );
    if (!error) {
      await refresh();
      setFolderToEdit(null);
      toast.success("Dossier mis à jour");
    } else {
      toast.error("Erreur lors de la mise à jour du dossier");
    }
  };

  const handleDeleteFolder = async (folder: FolderWithLinkedItem) => {
    const [error] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/medical-file/${medicalFile._id}`,
        body: await encryptMedicalFile(customFieldsMedicalFile)({
          ...medicalFile,
          documents: (medicalFile.documents || [])
            .filter((f) => f._id !== folder._id)
            .map((item) => {
              if (item.parentId === folder._id) return { ...item, parentId: undefined };
              return item;
            }),
        }),
      })
    );
    if (!error) {
      await refresh();
      setFolderToEdit(null);
      toast.success("Dossier supprimé");
    } else {
      toast.error("Erreur lors de la suppression du dossier");
    }
  };

  const handleDeleteDocument = async (document: DocumentWithLinkedItem): Promise<boolean> => {
    setIsDeletingDocument(true);

    // Delete the file from storage
    if (document.type === "document") {
      const [error] = await tryFetchExpectOk(async () =>
        API.delete({ path: document.downloadPath ?? `/person/${person._id}/document/${document.file.filename}` })
      );
      if (error) {
        toast.error("Erreur lors de la suppression du document");
        setIsDeletingDocument(false);
        return false;
      }
    }

    // Update the appropriate entity based on linked item type
    if (document.linkedItem.type === "treatment") {
      const treatment = treatments.find((t) => t._id === document.linkedItem._id);
      if (!treatment) {
        setIsDeletingDocument(false);
        return false;
      }
      const [error] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/treatment/${treatment._id}`,
          body: await encryptTreatment({
            ...treatment,
            documents: treatment.documents.filter((d) => d._id !== document._id),
          }),
        })
      );
      if (error) {
        toast.error("Erreur lors de la suppression du document");
        setIsDeletingDocument(false);
        return false;
      }
    } else if (document.linkedItem.type === "consultation") {
      const consultation = consultations.find((c) => c._id === document.linkedItem._id);
      if (!consultation) {
        setIsDeletingDocument(false);
        return false;
      }
      const [error] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/consultation/${consultation._id}`,
          body: await encryptConsultation(organisation.consultations)({
            ...consultation,
            documents: consultation.documents.filter((d) => d._id !== document._id),
          }),
        })
      );
      if (error) {
        toast.error("Erreur lors de la suppression du document");
        setIsDeletingDocument(false);
        return false;
      }
    } else if (document.linkedItem.type === "medical-file") {
      const [error] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/medical-file/${medicalFile._id}`,
          body: await encryptMedicalFile(customFieldsMedicalFile)({
            ...medicalFile,
            documents: (medicalFile.documents?.length ? medicalFile.documents : [...defaultFolders]).filter((d) => d._id !== document._id),
          }),
        })
      );
      if (error) {
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
  };

  const handleSubmitDocument = async (documentOrFolder: DocumentWithLinkedItem) => {
    setIsUpdatingDocument(true);

    if (documentOrFolder.linkedItem.type === "treatment") {
      const treatment = treatments.find((t) => t._id === documentOrFolder.linkedItem._id);
      if (!treatment) {
        toast.error("Erreur lors de la mise à jour du document");
        setIsUpdatingDocument(false);
        return;
      }
      const [error] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/treatment/${treatment._id}`,
          body: await encryptTreatment({
            ...treatment,
            documents: treatment.documents.map((d) => {
              if (d._id === documentOrFolder._id) {
                const { linkedItem, ...rest } = documentOrFolder;
                return rest as Document | Folder;
              }
              return d;
            }),
          }),
        })
      );
      if (error) {
        toast.error("Erreur lors de la mise à jour du document");
        setIsUpdatingDocument(false);
        return;
      }
    } else if (documentOrFolder.linkedItem.type === "consultation") {
      const consultation = consultations.find((c) => c._id === documentOrFolder.linkedItem._id);
      if (!consultation) {
        toast.error("Erreur lors de la mise à jour du document");
        setIsUpdatingDocument(false);
        return;
      }
      const [error] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/consultation/${consultation._id}`,
          body: await encryptConsultation(organisation.consultations)({
            ...consultation,
            documents: consultation.documents.map((d) => {
              if (d._id === documentOrFolder._id) {
                const { linkedItem, ...rest } = documentOrFolder;
                return rest as Document | Folder;
              }
              return d;
            }),
          }),
        })
      );
      if (error) {
        toast.error("Erreur lors de la mise à jour du document");
        setIsUpdatingDocument(false);
        return;
      }
    } else if (documentOrFolder.linkedItem.type === "medical-file") {
      const [error] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/medical-file/${medicalFile._id}`,
          body: await encryptMedicalFile(customFieldsMedicalFile)({
            ...medicalFile,
            documents: (medicalFile.documents?.length ? medicalFile.documents : [...defaultFolders]).map((d) => {
              if (d._id === documentOrFolder._id) {
                const { linkedItem, ...rest } = documentOrFolder;
                return rest as Document | Folder;
              }
              return d;
            }),
          }),
        })
      );
      if (error) {
        toast.error("Erreur lors de la mise à jour du document");
        setIsUpdatingDocument(false);
        return;
      }
    }

    await refresh();
    setIsUpdatingDocument(false);
    setDocumentToEdit(null);
    toast.success("Document mis à jour");
  };

  return (
    <div className="tw-relative">
      {isInDropzone && !isFullScreen && (
        <DocumentsDropzone
          setIsInDropzone={setIsInDropzone}
          onAddDocuments={handleAddDocuments}
          personId={person._id}
          user={user}
          folderOptions={folderOptions}
        />
      )}
      <div className="tw-flex tw-justify-between tw-items-center tw-border-b tw-border-blue-900 tw-border-opacity-25 tw-py-2 tw-px-4">
        <h3 className="tw-text-xl tw-mb-0 tw-text-blue-900">Documents médicaux</h3>
        <div className="tw-flex tw-gap-2">
          <button
            type="button"
            aria-label="Créer un dossier"
            className="tw-h-8 tw-w-8 tw-rounded-full tw-bg-blue-900 tw-text-white tw-transition hover:tw-scale-110 tw-flex tw-items-center tw-justify-center"
            onClick={() => setShowCreateFolderModal(true)}
          >
            <FolderPlusIcon className="tw-w-5 tw-h-5" />
          </button>
          <button
            type="button"
            aria-label="Ajouter un document"
            className="tw-h-8 tw-w-8 tw-rounded-full tw-bg-blue-900 tw-text-white tw-transition hover:tw-scale-110 tw-flex tw-items-center tw-justify-center"
            onClick={() => fileInputRef.current?.click()}
          >
            <DocumentPlusIcon className="tw-w-5 tw-h-5" />
          </button>
          <button
            type="button"
            aria-label="Passer en plein écran"
            className="tw-h-8 tw-w-8 tw-rounded-full tw-bg-blue-900 tw-text-white tw-transition hover:tw-scale-110 tw-flex tw-items-center tw-justify-center"
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
        currentId={medicalFile._id}
        isInDropzone={isInDropzone}
        setIsInDropzone={setIsInDropzone}
      />

      <ModalContainer open={isFullScreen} onClose={() => setIsFullScreen(false)} size="full">
        <ModalHeader title="Documents médicaux" onClose={() => setIsFullScreen(false)} />
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
            currentId={medicalFile._id}
            isInDropzone={isInDropzone}
            setIsInDropzone={setIsInDropzone}
            isFullScreen={true}
          />
        </ModalBody>
        <ModalFooter>
          <button type="button" className="button-cancel" onClick={() => setIsFullScreen(false)}>
            Fermer
          </button>
          <ButtonDownloadAll documents={allMedicalDocuments as DocumentWithLinkedItem[]} />
          <button type="button" className="button-submit !tw-bg-blue-900" onClick={() => setShowCreateFolderModal(true)}>
            Créer un dossier
          </button>
          <button type="button" className="button-submit !tw-bg-blue-900" onClick={() => fileInputRef.current?.click()}>
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
          onDelete={handleDeleteDocument}
          onSubmit={handleSubmitDocument}
          canToggleGroupCheck={false}
          showAssociatedItem={true}
          color="blue-900"
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
