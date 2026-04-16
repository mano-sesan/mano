interface ActionWithCategories {
  categories?: string[];
}

interface CategoryFilter {
  field: string;
  value: string | string[];
}

export interface CategoryMatchState {
  filter: CategoryFilter;
  vals: string[];
  isNonRenseigne: boolean;
  matched: boolean;
}

export function createCategoryMatchStates(filters: CategoryFilter[]): CategoryMatchState[] {
  return filters.map((filter) => {
    const vals = Array.isArray(filter.value) ? filter.value : [filter.value];
    const isNonRenseigne = vals.length === 1 && vals[0] === "Non renseigné";
    // "Non renseigné" est satisfait par défaut et invalidé dès qu'une action a une catégorie
    return { filter, vals, isNonRenseigne, matched: isNonRenseigne };
  });
}

export function accumulateActionForCategoryStates(states: CategoryMatchState[], action: ActionWithCategories): void {
  for (const s of states) {
    if (s.isNonRenseigne) {
      if (action.categories?.length) s.matched = false;
      continue;
    }
    if (s.matched) continue;
    if (s.filter.field === "actionCategoriesCombined") {
      // AND: une action a toutes les catégories sélectionnées
      if (action.categories?.length && s.vals.every((c) => action.categories!.includes(c))) s.matched = true;
    } else {
      // OR: une action a au moins une des catégories sélectionnées
      if (action.categories?.some((c) => s.vals.includes(c))) s.matched = true;
    }
  }
}

export function allCategoryStatesMatched(states: CategoryMatchState[]): boolean {
  return states.every((s) => s.matched);
}
