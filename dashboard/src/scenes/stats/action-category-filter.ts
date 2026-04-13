interface ActionWithCategories {
  categories?: string[];
}

interface CategoryFilter {
  field: string;
  value: string | string[];
}

export function matchesActionCategoryFilter(actionsInPeriod: ActionWithCategories[], filter: CategoryFilter): boolean {
  const selectedCategories = Array.isArray(filter.value) ? filter.value : [filter.value];
  if (!selectedCategories.length) return true;

  if (selectedCategories.length === 1 && selectedCategories[0] === "Non renseigné") {
    return !actionsInPeriod.some((a) => a.categories?.length);
  }

  if (filter.field === "actionCategoriesCombined") {
    // AND: at least one action has ALL selected categories
    return actionsInPeriod.some((a) => a.categories?.length && selectedCategories.every((c) => a.categories!.includes(c)));
  }
  // OR: at least one action has one of the selected categories
  return actionsInPeriod.some((a) => a.categories?.some((c) => selectedCategories.includes(c)));
}
