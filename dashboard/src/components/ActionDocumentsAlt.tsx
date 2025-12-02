import { useMemo } from "react";
import { toast } from "react-toastify";
import type { Document } from "../types/document";
import { useDataLoader } from "../services/dataLoader";
import DocumentsAlt from "./DocumentsAlt";

interface ActionDocumentsAltProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: any; // Action with all its properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdateAction: (action: any) => Promise<void>;
}

export default function ActionDocumentsAlt({ action, onUpdateAction }: ActionDocumentsAltProps) {
  const { refresh } = useDataLoader();

  // Convert action documents to DocumentWithLinkedItem format
  const actionDocuments = useMemo(() => {
    return (action.documents || []).map((doc) => ({
      ...doc,
      linkedItem: {
        _id: action._id,
        type: "action" as const,
      },
    }));
  }, [action]);

  const handleSaveDocuments = async (newDocuments: Array<Document>) => {
    // Remove linkedItem before saving (it's not part of the action document schema)
    const docsWithoutLinkedItem = newDocuments.map((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { linkedItem, ...rest } = doc as any;
      return rest as Document;
    });

    await onUpdateAction({
      ...action,
      documents: docsWithoutLinkedItem,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDeleteDocument = async (document: any): Promise<boolean> => {
    try {
      const { linkedItem, ...docWithoutLinkedItem } = document;
      await onUpdateAction({
        ...action,
        documents: action.documents.filter((d) => d._id !== docWithoutLinkedItem._id),
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
    await onUpdateAction({
      ...action,
      documents: action.documents.map((d) => {
        if (d._id === docWithoutLinkedItem._id) return docWithoutLinkedItem;
        return d;
      }),
    });
    await refresh();
  };

  return (
    <DocumentsAlt
      config={{
        documents: actionDocuments,
        linkedItem: {
          _id: action._id,
          type: "action",
        },
        personId: action.person, // Pass the person ID for file uploads
        supportsFolders: false, // Actions don't support folders
        defaultFolders: [],
        readOnlyFolders: [],
        canToggleGroupCheck: false,
        title: "Documents",
        color: "main",
        showFullScreen: false, // Inside modal, no need for fullscreen
        isInsideModal: true, // Simplified view for modal context
        hideLinkedItemType: "action", // Hide "View action" link to avoid recursion
        onSaveDocuments: handleSaveDocuments,
        onDeleteDocument: handleDeleteDocument,
        onUpdateDocument: handleUpdateDocument,
      }}
    />
  );
}
