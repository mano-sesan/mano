import { useMemo } from "react";
import { toast } from "react-toastify";
import type { Document } from "../types/document";
import { useDataLoader } from "../services/dataLoader";
import DocumentsAlt from "./DocumentsAlt";

interface ConsultationDocumentsAltProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  consultation: any; // Consultation with all its properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdateConsultation: (consultation: any) => Promise<void>;
}

export default function ConsultationDocumentsAlt({ consultation, onUpdateConsultation }: ConsultationDocumentsAltProps) {
  const { refresh } = useDataLoader();

  // Convert consultation documents to DocumentWithLinkedItem format
  const consultationDocuments = useMemo(() => {
    return (consultation.documents || []).map((doc) => ({
      ...doc,
      linkedItem: {
        _id: consultation._id,
        type: "consultation" as const,
      },
    }));
  }, [consultation]);

  const handleSaveDocuments = async (newDocuments: Array<Document>) => {
    // Remove linkedItem before saving
    const docsWithoutLinkedItem = newDocuments.map((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { linkedItem, ...rest } = doc as any;
      return rest as Document;
    });

    await onUpdateConsultation({
      ...consultation,
      documents: docsWithoutLinkedItem,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDeleteDocument = async (document: any): Promise<boolean> => {
    try {
      const { linkedItem, ...docWithoutLinkedItem } = document;
      await onUpdateConsultation({
        ...consultation,
        documents: consultation.documents.filter((d) => d._id !== docWithoutLinkedItem._id),
      });
      await refresh();
      return true;
    } catch (_error) {
      toast.error("Erreur lors de la suppression du document");
      return false;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUpdateDocument = async (document: any) => {
    const { linkedItem, ...docWithoutLinkedItem } = document;
    await onUpdateConsultation({
      ...consultation,
      documents: consultation.documents.map((d) => {
        if (d._id === docWithoutLinkedItem._id) return docWithoutLinkedItem;
        return d;
      }),
    });
    await refresh();
  };

  return (
    <DocumentsAlt
      config={{
        documents: consultationDocuments,
        linkedItem: {
          _id: consultation._id,
          type: "consultation",
        },
        personId: consultation.person, // Pass the person ID for file uploads
        supportsFolders: false, // Consultations don't support folders
        defaultFolders: [],
        readOnlyFolders: [],
        canToggleGroupCheck: false,
        title: "Documents",
        color: "main",
        showFullScreen: false, // Inside modal, no need for fullscreen
        isInsideModal: true, // Simplified view for modal context
        hideLinkedItemType: "consultation", // Hide "View consultation" link to avoid recursion
        onSaveDocuments: handleSaveDocuments,
        onDeleteDocument: handleDeleteDocument,
        onUpdateDocument: handleUpdateDocument,
      }}
    />
  );
}
