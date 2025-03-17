import { useMemo } from "react";
import { toast } from "react-toastify";
import { useRecoilValue } from "recoil";
import type { RecoilValueReadOnly } from "recoil";
import { organisationAuthentifiedState } from "../../../recoil/auth";
import { usePreparePersonForEncryption } from "../../../recoil/persons";
import API, { tryFetchExpectOk } from "../../../services/api";
import { capture } from "../../../services/sentry";
import { DocumentsModule } from "../../../components/DocumentsGeneric";
import { groupsState } from "../../../recoil/groups";
import type { PersonPopulated, PersonInstance } from "../../../types/person";
import type { Document, DocumentWithLinkedItem, FolderWithLinkedItem, LinkedItem } from "../../../types/document";
import type { UUIDV4 } from "../../../types/uuid";
import { personsObjectSelector } from "../../../recoil/selectors";
import { encryptAction } from "../../../recoil/actions";
import { useDataLoader } from "../../../services/dataLoader";
import isEqual from "react-fast-compare";

interface PersonDocumentsProps {
  person: PersonPopulated;
}

type PersonIndex = Record<UUIDV4, PersonInstance>;

const PersonDocuments = ({ person }: PersonDocumentsProps) => {
  const { refresh } = useDataLoader();
  const organisation = useRecoilValue(organisationAuthentifiedState);
  const groups = useRecoilValue(groupsState);
  const { encryptPerson } = usePreparePersonForEncryption();
  const persons = useRecoilValue<PersonIndex>(personsObjectSelector as RecoilValueReadOnly<PersonIndex>);

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
    },
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

  const cleanedDocs = removeOldDefaultFolders(
    // Les documents et dossiers de la personne...
    [
      ...(person.documentsForModule || []),
      // Les documents et dossier du groupe (famille)
      ...(person.groupDocuments || []),
    ],
    defaultFolders
  );
  const documents = [
    // Le dossier "Actions" est ajouté si nécessaire, il s'affichera toujours en premier
    needsActionsFolder ? actionsFolder : undefined,
    ...cleanedDocs,
    // Les dossiers par défaut configurés par l'organisation
  ]
    .filter((e) => e)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const canToggleGroupCheck = useMemo(() => {
    if (!organisation.groupsEnabled) return false;
    const group = groups.find((group) => (group.persons || []).includes(person._id));
    if (!group) return false;
    return true;
  }, [groups, person._id, organisation.groupsEnabled]);

  return (
    <DocumentsModule
      showPanel
      socialOrMedical="social"
      tableWithFolders
      documents={documents}
      onSaveNewOrder={async (nextDocuments) => {
        // Mise à jour des documents de la personne
        const personNextDocuments = nextDocuments.filter((d) => d.linkedItem.type === "person" && d._id !== "actions");

        const [personError] = await tryFetchExpectOk(async () => {
          return API.put({
            path: `/person/${person._id}`,
            body: await encryptPerson({
              ...person,
              documents: [
                ...personNextDocuments,
                ...(person.documents || []).filter((docOrFolder) => {
                  const document = docOrFolder as unknown as Document;
                  return !!document.group;
                }),
              ],
            }),
          });
        });
        if (personError) {
          toast.error("Erreur lors de l'enregistrement des documents, vous pouvez contactez le support");
          return false;
        }

        // Mis à jour des documents des actions
        const actionNextDocuments = nextDocuments.filter((d) => d.linkedItem.type === "action");
        const actionIds = actionNextDocuments.map((d) => d.linkedItem._id);
        for (const actionId of actionIds) {
          const action = person.actions.find((a) => a._id === actionId);
          if (!action) {
            toast.error("Erreur lors de l'enregistrement des documents des actions, vous pouvez contactez le support");
            capture(new Error("Error while ordering documents (action not found)"), { extra: { actionId } });
            return false;
          }
          if (
            isEqual(
              action.documents,
              actionNextDocuments.filter((d) => d.linkedItem._id === actionId)
            )
          ) {
            continue;
          }
          const [actionError] = await tryFetchExpectOk(async () => {
            return API.put({
              path: `/action/${actionId}`,
              body: await encryptAction({
                ...action,
                documents: actionNextDocuments.filter((d) => d.linkedItem._id === actionId),
              }),
            });
          });
          if (actionError) {
            toast.error("Erreur lors de l'enregistrement des documents des actions, vous pouvez contactez le support");
          }
        }

        toast.success("Documents mis à jour");
        refresh();
        return true;
      }}
      personId={person._id}
      title={`Documents de ${person.name}`}
      canToggleGroupCheck={canToggleGroupCheck}
      onDeleteFolder={async (folder) => {
        // D'après le commentaire plus bas, on charge la personne liée au cas où c'est un dossier de groupe.
        // On a un edge case ici: si on a ajouté des documents pour quelqu'un d'autre, on les laisse dedans
        // et donc on les perds. Il faudrait probablement vérifier pour toutes les personnes du groupe.
        const _person = persons[folder.linkedItem._id];
        const [personError] = await tryFetchExpectOk(async () => {
          return API.put({
            path: `/person/${_person._id}`,
            body: await encryptPerson({
              ..._person,
              // If there are no document yet and default documents are present,
              // we save the default documents since they are modified by the user.
              documents: (_person.documents || [...defaultFolders])
                .filter((f) => f._id !== folder._id)
                .map((item) => {
                  if (item.parentId === folder._id) return { ...item, parentId: "" };
                  return item;
                }),
            }),
          });
        });
        if (personError) {
          toast.error("Erreur lors de la suppression du dossier, vous pouvez contactez le support");
          return false;
        }

        // Comme on peut déplacer des documents d'actions hors du dossier par défaut (grr),
        // il faut les remettre au bon endroit quand le dossier est supprimé.
        const actionDocumentsToUpdate = documents.filter((d) => d.linkedItem.type === "action" && d.parentId === folder._id);
        for (const actionDocument of actionDocumentsToUpdate) {
          const action = person.actions.find((a) => a._id === actionDocument.linkedItem._id);
          if (!action) {
            toast.error("Erreur lors de la suppression du dossier pour les actions liées, vous pouvez contactez le support");
            capture(new Error("Error while deleting folder (action not found)"), { extra: { actionDocument } });
            return false;
          }
          const [actionError] = await tryFetchExpectOk(async () => {
            return API.put({
              path: `/action/${action._id}`,
              body: await encryptAction({
                ...action,
                documents: action.documents.map((d) => {
                  if (d._id === actionDocument._id) return { ...d, parentId: "actions" }; // On remet dans le dossier "actions" par défaut
                  return d;
                }),
              }),
            });
          });
          if (actionError) {
            toast.error("Erreur lors de la suppression du dossier pour les actions liées, vous pouvez contactez le support");
            return false;
          }
        }
        toast.success("Dossier supprimé");
        refresh();
        return true;
      }}
      onDeleteDocument={async (document) => {
        // the document can be a group document, or a person document
        // so we need to get the person to update
        const _person = persons[document.linkedItem._id];
        const [documentError] = await tryFetchExpectOk(async () => {
          return API.delete({ path: document.downloadPath ?? `/person/${_person._id}/document/${document.file.filename}` });
        });
        if (documentError) {
          toast.error("Erreur lors de la suppression du document, vous pouvez contactez le support");
          return false;
        }

        if (document.linkedItem.type === "action") {
          const action = person.actions.find((a) => a._id === document.linkedItem._id);
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
          const [personError] = await tryFetchExpectOk(async () => {
            return API.put({
              path: `/person/${_person._id}`,
              body: await encryptPerson({
                ..._person,
                // If there are no document yet and default documents are present,
                // we save the default documents since they are modified by the user.
                documents: (_person.documents || [...defaultFolders])?.filter((d) => d._id !== document._id),
              }),
            });
          });
          if (personError) {
            toast.error("Erreur lors de la suppression du document, vous pouvez contactez le support");
            return false;
          }
        }

        toast.success("Document supprimé");
        refresh();
        return true;
      }}
      onSubmitDocument={async (documentOrFolder) => {
        if (documentOrFolder.linkedItem.type === "action") {
          const action = person.actions.find((a) => a._id === documentOrFolder.linkedItem._id);
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
          // the document can be a group document, or a person document, or a folder
          // so we need to get the person to update
          const _person = persons[documentOrFolder.linkedItem._id];
          const [personError] = await tryFetchExpectOk(async () => {
            return API.put({
              path: `/person/${_person._id}`,
              body: await encryptPerson({
                ..._person,
                // If there are no document yet and default documents are present,
                // we save the default documents since they are modified by the user.
                documents: (_person.documents || [...defaultFolders])?.map((d) => {
                  if (d._id === documentOrFolder._id) return documentOrFolder;
                  return d;
                }),
              }),
            });
          });
          if (personError) {
            toast.error("Erreur lors de la mise à jour du document, vous pouvez contactez le support");
            return;
          }
        }
        toast.success(documentOrFolder.type === "document" ? "Document mis à jour" : "Dossier mis à jour");
        refresh();
      }}
      onAddDocuments={async (newDocuments) => {
        const [personError] = await tryFetchExpectOk(async () => {
          const oldDocuments = person.documents?.length ? [...person.documents] : [...defaultFolders];
          return API.put({
            path: `/person/${person._id}`,
            body: await encryptPerson({
              ...person,
              // If there are no document yet and default documents are present,
              // we save the default documents since they are modified by the user.
              documents: [...oldDocuments, ...newDocuments],
            }),
          });
        });
        if (personError) {
          toast.error("Erreur lors de la création du document, vous pouvez contactez le support");
          return;
        }
        if (newDocuments.filter((d) => d.type === "document").length > 1) toast.success("Documents enregistrés !");
        if (newDocuments.filter((d) => d.type === "folder").length > 0) toast.success("Dossier créé !");
        refresh();
      }}
    />
  );
};

