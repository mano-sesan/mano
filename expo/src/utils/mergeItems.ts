export default function mergeItems<T extends { _id?: string; deletedAt?: any }>(
  oldItems: T[],
  newItems: T[] = [],
  { formatNewItemsFunction, filterNewItemsFunction }: { formatNewItemsFunction?: (item: T) => T; filterNewItemsFunction?: (item: T) => boolean } = {}
) {
  const newItemsCleanedAndFormatted: T[] = [];
  const newItemIds: Record<string, boolean> = {};

  for (const newItem of newItems) {
    newItemIds[newItem._id!] = true;
    if (newItem.deletedAt) continue;
    if (filterNewItemsFunction) {
      if (!filterNewItemsFunction(newItem)) continue;
    }
    if (formatNewItemsFunction) {
      newItemsCleanedAndFormatted.push(formatNewItemsFunction(newItem));
    } else {
      newItemsCleanedAndFormatted.push(newItem);
    }
  }

  const oldItemsPurged: T[] = [];
  for (const oldItem of oldItems) {
    if (oldItem.deletedAt) continue;
    if (!newItemIds[oldItem._id!]) {
      oldItemsPurged.push(oldItem);
    }
  }

  return [...oldItemsPurged, ...newItemsCleanedAndFormatted];
}
