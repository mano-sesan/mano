import { PersonPopulated } from "@/types/person";
import { Filter, FilterableField } from "@/types/field";
import { dayjsInstance } from "@/services/dateDayjs";

/**
 * Filters a single person according to the provided filters.
 * All filters must be satisfied (AND logic) for the person to pass.
 * For multi-value filters (enum, multi-choice), at least one value must match (OR logic).
 * Special case: actionCategoriesCombined uses AND logic for categories.
 *
 * @param person - The person to filter
 * @param filters - Array of filters to apply
 * @returns The person if it passes all filters, null otherwise
 */
export function filterPerson(person: PersonPopulated, filters: Array<Filter>): PersonPopulated | null {
  // If no filters are active, the person passes
  const activeFilters = filters.filter((f) => Boolean(f?.value));
  if (!activeFilters.length) return person;

  // Check each filter
  for (const filter of activeFilters) {
    if (!filter.field || !filter.value) continue;

    // Get the item value (support for nested fields via category)
    const itemValue = filter.category && person[filter.category] ? person[filter.category][filter.field] : person[filter.field];

    // Handle number fields
    if (filter.type && ["number"].includes(filter.type)) {
      const { number, number2, comparator } = filter.value;

      // Handle unfilled case first
      if (comparator === "unfilled") {
        if (itemValue !== null && itemValue !== undefined) return null;
        continue;
      }

      // Handle null/undefined values for all other comparators
      if (itemValue === null || itemValue === undefined) return null;

      const itemNumber = Number(itemValue);
      // Check if it's a valid number after conversion
      if (Number.isNaN(itemNumber)) return null;

      if (comparator === "between") {
        if (Number(number) < Number(number2)) {
          if (Number(itemNumber) >= Number(number) && Number(itemNumber) <= Number(number2)) continue;
          return null;
        } else {
          if (Number(itemNumber) >= Number(number2) && Number(itemNumber) <= Number(number)) continue;
          return null;
        }
      }
      if (comparator === "equals") {
        if (Number(itemNumber) === Number(number)) continue;
        return null;
      }
      if (comparator === "lower") {
        if (Number(itemNumber) < Number(number)) continue;
        return null;
      }
      if (comparator === "greater") {
        if (Number(itemNumber) > Number(number)) continue;
        return null;
      }
    }

    // Handle boolean fields
    if (filter.type && ["boolean"].includes(filter.type)) {
      if (filter.value === "Oui" && !!itemValue) continue;
      if (filter.value === "Non" && !itemValue) continue;
      return null;
    }

    // Handle date fields
    if (filter.type && ["date-with-time", "date", "duration"].includes(filter.type)) {
      const { date, comparator } = filter.value;
      if (comparator === "unfilled") {
        if (!itemValue) continue;
        return null;
      }
      if (!itemValue) return null;
      if (comparator === "before") {
        if (dayjsInstance(itemValue).isBefore(date)) continue;
        return null;
      }
      if (comparator === "after") {
        if (dayjsInstance(itemValue).isAfter(date)) continue;
        return null;
      }
      if (comparator === "equals") {
        if (dayjsInstance(itemValue).isSame(date, "day")) continue;
        return null;
      }
    }

    // Handle boolean values (can be true/false or "Oui"/"Non")
    if (typeof itemValue === "boolean") {
      if (!itemValue) {
        if (filter.value === "Non renseigné") continue;
        return null;
      }
      if (itemValue === (filter.value === "Oui")) continue;
      return null;
    }

    // For all other types (enum, multi-choice, text, textarea, yes-no)
    const arrayFilterValue = Array.isArray(filter.value) ? filter.value : [filter.value];
    if (!arrayFilterValue.length) continue;

    // Special handling for "actionCategoriesCombined" filter
    // This filter checks if a person has at least one action that contains ALL selected categories
    if (filter.field === "actionCategoriesCombined") {
      const actions = person.actions as Array<{ categories?: string[] }> | undefined;
      // Handle "Non renseigné" case
      if (arrayFilterValue.length === 1 && arrayFilterValue[0] === "Non renseigné") {
        const hasAnyCategories = actions?.some((action) => action.categories?.length);
        if (!hasAnyCategories) continue;
        return null;
      }
      // Check if any action has ALL the selected categories
      const hasMatchingAction = actions?.some(
        (action) => action.categories?.length && arrayFilterValue.every((selectedCategory) => (action.categories ?? []).includes(selectedCategory))
      );
      if (!hasMatchingAction) return null;
      continue;
    }

    // For other fields, at least one filter value must match (OR logic)
    let isSelected = false;
    for (const filterValue of arrayFilterValue) {
      // Handle "Non renseigné" case
      if (filterValue === "Non renseigné") {
        // For strings, check if empty or undefined/null
        if (typeof itemValue === "string") {
          if (!itemValue || itemValue.trim() === "") {
            isSelected = true;
            break;
          }
        } else if (!itemValue?.length) {
          // For arrays, check if empty or undefined/null
          isSelected = true;
          break;
        }
      } else if (typeof itemValue === "string") {
        // For type text we trim and lower case the value.
        if (filter.type && ["text", "textarea"].includes(filter.type)) {
          const trimmedItemValue = (itemValue || "").trim().toLowerCase();
          const trimmedFilterValue = (filterValue || "").trim().toLowerCase();
          if (trimmedItemValue.includes(trimmedFilterValue)) {
            isSelected = true;
            break;
          }
        }
        if (itemValue === filterValue) {
          isSelected = true;
          break;
        }
      } else {
        if (itemValue?.includes?.(filterValue)) {
          isSelected = true;
        }
      }
    }
    if (!isSelected) return null;
  }

  return person;
}

