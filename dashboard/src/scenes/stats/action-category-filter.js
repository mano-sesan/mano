/**
 * Check if a person's actions (already filtered by period/team) match a category filter.
 *
 * @param {Array} actionsInPeriod - actions that passed the date/team filter
 * @param {object} filter - the filter object ({ field, value })
 * @returns {boolean} true if the person matches the filter
 */
export function matchesActionCategoryFilter(actionsInPeriod, filter) {
  const selectedCategories = Array.isArray(filter.value) ? filter.value : [filter.value];
  if (!selectedCategories.length) return true;

  if (selectedCategories.length === 1 && selectedCategories[0] === "Non renseigné") {
    return !actionsInPeriod.some((a) => a.categories?.length);
  }

  if (filter.field === "actionCategoriesCombined") {
    // AND: at least one action has ALL selected categories
    return actionsInPeriod.some((a) => a.categories?.length && selectedCategories.every((c) => a.categories.includes(c)));
  }
  // OR: at least one action has one of the selected categories
  return actionsInPeriod.some((a) => a.categories?.some((c) => selectedCategories.includes(c)));
}