export default PersonDocuments;

function removeOldDefaultFolders(docsOrFolders: Array<FolderWithLinkedItem | DocumentWithLinkedItem>, defaultFolders: Array<FolderWithLinkedItem>) {
  // Scénario: une organisation paramètre des dossiers par défaut, le dossier "Dossier A" est créé
  // et plus tard change ce paramétrage, et ne mets plus de "Dossier A" dans la configuration
  // il reste donc des dossiers vides, auparavant configurés par l'organisation
  // ce n'est pas pertinent pour l'utilisateur de voir ces dossiers vides, donc on les masque

  const defaultFoldersIds = defaultFolders.map((d) => d._id);
  const foldersFromPreviousDefaultFolders: Array<FolderWithLinkedItem> = [];
  const validItems: Array<FolderWithLinkedItem | DocumentWithLinkedItem> = [...defaultFolders];
  for (let item of docsOrFolders) {
    // si ce n'est pas un dossier, c'est un document, on l'affiche
    if (item.type !== "folder") {
      validItems.push(item);
      continue;
    }
    item = item as FolderWithLinkedItem;
    // Seuls les dossiers avec `movable` à `false` sont des dossiers potentiellement par défault
    // de la configuration actuelle ou ancienne des dossiers par défaut de l'organisation
    if (defaultFoldersIds.includes(item._id)) {
      // Si le dossier est dans la liste des dossiers par défaut,
      // on passe au suivant
      continue;
    }
    if (item.movable !== false) {
      // Si le dossier n'a pas `movable === false`,
      // c'est un dossier créé par l'utilisateur pour la personne, on l'affiche
      validItems.push(item);
      continue;
    }
    // Mous avons donc à faire avec un dossier par défaut de l'ancienne configuration
    // qui n'est plus présent dans la configuration actuelle
    // il faut voir s'il a des documents dedans
    foldersFromPreviousDefaultFolders.push(item);
  }

  if (foldersFromPreviousDefaultFolders.length > 0) {
    // on a des dossiers par défaut de l'ancienne configuration
    // il faut voir s'ils ont des documents dedans
    for (const item of foldersFromPreviousDefaultFolders) {
      if (recursiveCheckIfFolderHasDocuments(item, docsOrFolders)) {
        validItems.push(item);
      }
    }
  }

  return validItems;
}

function recursiveCheckIfFolderHasDocuments(folder: FolderWithLinkedItem, docsOrFolders: Array<FolderWithLinkedItem | DocumentWithLinkedItem>) {
  const documents = docsOrFolders?.filter((d) => d.type === "document");
  const folders = docsOrFolders?.filter((d) => d.type === "folder" && d._id !== folder._id);
  for (const doc of documents) {
    if (doc.parentId === folder._id) return true;
  }
  for (const folder of folders) {
    if (folder.parentId !== folder._id) continue;
    if (recursiveCheckIfFolderHasDocuments(folder as FolderWithLinkedItem, docsOrFolders)) return true;
  }
  return false;
}
