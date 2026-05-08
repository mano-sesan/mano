import type { CommentInstance } from "@/types/comment";

/**
 * Fusionne le tableau `comments` local d'une entité avec celui du serveur,
 * dans le contexte d'une synchronisation post-offline.
 *
 * Mêmes règles que mergeDocuments, en plus simple (pas de hiérarchie / parent) :
 *
 *  1. Le serveur fait foi pour ce qu'il connaît. On part de `server` comme base
 *     → ça respecte automatiquement les suppressions en ligne et inclut les
 *     ajouts en ligne intervenus pendant que l'utilisateur était hors-ligne.
 *
 *  2. On ré-injecte uniquement les commentaires locaux marqués `_offlineAdded`
 *     qui ne sont pas déjà côté serveur (dédupliqués par `_id`). Le flag est
 *     posé par buildEmptyComment ; c'est l'unique signal fiable d'un ajout
 *     offline. Un commentaire local non-taggé absent du serveur → supprimé en
 *     ligne pendant la session offline → on le drop.
 *
 *  3. Le flag `_offlineAdded` est strippé du résultat.
 */
export function mergeComments(local: CommentInstance[] = [], server: CommentInstance[] = []): CommentInstance[] {
  const serverIds = new Set(server.map((c) => c._id));

  const stripFlag = (c: CommentInstance): CommentInstance => {
    if (!("_offlineAdded" in c)) return c;
    const { _offlineAdded, ...rest } = c;
    return rest as CommentInstance;
  };

  const merged: CommentInstance[] = server.map(stripFlag);
  for (const c of local) {
    if (serverIds.has(c._id)) continue;
    if (c._offlineAdded) merged.push(stripFlag(c));
  }
  return merged;
}
