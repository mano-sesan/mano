import { XMarkIcon, PlusIcon } from "@heroicons/react/24/outline";

function getFilterDisplayValue(filter) {
  if (!filter.value) return null;
  if (typeof filter.value === "object" && !Array.isArray(filter.value)) {
    if (filter.value.comparator === "unfilled") return "Non renseigné";
    if (filter.value?.date != null) {
      if (filter.value.comparator === "before") return `Avant le ${new Date(filter.value.date).toLocaleDateString("fr-FR")}`;
      if (filter.value.comparator === "after") return `Après le ${new Date(filter.value.date).toLocaleDateString("fr-FR")}`;
      if (filter.value.comparator === "equals") return `Le ${new Date(filter.value.date).toLocaleDateString("fr-FR")}`;
    }
    if (filter.value?.number != null) {
      if (filter.value.comparator === "between") return `Entre ${filter.value.number} et ${filter.value.number2}`;
      if (filter.value.comparator === "equals") return `= ${filter.value.number}`;
      if (filter.value.comparator === "lower") return `< ${filter.value.number}`;
      if (filter.value.comparator === "greater") return `> ${filter.value.number}`;
    }
    // Incomplete filter (e.g. comparator without value) - still show it so user can remove it
    return "(filtre incomplet)";
  }
  if (Array.isArray(filter.value)) {
    if (filter.value.length === 0) return null;
    return filter.value.join(", ");
  }
  return String(filter.value);
}

export default function FilterChipsV2({ filters, setFilters, filterBase, disabled, onAddFilter }) {
  const activeFilters = filters.filter((f) => f.field && f.value);

  const removeFilter = (index) => {
    const realIndex = filters.findIndex((f) => f === activeFilters[index]);
    if (realIndex !== -1) {
      setFilters(filters.filter((_, i) => i !== realIndex));
    }
  };

  return (
    <div className={["tw-flex tw-flex-wrap tw-items-center tw-gap-2", disabled ? "tw-opacity-40 tw-pointer-events-none" : ""].join(" ")}>
      {activeFilters.map((filter, index) => {
        const fieldDef = filterBase.find((f) => f.field === filter.field);
        const label = fieldDef?.label || filter.field;
        const displayValue = getFilterDisplayValue(filter);
        if (!displayValue) return null;
        return (
          <span
            key={`${filter.field}-${index}`}
            className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-md tw-bg-main/10 tw-text-main tw-text-sm tw-pl-3 tw-pr-1.5 tw-py-1"
          >
            <span className="tw-text-main/60">{label} :</span>
            <span className="tw-font-medium tw-max-w-48 tw-truncate">{displayValue}</span>
            <button
              type="button"
              onClick={() => removeFilter(index)}
              className="tw-ml-0.5 tw-rounded hover:tw-bg-main/20 tw-p-0.5 tw-cursor-pointer tw-transition-colors"
            >
              <XMarkIcon className="tw-w-3.5 tw-h-3.5" />
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={onAddFilter}
        className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-md tw-border tw-border-dashed tw-border-zinc-300 tw-text-zinc-500 tw-text-sm tw-px-3 tw-py-1 hover:tw-border-zinc-400 hover:tw-text-zinc-700 tw-cursor-pointer tw-transition-colors"
      >
        <PlusIcon className="tw-w-3.5 tw-h-3.5" />
        Ajouter un filtre
      </button>
    </div>
  );
}
