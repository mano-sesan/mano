import type { Document, Folder } from "@/types/document";

type DocOrFolder = Document | Folder;

/**
 * Fusionne le tableau `documents` local d'une entité avec celui du serveur,
 * dans le contexte d'une synchronisation post-offline.
 *
 * Règles, dans l'ordre :
 *
 *  1. Le serveur fait foi pour ce qu'il connaît. On part de `server` comme base.
 *     Ça respecte automatiquement les suppressions en ligne et inclut les ajouts
 *     en ligne intervenus pendant que l'utilisateur était hors-ligne.
 *
 *  2. On ré-injecte uniquement les items locaux marqués `_offlineAdded` qui ne
 *     sont pas déjà côté serveur. Ce flag est posé à la création offline (cf.
 *     DocumentsManager / MedicalFile) ; c'est notre **unique signal fiable**
 *     d'un ajout offline. On NE compare PAS les `createdAt` : l'horloge du
 *     téléphone n'est pas fiable (terrain, dérive, fuseaux). Conséquence : un
 *     item local non-taggé absent du serveur → c'est qu'il a été supprimé en
 *     ligne pendant la session offline → on le drop.
 *
 *  3. Re-parentage : si un item référence un `parentId` qui n'existe plus dans
 *     le résultat (dossier supprimé en ligne), on le remet à la racine.
 *
 *  4. Le flag `_offlineAdded` est strippé du résultat, qui est prêt à être
 *     envoyé au serveur.
 *
 * Note : la suppression de dossier est interdite en mode offline (l'UI affiche
 * une Alert dans ce cas — cf. DocumentsManager). Donc le scénario "dossier
 * supprimé offline mais existe encore côté serveur" n'arrive pas en pratique.
 */
export function mergeDocuments(local: DocOrFolder[] = [], server: DocOrFolder[] = []): DocOrFolder[] {
  const serverIds = new Set(server.map((d) => d._id));

  const stripFlag = (item: DocOrFolder): DocOrFolder => {
    if (!("_offlineAdded" in item)) return item;
    const { _offlineAdded, ...rest } = item as DocOrFolder & { _offlineAdded?: boolean };
    return rest as DocOrFolder;
  };

  // 1 + 2 : base serveur + ajouts offline taggés
  const merged: DocOrFolder[] = server.map(stripFlag);
  for (const item of local) {
    if (serverIds.has(item._id)) continue;
    if (item._offlineAdded) merged.push(stripFlag(item));
  }

  // 3 : re-parentage des orphelins
  const folderIds = new Set(merged.filter((d) => d.type === "folder").map((d) => d._id));
  return merged.map((d) => (d.parentId && !folderIds.has(d.parentId) ? { ...d, parentId: undefined } : d));
}
