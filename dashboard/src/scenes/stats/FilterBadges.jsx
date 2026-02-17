import { useState } from "react";
import { XMarkIcon, PlusIcon } from "@heroicons/react/24/outline";
import SelectCustom from "../../components/SelectCustom";
import DatePicker from "../../components/DatePicker";
import { dayjsInstance } from "../../services/date";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../../components/tailwind/Modal";

function categoryToLabel(category) {
  if (category === "medicalFile") return "Dossier médical";
  if (category === "flattenedConsultations") return "Consultation";
  return category;
}

function getFilterOptionsByField(fieldName, base) {
  if (!fieldName) return [];
  const current = base.find((filter) => filter.field === fieldName);
  if (!current) return [];
  if (["yes-no"].includes(current.type)) return ["Oui", "Non", "Non renseigné"];
  if (["boolean"].includes(current.type)) return ["Oui", "Non"];
  if (current?.field === "outOfActiveList") return current.options;
  if (current?.field === "outOfTeamsDuringPeriod") return current.options;
  if (current?.options?.length) return [...(current?.options || []), "Non renseigné"];
  return ["Non renseigné"];
}

function getFilterValueLabel(filterValue) {
  if (Array.isArray(filterValue)) return filterValue.join(", ");
  if (typeof filterValue === "object" && filterValue !== null) {
    if (filterValue?.date != null) {
      if (filterValue.comparator === "unfilled") return "Non renseigné";
      if (filterValue.comparator === "before") return `Avant le ${dayjsInstance(filterValue.date).format("DD/MM/YYYY")}`;
      if (filterValue.comparator === "after") return `Après le ${dayjsInstance(filterValue.date).format("DD/MM/YYYY")}`;
      if (filterValue.comparator === "equals") return `Le ${dayjsInstance(filterValue.date).format("DD/MM/YYYY")}`;
      return "";
    }
    if (filterValue?.number != null) {
      if (filterValue.comparator === "unfilled") return "Non renseigné";
      if (filterValue.comparator === "between") return `Entre ${filterValue.number} et ${filterValue.number2}`;
      if (filterValue.comparator === "equals") return `Égal à ${filterValue.number}`;
      if (filterValue.comparator === "lower") return `Inférieur à ${filterValue.number}`;
      if (filterValue.comparator === "greater") return `Supérieur à ${filterValue.number}`;
    }
    return "";
  }
  return filterValue;
}

const dateOptions = [
  { label: "Avant", value: "before" },
  { label: "Après", value: "after" },
  { label: "Date exacte", value: "equals" },
  { label: "Non renseigné", value: "unfilled" },
];

const numberOptions = [
  { label: "Inférieur à", value: "lower" },
  { label: "Supérieur à", value: "greater" },
  { label: "Égal à", value: "equals" },
  { label: "Entre", value: "between" },
  { label: "Non renseigné", value: "unfilled" },
];

const ValueSelector = ({ field, base, value, onChangeValue }) => {
  const [comparator, setComparator] = useState(value?.comparator || null);
  const current = base.find((filter) => filter.field === field);
  if (!current) return null;
  const { type, field: name } = current;
  const filterValues = getFilterOptionsByField(field, base);

  if (["text", "textarea"].includes(type)) {
    return (
      <input
        name={name}
        className="tailwindui !tw-mt-0"
        type="text"
        placeholder="Valeur..."
        autoFocus
        value={value || ""}
        onChange={(e) => onChangeValue(e.target.value)}
      />
    );
  }

  if (["date-with-time", "date", "duration"].includes(type)) {
    return (
      <div className="tw-flex tw-items-center tw-gap-2">
        <div className="tw-w-40">
          <SelectCustom
            options={dateOptions}
            value={dateOptions.find((opt) => opt.value === value?.comparator)}
            isClearable={false}
            onChange={(e) => {
              if (!e) return;
              setComparator(e.value);
              onChangeValue({ date: value?.date, comparator: e.value });
            }}
          />
        </div>
        {value?.comparator !== "unfilled" && (
          <div className="tw-w-40">
            <DatePicker id={name} defaultValue={value?.date ? new Date(value?.date) : null} onChange={(date) => onChangeValue({ date: date.target.value, comparator })} />
          </div>
        )}
      </div>
    );
  }

  if (["number"].includes(type)) {
    return (
      <div className="tw-flex tw-items-center tw-gap-2">
        <div className="tw-w-40">
          <SelectCustom
            options={numberOptions}
            value={numberOptions.find((opt) => opt.value === value?.comparator)}
            isClearable={false}
            onChange={(e) => {
              if (!e) return;
              setComparator(e.value);
              onChangeValue({ number: value?.number, comparator: e.value });
            }}
          />
        </div>
        {value?.comparator !== "unfilled" && (
          <input name={name} className="tailwindui !tw-mt-0 tw-w-24" type="number" min="0" value={value?.number || ""} onChange={(e) => onChangeValue({ number: e.target.value, number2: value?.number2, comparator })} />
        )}
        {value?.comparator === "between" && (
          <>
            <span>et</span>
            <input name={name} className="tailwindui !tw-mt-0 tw-w-24" type="number" min="0" value={value?.number2 || ""} onChange={(e) => onChangeValue({ number2: e.target.value, number: value?.number, comparator })} />
          </>
        )}
      </div>
    );
  }

  if (["enum", "multi-choice"].includes(type) && name !== "outOfActiveList") {
    return (
      <SelectCustom
        options={filterValues.map((_value) => ({ label: _value, value: _value }))}
        value={value?.map?.((v) => ({ label: v, value: v })) || []}
        getOptionLabel={(f) => f.label}
        getOptionValue={(f) => f.value}
        onChange={(newValue) => onChangeValue((Array.isArray(newValue) ? newValue : []).map((option) => option.value))}
        isClearable={Boolean(value?.length)}
        isMulti
      />
    );
  }

  // Default: single select (yes-no, outOfActiveList, etc.)
  return (
    <SelectCustom
      options={filterValues.map((_value) => ({ label: _value, value: _value }))}
      value={value ? { label: value, value } : null}
      getOptionLabel={(f) => f.label}
      getOptionValue={(f) => f.value}
      onChange={(f) => onChangeValue(f?.value ?? null)}
      isClearable={Boolean(value)}
    />
  );
};

