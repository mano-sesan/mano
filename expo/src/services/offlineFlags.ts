/**
 * Strippe le flag transitoire `_offlineAdded` des champs tableau (`documents`,
 * `comments`) avant l'envoi serveur.
 *
 * Le flag n'a de sens que côté client (signal pour mergeDocuments / mergeComments).
 * Il ne doit jamais être persisté côté serveur où il survivrait indéfiniment dans
 * le blob chiffré et polluerait les futurs round-trips.
 *
 * Appelé depuis :
 *  - api.ts juste avant `encryptItem` (path online direct)
 *  - syncProcessor.processMutation juste avant le PUT de synchro (path post-offline,
 *    cas où aucun conflit n'a été détecté et où mergeDocuments/mergeComments
 *    n'auraient donc pas eu l'occasion de stripper)
 */
export function stripOfflineAddedFlag(body: any): any {
  if (!body?.decrypted) return body;
  const decrypted = { ...body.decrypted };
  let changed = false;
  for (const key of ["documents", "comments"]) {
    const arr = decrypted[key];
    if (!Array.isArray(arr)) continue;
    decrypted[key] = arr.map((item: any) => {
      if (!item || !("_offlineAdded" in item)) return item;
      const { _offlineAdded, ...rest } = item;
      return rest;
    });
    changed = true;
  }
  if (!changed) return body;
  return { ...body, decrypted };
}
