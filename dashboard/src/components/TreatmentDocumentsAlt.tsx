import { useMemo } from "react";
import { toast } from "react-toastify";
import type { Document } from "../types/document";
import { useDataLoader } from "../services/dataLoader";
import DocumentsAlt from "./DocumentsAlt";

interface TreatmentDocumentsAltProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  treatment: any; // Treatment with all its properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdateTreatment: (treatment: any) => Promise<void>;
}

export default function TreatmentDocumentsAlt({ treatment, onUpdateTreatment }: TreatmentDocumentsAltProps) {
  const { refresh } = useDataLoader();

  // Convert treatment documents to DocumentWithLinkedItem format
  const treatmentDocuments = useMemo(() => {
    return (treatment.documents || []).map((doc) => ({
      ...doc,
      linkedItem: {
        _id: treatment._id,
        type: "treatment" as const,
      },
    }));
  }, [treatment]);

  const handleSaveDocuments = async (newDocuments: Array<Document>) => {
    // Remove linkedItem before saving
    const docsWithoutLinkedItem = newDocuments.map((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { linkedItem, ...rest } = doc as any;
      return rest as Document;
    });

    await onUpdateTreatment({
      ...treatment,
      documents: docsWithoutLinkedItem,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDeleteDocument = async (document: any): Promise<boolean> => {
    try {
      const { linkedItem, ...docWithoutLinkedItem } = document;
      await onUpdateTreatment({
        ...treatment,
        documents: treatment.documents.filter((d) => d._id !== docWithoutLinkedItem._id),
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
    await onUpdateTreatment({
      ...treatment,
      documents: treatment.documents.map((d) => {
        if (d._id === docWithoutLinkedItem._id) return docWithoutLinkedItem;
        return d;
      }),
    });
    await refresh();
  };

  return (
    <DocumentsAlt
      config={{
        documents: treatmentDocuments,
        linkedItem: {
          _id: treatment._id,
          type: "treatment",
        },
        personId: treatment.person, // Pass the person ID for file uploads
        supportsFolders: false, // Treatments don't support folders
        defaultFolders: [],
        readOnlyFolders: [],
        canToggleGroupCheck: false,
        title: "Documents",
        color: "blue-900",
        showFullScreen: false, // Inside modal, no need for fullscreen
        isInsideModal: true, // Simplified view for modal context
        hideLinkedItemType: "treatment", // Hide "View treatment" link to avoid recursion
        onSaveDocuments: handleSaveDocuments,
        onDeleteDocument: handleDeleteDocument,
        onUpdateDocument: handleUpdateDocument,
      }}
    />
  );
}
