import structuredClone from "@ungap/structured-clone";
import { capture } from "../services/sentry";
import type { PersonPopulated } from "../types/person";
import type { CustomOrPredefinedField } from "../types/field";
import { dayjsInstance } from "../services/date";
import { getValueByField } from "./person-get-value-by-field";
import { forbiddenPersonFieldsInHistory } from "../atoms/persons";

const fixedInTimeFields = ["birthdate", "gender", "followedSince"];

// Champs liés à la sortie de file active - ils utilisent outOfActiveListDate comme date de référence
const outOfActiveListFields = ["outOfActiveList", "outOfActiveListDate", "outOfActiveListReasons"];

// Détermine la date de référence pour un item d'historique et un champ donné
// Pour les champs de sortie de file active, on utilise la date indiquée (outOfActiveListDate) au lieu de la date de saisie
function getReferenceDateForHistoryItem(historyItem: PersonPopulated["history"][number], fieldName: string): Date {
  // Si c'est un champ de sortie de file active et qu'on a une date de sortie indiquée
  if (outOfActiveListFields.includes(fieldName) && "outOfActiveListDate" in historyItem.data && "outOfActiveList" in historyItem.data) {
    const outOfActiveListDateEntry = historyItem.data.outOfActiveListDate as { oldValue?: unknown; newValue?: unknown } | undefined;
    const outOfActiveListEntry = historyItem.data.outOfActiveList as { oldValue?: unknown; newValue?: unknown } | undefined;

    // Si c'est une sortie de file active (pas une réintégration) avec une date indiquée
    if (outOfActiveListDateEntry?.newValue && outOfActiveListEntry?.newValue === true) {
      const indicatedDate = outOfActiveListDateEntry.newValue;
      if (typeof indicatedDate === "number") {
        return new Date(indicatedDate);
      } else if (typeof indicatedDate === "string") {
        return new Date(indicatedDate);
      } else if (indicatedDate instanceof Date) {
        return indicatedDate;
      }
    }
  }
  // Par défaut, utiliser la date de saisie de l'historique
  return new Date(historyItem.date);
}

export function getPersonSnapshotAtDate({
  person,
  snapshotDate,
  typesByFields,
  onlyForFieldName,
  replaceNullishWithNonRenseigne = false,
}: {
  person: PersonPopulated;
  snapshotDate: string; // YYYY-MM-DD
  typesByFields: Record<CustomOrPredefinedField["name"], CustomOrPredefinedField["type"]>;
  onlyForFieldName?: CustomOrPredefinedField["name"];
  replaceNullishWithNonRenseigne?: boolean;
}): PersonPopulated | null {
  if (!person.history?.length) {
    return person;
  }
  if (!snapshotDate) {
    return person;
  }
  const reversedHistory = [...person.history].reverse();
  let snapshot = structuredClone(person);
  // On doit parcourir tout l'historique car les champs outOfActiveList* peuvent avoir
  // une date de référence différente de la date de saisie (date antidatée)
  for (const historyItem of reversedHistory) {
    for (const fieldName of Object.keys(historyItem.data)) {
      if (forbiddenPersonFieldsInHistory.includes(fieldName)) continue;
      // Certains champs sont fixes dans le temps et donc ignorés. Il s'agit des champs "genre" et "date de naissance" qu'on considère (arbitrairement) comme fixes.
      // Cela permet de gérer le cas où une personne n'avait pas de date de naissance et qu'on la renseigne plus tard.
      // On veut dans ce cas la voir apparaitre dans les stats.
      if (fixedInTimeFields.includes(fieldName)) continue;
      if (onlyForFieldName && fieldName !== onlyForFieldName) continue; // we support only one indicator for now
      if (!typesByFields[fieldName]) continue; // this is a deleted custom field

      // Déterminer la date de référence pour ce champ
      // Pour les champs de sortie de file active, on utilise la date indiquée si disponible
      const referenceDate = getReferenceDateForHistoryItem(historyItem, fieldName);
      const historyDate = dayjsInstance(referenceDate).format("YYYY-MM-DD");

      // Si la modification est avant ou le jour même du snapshot, on garde la valeur actuelle du snapshot
      if (historyDate <= snapshotDate) {
        continue;
      }

      // Sinon, on remet l'ancienne valeur
      const oldValue = replaceNullishWithNonRenseigne
        ? getValueByField(fieldName, typesByFields[fieldName], historyItem.data[fieldName].oldValue)
        : historyItem.data[fieldName].oldValue;
      /* DEBUG PART */
      // const historyNewValue = replaceNullishWithNonRenseigne
      //   ? getValueByField(fieldName, typesByFields[fieldName], historyItem.data[fieldName].newValue)
      //   : historyItem.data[fieldName].newValue;
      // const currentPersonValue = replaceNullishWithNonRenseigne
      //   ? getValueByField(fieldName, typesByFields[fieldName], snapshot[fieldName])
      //   : snapshot[fieldName];
      /* if (JSON.stringify(historyNewValue) !== JSON.stringify(currentPersonValue)) {
        capture(new Error("Incoherent snapshot history 4"), {
          extra: {
            historyItem,
            fieldName,
            oldValue,
            historyNewValue,
            currentPersonValue,
            snapshotDate,
            stringifiedHistoryNewValue: JSON.stringify(historyNewValue),
            stringifiedCurrentPersonValue: JSON.stringify(currentPersonValue),
            // person: process.env.NODE_ENV === "development" ? person : undefined,
            // snapshot: process.env.NODE_ENV === "development" ? snapshot : undefined,
          },
          tags: {
            personId: person._id,
            fieldName,
          },
        });
      } */
      /* DEBUG PART END */
      if (oldValue === "") continue;
      snapshot = {
        ...snapshot,
        [fieldName]: oldValue,
      };
    }
  }
  return snapshot;
}