/**
 * Filters an array of persons according to the provided filters.
 *
 * @param persons - Array of persons to filter
 * @param filters - Array of filters to apply
 * @returns Filtered array of persons
 */
export function filterPersons(persons: PersonPopulated[], filters: Array<Filter>): PersonPopulated[] {
  return persons.map((person) => filterPerson(person, filters)).filter(Boolean) as PersonPopulated[];
}

/**
 * Formats a filter into a human-readable label for display in tags.
 *
 * @param filter - The filter to format
 * @param availableFields - Array of available filterable fields
 * @returns Formatted label string
 */
export function formatFilterLabel(filter: Filter, availableFields: Array<FilterableField>): string {
  if (!filter.field || !filter.value) return "";

  const field = availableFields.find((f) => f.field === filter.field);
  if (!field) return "";

  const fieldLabel = field.label;

  // Handle date filters
  if (filter.type && ["date-with-time", "date", "duration"].includes(filter.type)) {
    if (filter.value.comparator === "unfilled") return `${fieldLabel}: Non renseigné`;
    if (filter.value.comparator === "before") return `${fieldLabel}: Avant le ${dayjsInstance(filter.value.date).format("DD/MM/YYYY")}`;
    if (filter.value.comparator === "after") return `${fieldLabel}: Après le ${dayjsInstance(filter.value.date).format("DD/MM/YYYY")}`;
    if (filter.value.comparator === "equals") return `${fieldLabel}: Le ${dayjsInstance(filter.value.date).format("DD/MM/YYYY")}`;
    return `${fieldLabel}: ${filter.value}`;
  }

  // Handle number filters
  if (filter.type && ["number"].includes(filter.type)) {
    if (filter.value.comparator === "unfilled") return `${fieldLabel}: Non renseigné`;
    if (filter.value.comparator === "between") return `${fieldLabel}: Entre ${filter.value.number} et ${filter.value.number2}`;
    if (filter.value.comparator === "equals") return `${fieldLabel}: Égal à ${filter.value.number}`;
    if (filter.value.comparator === "lower") return `${fieldLabel}: < ${filter.value.number}`;
    if (filter.value.comparator === "greater") return `${fieldLabel}: > ${filter.value.number}`;
    return `${fieldLabel}: ${filter.value}`;
  }

  // Handle multi-value filters (arrays)
  if (Array.isArray(filter.value)) {
    if (filter.value.length === 0) {
      return `${fieldLabel}: Aucune sélection`;
    }
    if (filter.value.length === 1) {
      return `${fieldLabel}: ${filter.value[0]}`;
    }
    // For actionCategoriesCombined, show "ET" between values
    const separator = filter.field === "actionCategoriesCombined" ? " ET " : ", ";
    // Limit display to first 2 values + count if more
    if (filter.value.length > 3) {
      const firstValues = filter.value.slice(0, 2).join(separator);
      return `${fieldLabel}: ${firstValues}... (+${filter.value.length - 2})`;
    }
    return `${fieldLabel}: ${filter.value.join(separator)}`;
  }

  // Simple value filters
  return `${fieldLabel}: ${filter.value}`;
}
