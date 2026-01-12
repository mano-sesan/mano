import type { DocumentWithLinkedItem, FolderWithLinkedItem } from "../types/document";

export function removeOldDefaultFolders(
  docsOrFolders: Array<FolderWithLinkedItem | DocumentWithLinkedItem>,
  defaultFolders: Array<FolderWithLinkedItem>
) {
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
    // Nous avons donc à faire avec un dossier par défaut de l'ancienne configuration
    // qui n'est plus présent dans la configuration actuelle
    // il faut voir s'il a des documents dedans
    foldersFromPreviousDefaultFolders.push(item);
  }

  if (foldersFromPreviousDefaultFolders.length > 0) {
    // on a des dossiers par défaut de l'ancienne configuration
    // il faut voir s'ils ont des documents dedans
    for (const item of foldersFromPreviousDefaultFolders) {
      if (checkIfFolderHasDocuments(item, docsOrFolders)) {
        // Le dossier n'est plus un dossier par défaut, on le rend modifiable/déplaçable
        validItems.push({ ...item, movable: undefined });
      }
    }
  }

  // Gestion des orphelins : si un dossier parent a été supprimé,
  // les enfants doivent être promus à la racine pour rester visibles
  const keptFolderIds = new Set(validItems.filter((i) => i.type === "folder").map((i) => i._id));
  return validItems.map((item) => {
    // Si le parent existe ou est "root"/undefined, on ne change rien
    if (!item.parentId || item.parentId === "root" || keptFolderIds.has(item.parentId)) {
      return item;
    }
    // Le parent n'existe plus, on promeut l'item à la racine
    return { ...item, parentId: "root" };
  });
}

function checkIfFolderHasDocuments(folder: FolderWithLinkedItem, docsOrFolders: Array<FolderWithLinkedItem | DocumentWithLinkedItem>) {
  const documents = docsOrFolders?.filter((d) => d.type === "document");
  for (const doc of documents) {
    if (doc.parentId === folder._id) return true;
  }
  return false;
}
