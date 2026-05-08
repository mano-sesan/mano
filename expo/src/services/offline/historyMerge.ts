/**
 * Fusionne le tableau `history` local d'une entité avec celui du serveur.
 *
 * Le journal d'historique est un append-only log : aucune entrée n'est jamais
 * modifiée ni supprimée. Les entrées n'ont pas d'`_id` ; elles sont identifiées
 * par leur contenu (date, user, data). Stratégie :
 *
 *  1. On part du serveur (toutes les entrées qu'il connaît).
 *  2. On ajoute les entrées locales qui ne sont pas déjà présentes côté serveur,
 *     identifiées par égalité profonde (JSON.stringify) — c'est suffisant car
 *     une entrée est unique par combinaison date + user + data.
 *  3. On trie par `date` décroissant (du plus récent au plus ancien) pour rester
 *     cohérent avec le format usuel du journal.
 *
 * Pas de tag `_offlineAdded` requis : les entrées sont auto-identifiables par
 * leur contenu, contrairement aux documents/comments où le `_id` ne suffit pas
 * à distinguer "ajouté offline" de "supprimé en ligne".
 */
export type HistoryEntry = Record<string, any>;

export function mergeHistory(local: HistoryEntry[] = [], server: HistoryEntry[] = []): HistoryEntry[] {
  const serverKeys = new Set(server.map((e) => JSON.stringify(e)));
  const merged: HistoryEntry[] = [...server];
  for (const entry of local) {
    if (!serverKeys.has(JSON.stringify(entry))) merged.push(entry);
  }
  return merged.sort((a, b) => {
    const da = a?.date ? new Date(a.date).getTime() : 0;
    const db = b?.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });
}
