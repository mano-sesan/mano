import { useMemo } from "react";
import { toast } from "react-toastify";
import { useRecoilValue } from "recoil";
import { organisationAuthentifiedState, userAuthentifiedState } from "../../../recoil/auth";
import { prepareConsultationForEncryption, encryptConsultation } from "../../../recoil/consultations";
import { customFieldsMedicalFileSelector, prepareMedicalFileForEncryption, encryptMedicalFile } from "../../../recoil/medicalFiles";
import { encryptTreatment } from "../../../recoil/treatments";
import API, { tryFetchExpectOk } from "../../../services/api";
import { capture } from "../../../services/sentry";
import type { PersonPopulated } from "../../../types/person";
import type { DocumentWithLinkedItem, FolderWithLinkedItem, Document, Folder } from "../../../types/document";
import { useDataLoader } from "../../../services/dataLoader";
import { encryptItem } from "../../../services/encryption";
import { removeOldDefaultFolders } from "../../../utils/documents";
import DocumentsAlt from "../../../components/DocumentsAlt";

interface PersonDocumentsMedicalAltProps {
  person: PersonPopulated;
}

const PersonDocumentsMedicalAlt = ({ person }: PersonDocumentsMedicalAltProps) => {
  const user = useRecoilValue(userAuthentifiedState);
  const organisation = useRecoilValue(organisationAuthentifiedState);
  const { refresh } = useDataLoader();

  const consultations = useMemo(() => person.consultations ?? [], [person.consultations]);
  const treatments = useMemo(() => person.treatments ?? [], [person.treatments]);
  const customFieldsMedicalFile = useRecoilValue(customFieldsMedicalFileSelector);
  const medicalFile = person.medicalFile;

  // Build default folders
  const defaultFolders: Array<FolderWithLinkedItem> = useMemo(
    () =>
      organisation.defaultMedicalFolders.map((folder) => ({
        ...folder,
        movable: false,
        linkedItem: {
          _id: person.medicalFile?._id,
          type: "medical-file",
        },
      })),
    [organisation.defaultMedicalFolders, person.medicalFile?._id]
  );

  // Build read-only folders for treatments and consultations
  const readOnlyFolders = useMemo(() => {
    const folders: Array<FolderWithLinkedItem> = [];

    // Treatments folder
    folders.push({
      _id: "treatment",
      name: "Traitements",
      position: 1,
      parentId: "root",
      type: "folder",
      linkedItem: {
        _id: medicalFile?._id,
        type: "medical-file",
      },
      movable: false,
      createdAt: new Date(),
      createdBy: "system",
    });

    // Consultations folder
    folders.push({
      _id: "consultation",
      name: "Consultations",
      position: 0,
      parentId: "root",
      type: "folder",
      linkedItem: {
        _id: medicalFile?._id,
        type: "medical-file",
      },
      movable: false,
      createdAt: new Date(),
      createdBy: "system",
    });

    return folders;
  }, [medicalFile?._id]);

  // Build all medical documents
  const allMedicalDocuments = useMemo(() => {
    if (!medicalFile) return [];

    const treatmentsDocs: Array<DocumentWithLinkedItem | FolderWithLinkedItem> = [];
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

    const consultationsDocs: Array<DocumentWithLinkedItem | FolderWithLinkedItem> = [];
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

    return [...treatmentsDocs, ...consultationsDocs, ...removeOldDefaultFolders([...(otherDocs || [])], defaultFolders)];
  }, [consultations, defaultFolders, medicalFile, treatments, user._id]);

  // Complex save handler that distributes documents to their respective entities
  const handleSaveDocuments = async (newDocuments: Array<Document | Folder>) => {
    try {
      // Group documents by their linked item type and ID
      const groupedById: Record<string, Record<string, Array<Document | Folder>>> = {
        treatment: {},
        consultation: {},
        "medical-file": {},
      };

      for (const document of newDocuments) {
        // Skip read-only folders
        if (document._id === "consultation" || document._id === "treatment") continue;

        // Find the original document to get its linkedItem
        const originalDoc = allMedicalDocuments.find((d) => d._id === document._id);
        if (!originalDoc) {
          // New document, assign to medical-file by default
          if (!groupedById["medical-file"][medicalFile._id]) groupedById["medical-file"][medicalFile._id] = [];
          groupedById["medical-file"][medicalFile._id].push(document);
        } else {
          const linkedType = originalDoc.linkedItem.type;
          const linkedId = originalDoc.linkedItem._id;
          if (!groupedById[linkedType][linkedId]) groupedById[linkedType][linkedId] = [];
          groupedById[linkedType][linkedId].push(document);
        }
      }

      // Update treatments
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

      // Update consultations
      const consultationsToUpdate = await Promise.all(
        Object.keys(groupedById.consultation)
          .map((consultationId) => {
            const consultation = consultations.find((c) => c._id === consultationId);
            if (!consultation) throw new Error("Consultation not found");
            const nextConsultation = prepareConsultationForEncryption(organisation.consultations)({
              ...consultation,
              documents: groupedById.consultation[consultationId],
            });
            return nextConsultation;
          })
          .map(encryptItem)
      );

      // Update medical file
      if (!medicalFile?._id) throw new Error("Medical file not found");
      const encryptedMedicalFile = await encryptItem(
        prepareMedicalFileForEncryption(customFieldsMedicalFile)({
          ...medicalFile,
          documents: groupedById["medical-file"][medicalFile._id] || [],
        })
      );

      const [error] = await tryFetchExpectOk(
        async () =>
          await API.put({
            path: "/medical-file/documents-reorder",
            body: {
              treatments: treatmentsToUpdate,
              consultations: consultationsToUpdate,
              medicalFile: encryptedMedicalFile,
            },
          })
      );

      if (error) {
        toast.error("Erreur lors de la mise à jour des documents, vous pouvez contactez le support");
        throw error;
      }
    } catch (e) {
      toast.error("Erreur lors de la mise à jour des documents, vous pouvez contactez le support");
      capture(e, { extra: { message: "Error while updating documents order" } });
      throw e;
    }
  };

  const handleDeleteDocument = async (documentOrFolder: DocumentWithLinkedItem): Promise<boolean> => {
    // Delete from API
    const [error] = await tryFetchExpectOk(async () =>
      API.delete({ path: documentOrFolder.downloadPath ?? `/person/${person._id}/document/${documentOrFolder.file.filename}` })
    );
    if (error) {
      toast.error("Erreur lors de la suppression du document, vous pouvez contactez le support");
      return false;
    }

    if (documentOrFolder.linkedItem.type === "treatment") {
      const treatment = treatments.find((t) => t._id === documentOrFolder.linkedItem._id);
      if (!treatment) return false;
      const [error] = await tryFetchExpectOk(
        async () =>
          await API.put({
            path: `/treatment/${treatment._id}`,
            body: await encryptTreatment({
              ...treatment,
              documents: treatment.documents.filter((d) => d._id !== documentOrFolder._id),
            }),
          })
      );
      if (!error) {
        await refresh();
        return true;
      } else {
        toast.error("Erreur lors de la suppression du document, vous pouvez contactez le support");
        return false;
      }
    }

    if (documentOrFolder.linkedItem.type === "consultation") {
      const consultation = consultations.find((c) => c._id === documentOrFolder.linkedItem._id);
      if (!consultation) return false;
      const [error] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/consultation/${consultation._id}`,
          body: await encryptConsultation(organisation.consultations)({
            ...consultation,
            documents: consultation.documents.filter((d) => d._id !== documentOrFolder._id),
          }),
        })
      );
      if (!error) {
        await refresh();
        return true;
      } else {
        toast.error("Erreur lors de la suppression du document, vous pouvez contactez le support");
        return false;
      }
    }

    if (documentOrFolder.linkedItem.type === "medical-file") {
      if (!medicalFile?._id) return false;
      const [error] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/medical-file/${medicalFile._id}`,
          body: await encryptMedicalFile(customFieldsMedicalFile)({
            ...medicalFile,
            documents: (medicalFile.documents?.length ? medicalFile.documents : [...defaultFolders]).filter((d) => d._id !== documentOrFolder._id),
          }),
        })
      );
      if (!error) {
        await refresh();
        return true;
      } else {
        toast.error("Erreur lors de la suppression du document, vous pouvez contactez le support");
        return false;
      }
    }
    return false;
  };

  const handleUpdateDocument = async (documentOrFolder: DocumentWithLinkedItem) => {
    if (documentOrFolder.linkedItem.type === "treatment") {
      const treatment = treatments.find((t) => t._id === documentOrFolder.linkedItem._id);
      if (!treatment) return;
      const [error] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/treatment/${treatment._id}`,
          body: await encryptTreatment({
            ...treatment,
            documents: treatment.documents.map((d) => {
              if (d._id === documentOrFolder._id) {
                const { linkedItem, ...rest } = documentOrFolder;
                const document = rest as Document | Folder;
                return document;
              }
              return d;
            }),
          }),
        })
      );
      if (!error) {
        await refresh();
      } else {
        toast.error("Erreur lors de la mise à jour du document, vous pouvez contactez le support");
      }
    }
    if (documentOrFolder.linkedItem.type === "consultation") {
      const consultation = consultations.find((c) => c._id === documentOrFolder.linkedItem._id);
      if (!consultation) return;
      const [error] = await tryFetchExpectOk(
        async () =>
          await API.put({
            path: `/consultation/${consultation._id}`,
            body: await encryptConsultation(organisation.consultations)({
              ...consultation,
              documents: consultation.documents.map((d) => {
                if (d._id === documentOrFolder._id) {
                  const { linkedItem, ...rest } = documentOrFolder;
                  const document = rest as Document | Folder;
                  return document;
                }
                return d;
              }),
            }),
          })
      );
      if (!error) {
        await refresh();
      } else {
        toast.error("Erreur lors de la mise à jour du document, vous pouvez contactez le support");
      }
    }
    if (documentOrFolder.linkedItem.type === "medical-file") {
      if (!medicalFile?._id) return;
      const [error] = await tryFetchExpectOk(
        async () =>
          await API.put({
            path: `/medical-file/${medicalFile._id}`,
            body: await encryptMedicalFile(customFieldsMedicalFile)({
              ...medicalFile,
              documents: (medicalFile.documents?.length ? medicalFile.documents : [...defaultFolders]).map((d) => {
                if (d._id === documentOrFolder._id) {
                  const { linkedItem, ...rest } = documentOrFolder;
                  const document = rest as Document | Folder;
                  return document;
                }
                return d;
              }),
            }),
          })
      );
      if (!error) {
        await refresh();
      } else {
        toast.error("Erreur lors de la mise à jour du document, vous pouvez contactez le support");
      }
    }
  };

  const handleAddDocuments = async (nextDocuments: Array<Document | Folder>) => {
    if (!medicalFile?._id) return;
    const [error] = await tryFetchExpectOk(
      async () =>
        await API.put({
          path: `/medical-file/${medicalFile._id}`,
          body: await encryptMedicalFile(customFieldsMedicalFile)({
            ...medicalFile,
            documents: [...(medicalFile.documents?.length ? medicalFile.documents : [...defaultFolders]), ...nextDocuments],
          }),
        })
    );
    if (error) {
      toast.error("Erreur lors de l'ajout des documents");
      throw error;
    }
  };

  if (!medicalFile) {
    return <div className="tw-p-4">Chargement...</div>;
  }

  return (
    <DocumentsAlt
      config={{
        documents: allMedicalDocuments,
        linkedItem: {
          _id: medicalFile._id,
          type: "medical-file",
        },
        supportsFolders: true,
        defaultFolders,
        readOnlyFolders,
        canToggleGroupCheck: false,
        title: `Documents médicaux`,
        color: "blue-900",
        showFullScreen: true,
        isInsideModal: false,
        onSaveDocuments: handleSaveDocuments,
        onDeleteDocument: handleDeleteDocument,
        onUpdateDocument: handleUpdateDocument,
      }}
    />
  );
};

export default PersonDocumentsMedicalAlt;
