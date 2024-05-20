import { useMemo } from "react";
import { toast } from "react-toastify";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { organisationAuthentifiedState, userAuthentifiedState } from "../../../recoil/auth";
import { consultationsState, encryptConsultation, prepareConsultationForEncryption } from "../../../recoil/consultations";
import { customFieldsMedicalFileSelector, encryptMedicalFile, medicalFileState, prepareMedicalFileForEncryption } from "../../../recoil/medicalFiles";
import { encryptTreatment, prepareTreatmentForEncryption, treatmentsState } from "../../../recoil/treatments";
import API, { encryptItem } from "../../../services/api";
import { capture } from "../../../services/sentry";
import { DocumentsModule } from "../../../components/DocumentsGeneric";
import type { PersonPopulated } from "../../../types/person";
import type { DocumentWithLinkedItem, FolderWithLinkedItem, Document, Folder } from "../../../types/document";
import { useDataLoader } from "../../../components/DataLoader";
import api from "../../../services/apiv2";

interface PersonDocumentsProps {
  person: PersonPopulated;
}

const PersonDocumentsMedical = ({ person }: PersonDocumentsProps) => {
  const user = useRecoilValue(userAuthentifiedState);
  const organisation = useRecoilValue(organisationAuthentifiedState);
  const { refresh } = useDataLoader();

  const setAllConsultations = useSetRecoilState(consultationsState);
  const consultations = useMemo(() => person.consultations ?? [], [person.consultations]);

  const setAllTreatments = useSetRecoilState(treatmentsState);
  const treatments = useMemo(() => person.treatments ?? [], [person.treatments]);

  const customFieldsMedicalFile = useRecoilValue(customFieldsMedicalFileSelector);
  const setAllMedicalFiles = useSetRecoilState(medicalFileState);
  const medicalFile = person.medicalFile;

  const allMedicalDocuments = useMemo(() => {
    if (!medicalFile) return [];
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
        createdBy: "we do not care",
      },
    ];
    for (const treatment of treatments) {
      for (const document of treatment.documents || []) {
        const docWithLinkedItem = {
          ...document,
          type: document.type ?? "document", // it will always be a document in treatments - folders are only saved in medicalFile
          linkedItem: {
            _id: treatment._id,
            type: "treatment",
          },
          parentId: document.parentId ?? "treatment",
        } as DocumentWithLinkedItem;
        treatmentsDocs.push(docWithLinkedItem);
      }
    }

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
        createdBy: "we do not care",
      },
    ];
    for (const consultation of consultations) {
      if (consultation?.onlyVisibleBy?.length) {
        if (!consultation.onlyVisibleBy.includes(user._id)) continue;
      }
      for (const document of consultation.documents || []) {
        const docWithLinkedItem = {
          ...document,
          type: document.type ?? "document", // it will always be a document in treatments - folders are only saved in medicalFile
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
        type: document.type ?? "document", // or 'folder'
        linkedItem: {
          _id: medicalFile._id,
          type: "medical-file",
        },
        parentId: document.parentId ?? "root",
      } as DocumentWithLinkedItem;
      otherDocs.push(docWithLinkedItem);
    }

    return [...treatmentsDocs, ...consultationsDocs, ...otherDocs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [consultations, medicalFile, treatments, user._id]);

  return (
    <DocumentsModule
      showPanel
      socialOrMedical="medical"
      documents={allMedicalDocuments}
      color="blue-900"
      title={`Documents médicaux de ${person.name} (${allMedicalDocuments.length})`}
      personId={person._id}
      onDeleteDocument={async (documentOrFolder) => {
        // FIXME Il semblerait que ce soit toujours un document et non un documentOrFolder.
        // Il y a une fonction onDeleteFolder qui est utilisée dans PersonDocuments.tsx
        if (documentOrFolder.type === "document") {
          const document = documentOrFolder as DocumentWithLinkedItem;
          await api.delete(document.downloadPath ?? `/person/${person._id}/document/${document.file.filename}`);
        }
        if (documentOrFolder.linkedItem.type === "treatment") {
          const treatment = treatments.find((t) => t._id === documentOrFolder.linkedItem._id);
          if (!treatment) return false;
          const treatmentResponse = await api.put(
            `/treatment/${treatment._id}`,
            await encryptTreatment({
              ...treatment,
              documents: treatment.documents.filter((d) => d._id !== documentOrFolder._id),
            })
          );
          if (treatmentResponse.ok) {
            await refresh();
            toast.success("Document supprimé");
            return true;
          } else {
            toast.error("Erreur lors de la suppression du document, vous pouvez contactez le support");
            capture("Error while deleting treatment document", { treatmentResponse });
          }
        }
        if (documentOrFolder.linkedItem.type === "consultation") {
          const consultation = consultations.find((c) => c._id === documentOrFolder.linkedItem._id);
          if (!consultation) return false;
          const consultationResponse = await api.put(
            `/consultation/${consultation._id}`,
            await encryptConsultation(organisation.consultations)({
              ...consultation,
              documents: consultation.documents.filter((d) => d._id !== documentOrFolder._id),
            })
          );
          if (consultationResponse.ok) {
            await refresh();
            toast.success("Document supprimé");
            return true;
          } else {
            toast.error("Erreur lors de la suppression du document, vous pouvez contactez le support");
            capture("Error while deleting consultation document", { consultationResponse });
          }
        }
        if (documentOrFolder.linkedItem.type === "medical-file") {
          if (!medicalFile?._id) return false;
          const medicalFileResponse = await api.put(
            `/medical-file/${medicalFile._id}`,
            await encryptMedicalFile(customFieldsMedicalFile)({
              ...medicalFile,
              documents: medicalFile.documents.filter((d) => d._id !== documentOrFolder._id),
            })
          );
          if (medicalFileResponse.ok) {
            await refresh();
            toast.success("Document supprimé");
            return true;
          } else {
            toast.error("Erreur lors de la suppression du document, vous pouvez contactez le support");
            capture("Error while deleting medical file document", { medicalFileResponse });
          }
        }
        return false;
      }}
      onSubmitDocument={async (documentOrFolder) => {
        if (documentOrFolder.linkedItem.type === "treatment") {
          const treatment = treatments.find((t) => t._id === documentOrFolder.linkedItem._id);
          if (!treatment) return;
          const treatmentResponse = await api.put(
            `/treatment/${treatment._id}`,
            await encryptTreatment({
              ...treatment,
              documents: treatment.documents.map((d) => {
                if (d._id === documentOrFolder._id) {
                  // remove linkedItem from document
                  const { linkedItem, ...rest } = documentOrFolder;
                  const document = rest as Document | Folder;
                  return document;
                }
                return d;
              }),
            })
          );
          if (treatmentResponse.ok) {
            await refresh();
            toast.success("Document mis à jour");
          } else {
            toast.error("Erreur lors de la mise à jour du document, vous pouvez contactez le support");
            capture("Error while updating treatment document", { treatmentResponse });
          }
        }
        if (documentOrFolder.linkedItem.type === "consultation") {
          const consultation = consultations.find((c) => c._id === documentOrFolder.linkedItem._id);
          if (!consultation) return;
          const consultationResponse = await api.put(
            `/consultation/${consultation._id}`,
            await encryptConsultation(organisation.consultations)({
              ...consultation,
              documents: consultation.documents.map((d) => {
                if (d._id === documentOrFolder._id) {
                  // remove linkedItem from document
                  const { linkedItem, ...rest } = documentOrFolder;
                  const document = rest as Document | Folder;
                  return document;
                }
                return d;
              }),
            })
          );
          if (consultationResponse.ok) {
            await refresh();
            toast.success("Document mis à jour");
          } else {
            toast.error("Erreur lors de la mise à jour du document, vous pouvez contactez le support");
            capture("Error while updating consultation document", { consultationResponse });
          }
        }
        if (documentOrFolder.linkedItem.type === "medical-file") {
          if (!medicalFile?._id) return;
          const medicalFileResponse = await api.put(
            `/medical-file/${medicalFile._id}`,
            await encryptMedicalFile(customFieldsMedicalFile)({
              ...medicalFile,
              documents: medicalFile.documents.map((d) => {
                if (d._id === documentOrFolder._id) {
                  // remove linkedItem from document
                  const { linkedItem, ...rest } = documentOrFolder;
                  const document = rest as Document | Folder;
                  return document;
                }
                return d;
              }),
            })
          );
          if (medicalFileResponse.ok) {
            await refresh();
            toast.success("Document mis à jour");
          } else {
            toast.error("Erreur lors de la mise à jour du document, vous pouvez contactez le support");
            capture("Error while updating medical file document", { medicalFileResponse });
          }
        }
      }}
      onSaveNewOrder={async (nextDocuments) => {
        try {
          const groupedById: any = {
            treatment: {},
            consultation: {},
            "medical-file": {},
          };
          for (const document of nextDocuments) {
            if (document._id === "treatment") continue; // it's the non movable Treatments folder
            if (document._id === "consultation") continue; // it's the non movable Consultations folder
            if (!groupedById[document.linkedItem.type][document.linkedItem._id]) groupedById[document.linkedItem.type][document.linkedItem._id] = [];
            groupedById[document.linkedItem.type][document.linkedItem._id].push(document);
          }
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

          const consultationsToUpdate = await Promise.all(
            Object.keys(groupedById.consultation).map((consultationId) => {
              const consultation = consultations.find((c) => c._id === consultationId);
              if (!consultation) throw new Error("Consultation not found");
              const nextConsultation = encryptConsultation(organisation.consultations)({
                ...consultation,
                documents: groupedById.consultation[consultationId],
              });
              return nextConsultation;
            })
          );
          if (!medicalFile?._id) throw new Error("Medical file not found");
          const encryptedMedicalFile = await encryptMedicalFile(customFieldsMedicalFile)({
            ...medicalFile,
            documents: groupedById["medical-file"][medicalFile._id],
          });
          const medicalDocumentsResponse = await api.put("/medical-file/documents-reorder", {
            treatments: treatmentsToUpdate,
            consultations: consultationsToUpdate,
            medicalFile: encryptedMedicalFile,
          });
          if (medicalDocumentsResponse.ok) {
            toast.success("Documents mis à jour");
            await refresh();
            return true;
          } else {
            toast.error("Erreur lors de la mise à jour des documents, vous pouvez contactez le support");
            capture("Error while updating medical file documents reorder", { medicalDocumentsResponse });
          }
          return false;
        } catch (e) {
          toast.error("Erreur lors de la mise à jour des documents, vous pouvez contactez le support");
          capture(e, { message: "Error while updating documents order" });
        }
        return false;
      }}
      onAddDocuments={async (nextDocuments) => {
        if (!medicalFile?._id) return;
        const medicalFileResponse = await api.put(
          `/medical-file/${medicalFile._id}`,
          await encryptMedicalFile(customFieldsMedicalFile)({
            ...medicalFile,
            documents: [...(medicalFile.documents || []), ...nextDocuments],
          })
        );
        if (medicalFileResponse.ok) {
          if (nextDocuments.filter((d) => d.type === "document").length > 1) toast.success("Documents enregistrés !");
          if (nextDocuments.filter((d) => d.type === "folder").length > 0) toast.success("Dossier créé !");
          await refresh();
        }
      }}
    />
  );
};

export default PersonDocumentsMedical;
