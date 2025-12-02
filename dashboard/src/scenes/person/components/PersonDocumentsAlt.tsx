import { useMemo } from "react";
import { toast } from "react-toastify";
import { useRecoilValue } from "recoil";
import { organisationAuthentifiedState } from "../../../recoil/auth";
import { usePreparePersonForEncryption } from "../../../recoil/persons";
import API, { tryFetchExpectOk } from "../../../services/api";
import { capture } from "../../../services/sentry";
import type { PersonPopulated } from "../../../types/person";
import type { DocumentWithLinkedItem, FolderWithLinkedItem, Document, Folder, LinkedItem } from "../../../types/document";
import { encryptAction } from "../../../recoil/actions";
import { removeOldDefaultFolders } from "../../../utils/documents";
import { loadFreshPersonData } from "../../../utils/loadFreshPersonData";
import { groupsState } from "../../../recoil/groups";
import DocumentsAlt from "../../../components/DocumentsAlt";

interface PersonDocumentsAltProps {
  person: PersonPopulated;
}

export default function PersonDocumentsAlt({ person }: PersonDocumentsAltProps) {
  const organisation = useRecoilValue(organisationAuthentifiedState);
  const { encryptPerson } = usePreparePersonForEncryption();
  const groups = useRecoilValue(groupsState);

  // Build read-only folders (actions folder if needed)
  const readOnlyFolders = useMemo(() => {
    if (!person) return [];

    const needsActionsFolder =
      !person.documentsForModule?.some((d) => d._id === "actions") && person.documentsForModule?.some((d) => d.linkedItem.type === "action");

    if (!needsActionsFolder) return [];

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

    return [actionsFolder];
  }, [person]);

  // Build default folders
  const defaultFolders: Array<FolderWithLinkedItem> = useMemo(
    () =>
      (organisation.defaultPersonsFolders || []).map((folder) => ({
        ...folder,
        movable: false,
        linkedItem: {
          _id: person._id,
          type: "person",
        } as LinkedItem,
      })),
    [organisation.defaultPersonsFolders, person._id]
  );

  // All person documents (personal + group documents)
  const personDocuments = useMemo(() => {
    if (!person) return [];
    return [...(person.documentsForModule || []), ...(person.groupDocuments || [])];
  }, [person]);

  // Can toggle group checkbox if groups enabled and person is in a group
  const canToggleGroupCheck = useMemo(() => {
    if (!organisation.groupsEnabled) return false;
    const group = groups.find((group) => (group.persons || []).includes(person._id));
    if (!group) return false;
    return true;
  }, [groups, person._id, organisation.groupsEnabled]);

  // Handlers for saving documents
  const handleSaveDocuments = async (newDocuments: Array<Document | Folder>) => {
    // Load fresh person data to prevent race conditions
    const freshPerson = await loadFreshPersonData(person._id);
    if (!freshPerson) {
      toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
      return;
    }

    const groupDocuments = (freshPerson.documents || []).filter((docOrFolder) => {
      const document = docOrFolder as unknown as Document;
      return !!document.group;
    });

    const [personError] = await tryFetchExpectOk(async () => {
      return API.put({
        path: `/person/${person._id}`,
        body: await encryptPerson({
          ...freshPerson,
          documents: [...newDocuments, ...groupDocuments],
        }),
      });
    });

    if (personError) {
      toast.error("Erreur lors de l'enregistrement des documents");
      throw personError;
    }
  };

  const handleDeleteDocument = async (document: DocumentWithLinkedItem): Promise<boolean> => {
    // Prevent deletion of documents from other persons in the group
    if (document.linkedItem && document.linkedItem.type === "person" && document.linkedItem._id !== person._id) {
      toast.error("Vous pouvez supprimer ce document uniquement depuis la personne initiale de ce document familial");
      return false;
    }

    // Delete the document from the API
    const [documentError] = await tryFetchExpectOk(async () => {
      return API.delete({ path: document.downloadPath ?? `/person/${person._id}/document/${document.file.filename}` });
    });
    if (documentError) {
      toast.error("Erreur lors de la suppression du document");
      return false;
    }

    if (document.linkedItem.type === "action") {
      const action = person.actions?.find((a) => a._id === document.linkedItem._id);
      if (!action) {
        toast.error("Erreur lors de la suppression du document pour les actions liées, vous pouvez contactez le support");
        capture(new Error("Error while deleting document (action not found)"), { extra: { document } });
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
        return false;
      }
    } else {
      // Load fresh person data
      const freshPerson = await loadFreshPersonData(person._id);
      if (!freshPerson) {
        toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
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
        return false;
      }
    }

    return true;
  };

  const handleUpdateDocument = async (documentOrFolder: DocumentWithLinkedItem) => {
    if (documentOrFolder.linkedItem.type === "action") {
      const action = person.actions?.find((a) => a._id === documentOrFolder.linkedItem._id);
      if (!action) {
        toast.error("Erreur lors de la mise à jour du document pour les actions liées, vous pouvez contactez le support");
        capture(new Error("Error while updating document (action not found)"), { extra: { documentOrFolder } });
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
        return;
      }
    } else {
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
              if (d._id === documentOrFolder._id) return documentOrFolder;
              return d;
            }),
          }),
        });
      });
      if (personError) {
        toast.error("Erreur lors de la mise à jour du document");
        return;
      }
    }
  };

  const handleUpdateFolder = async (folder: FolderWithLinkedItem) => {
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
            if (d._id === folder._id) return folder;
            return d;
          }),
        }),
      });
    });
    if (personError) {
      toast.error("Erreur lors de la mise à jour du dossier");
      throw personError;
    }
  };

  const handleDeleteFolder = async (folder: FolderWithLinkedItem): Promise<boolean> => {
    const freshPerson = await loadFreshPersonData(person._id);
    if (!freshPerson) {
      toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
      return false;
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
      return false;
    }

    return true;
  };

  // Safety check
  if (!person) {
    return <div className="tw-p-4">Chargement...</div>;
  }

  return (
    <DocumentsAlt
      config={{
        documents: personDocuments,
        linkedItem: {
          _id: person._id,
          type: "person",
        },
        supportsFolders: true,
        defaultFolders,
        readOnlyFolders,
        canToggleGroupCheck,
        title: "Documents",
        color: "main",
        showFullScreen: true,
        isInsideModal: false,
        onSaveDocuments: handleSaveDocuments,
        onDeleteDocument: handleDeleteDocument,
        onDeleteFolder: handleDeleteFolder,
        onUpdateDocument: handleUpdateDocument,
        onUpdateFolder: handleUpdateFolder,
      }}
    />
  );
}