const AddFilterModal = ({ open, onClose, base, onAdd }) => {
  const [selectedField, setSelectedField] = useState(null);
  const [value, setValue] = useState(null);

  const filterFields = base
    .filter((f) => f.field !== "alertness")
    .map((f) => ({ label: f.label, field: f.field, type: f.type, category: f.category }));

  const handleClose = () => {
    setSelectedField(null);
    setValue(null);
    onClose();
  };

  const isValid =
    !!selectedField &&
    (() => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string") return value !== "";
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return !!value.comparator;
      return true;
    })();

  const handleAdd = () => {
    if (!isValid) return;
    onAdd(selectedField, value);
    handleClose();
  };

  return (
    <ModalContainer open={open} size="lg" onClose={handleClose}>
      <ModalHeader title="Ajouter un filtre" onClose={handleClose} />
      <ModalBody>
        <div className="tw-px-4 tw-py-4 sm:tw-px-6 tw-flex tw-flex-col tw-gap-4">
          <div>
            <label className="tw-text-sm tw-font-medium tw-text-zinc-700 tw-mb-1 tw-block">Champ</label>
            <SelectCustom
              options={filterFields}
              value={selectedField}
              onChange={(selected) => {
                setSelectedField(selected);
                setValue(null);
              }}
              formatOptionLabel={(_option) => {
                if (_option.category) {
                  return (
                    <>
                      {_option.label}
                      <span className="tw-ml-2 tw-text-gray-500 tw-text-xs">{categoryToLabel(_option.category)}</span>
                    </>
                  );
                }
                return _option.label;
              }}
              isSearchable
              getOptionValue={(_option) => `${_option.field}-${_option.category || ""}`}
              isClearable
              isMulti={false}
              placeholder="Rechercher un champ..."
              autoFocus
            />
          </div>
          {selectedField && (
            <div>
              <label className="tw-text-sm tw-font-medium tw-text-zinc-700 tw-mb-1 tw-block">Valeur</label>
              <ValueSelector key={selectedField.field} field={selectedField.field} base={base} value={value} onChangeValue={setValue} />
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="button-cancel" onClick={handleClose}>
          Annuler
        </button>
        <button type="button" className="button-submit" disabled={!isValid} onClick={handleAdd}>
          Ajouter
        </button>
      </ModalFooter>
    </ModalContainer>
  );
};

const FilterBadges = ({ base, filters, onChange }) => {
  const [modalOpen, setModalOpen] = useState(false);

  const filtersWithValue = filters.filter((f) => f.field && f.value);

  const onRemoveFilter = (filterToRemove) => {
    onChange(filters.filter((f) => f !== filterToRemove));
  };

  const onAddFilter = (field, value) => {
    const fieldDef = base.find((f) => f.field === field.field && f.category === field.category);
    if (!fieldDef) return;
    onChange([...filters, { field: field.field, value, type: fieldDef.type, category: field.category }]);
  };

  return (
    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
      {/* Print-only list */}
      <div className="printonly tw-flex tw-gap-2">
        <ul>
          {filtersWithValue.map((filter, index) => {
            const current = base.find((f) => f.field === filter.field);
            if (!current) return null;
            const valueLabel = getFilterValueLabel(filter.value);
            if (!valueLabel) return null;
            return (
              <li key={index} className="tw-list-disc">
                {current.label}: {valueLabel}
              </li>
            );
          })}
        </ul>
      </div>
      {/* Screen badges */}
      <div className="noprint tw-flex tw-flex-wrap tw-items-center tw-gap-2">
        {filtersWithValue.map((filter, index) => {
          const current = base.find((f) => f.field === filter.field);
          if (!current) return null;
          const valueLabel = getFilterValueLabel(filter.value);
          if (!valueLabel) return null;
          return (
            <span key={`${filter.field}-${index}`} className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-md tw-bg-main/10 tw-text-main tw-text-sm tw-pl-3 tw-pr-1.5 tw-py-1">
              <span className="tw-text-main/60">
                {current.label}
                {current.category ? ` (${categoryToLabel(current.category)})` : ""} :
              </span>
              <span className="tw-font-medium">{valueLabel}</span>
              <button
                type="button"
                className="tw-ml-0.5 tw-rounded hover:tw-bg-main/20 tw-p-0.5 tw-cursor-pointer tw-transition-colors"
                aria-label={`Supprimer le filtre ${current.label}`}
                onClick={() => onRemoveFilter(filter)}
              >
                <XMarkIcon className="tw-w-3.5 tw-h-3.5" />
              </button>
            </span>
          );
        })}
        <button
          type="button"
          className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-md tw-border tw-border-dashed tw-border-zinc-300 tw-text-zinc-500 tw-text-sm tw-px-3 tw-py-1 hover:tw-border-zinc-400 hover:tw-text-zinc-700 tw-cursor-pointer tw-transition-colors"
          onClick={() => setModalOpen(true)}
        >
          <PlusIcon className="tw-w-3.5 tw-h-3.5" />
          Ajouter un filtre
        </button>
      </div>
      <AddFilterModal open={modalOpen} onClose={() => setModalOpen(false)} base={base} onAdd={onAddFilter} />
    </div>
  );
};

export default FilterBadges;
