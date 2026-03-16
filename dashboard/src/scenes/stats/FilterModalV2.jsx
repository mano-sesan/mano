import { useState, useEffect } from "react";
import { components } from "react-select";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../../components/tailwind/Modal";
import SelectCustom from "../../components/SelectCustom";
import DatePicker from "../../components/DatePicker";

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
  if (current.field === "outOfActiveList") {
    // V2: only "Oui" and "Non", no more "Oui et non"
    return ["Oui", "Non"];
  }
  if (current.field === "outOfTeamsDuringPeriod") return current.options;
  if (current.options?.length) return [...(current.options || []), "Non renseigné"];
  return ["Non renseigné"];
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

export default function FilterModalV2({ open, onClose, filterBase, onAddFilter, editingFilter, onEditFilter, filterLabel = "" }) {
  const [selectedField, setSelectedField] = useState(null);
  const [filterValue, setFilterValue] = useState(null);
  const [comparator, setComparator] = useState(null);

  const isEditing = editingFilter != null;

  const filterFields = filterBase
    .filter((_filter) => _filter.field !== "alertness")
    .map((f) => ({ label: f.label, field: f.field, type: f.type, category: f.category }));

  // Pre-fill when editing
  useEffect(() => {
    if (open && editingFilter) {
      const field = filterFields.find((f) => f.field === editingFilter.field && (f.category || "") === (editingFilter.category || ""));
      setSelectedField(field || null);
      setFilterValue(editingFilter.value ?? null);
      if (typeof editingFilter.value === "object" && editingFilter.value?.comparator) {
        setComparator(editingFilter.value.comparator);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filterOptions = selectedField ? getFilterOptionsByField(selectedField.field, filterBase) : [];

  const resetState = () => {
    setSelectedField(null);
    setFilterValue(null);
    setComparator(null);
  };

  const handleSubmit = () => {
    if (!selectedField || filterValue == null) return;
    const filter = {
      field: selectedField.field,
      value: filterValue,
      type: selectedField.type,
      category: selectedField.category,
    };
    if (isEditing) {
      onEditFilter(filter);
    } else {
      onAddFilter(filter);
    }
    onClose();
  };

  const hasValue = (() => {
    if (filterValue == null || filterValue === "") return false;
    if (Array.isArray(filterValue)) return filterValue.length > 0;
    // For date filters: must have comparator, and if not "unfilled" must also have a date
    if (typeof filterValue === "object" && "comparator" in filterValue && "date" in filterValue) {
      if (!filterValue.comparator) return false;
      if (filterValue.comparator !== "unfilled" && !filterValue.date) return false;
      return true;
    }
    // For number filters: must have comparator, and if not "unfilled" must also have a number
    if (typeof filterValue === "object" && "comparator" in filterValue) {
      if (!filterValue.comparator) return false;
      if (filterValue.comparator === "unfilled") return true;
      if (filterValue.comparator === "between")
        return filterValue.number !== "" && filterValue.number != null && filterValue.number2 !== "" && filterValue.number2 != null;
      return filterValue.number !== "" && filterValue.number != null;
    }
    return true;
  })();

  return (
    <ModalContainer open={open} onClose={onClose} onAfterLeave={resetState} size="lg">
      <ModalHeader title={isEditing ? "Modifier le filtre" : `Ajouter un filtre ${filterLabel}`.trim()} />
      <ModalBody className="tw-py-4 tw-px-6">
        <div className="tw-flex tw-flex-col tw-gap-4">
          <div>
            <label className="tw-block tw-text-sm tw-font-medium tw-text-zinc-700 tw-mb-1">Champ</label>
            <SelectCustom
              options={filterFields}
              value={selectedField}
              onChange={(newField) => {
                setSelectedField(newField);
                setFilterValue(null);
                setComparator(null);
              }}
              formatOptionLabel={(_option) => {
                const current = filterFields.find((_filter) => _filter.field === _option.field && _filter.category === _option.category);
                if (!current) return "";
                if (current.category) {
                  return (
                    <>
                      <span className="tw-text-sm">{current.label}</span>
                      <span className="tw-ml-2 tw-text-gray-500 tw-text-xs">{categoryToLabel(current.category)}</span>
                    </>
                  );
                }
                return <span className="tw-text-sm">{current.label}</span>;
              }}
              isSearchable
              getOptionValue={(_option) => `${_option.field}-${_option.category || ""}`}
              isClearable
              isMulti={false}
              inputId="filter-modal-field"
              classNamePrefix="filter-modal-field"
              className="tw-text-sm"
            />
          </div>
          {selectedField && (
            <div>
              <label className="tw-block tw-text-sm tw-font-medium tw-text-zinc-700 tw-mb-1">Valeur</label>
              <ModalValueSelector
                field={selectedField}
                filterOptions={filterOptions}
                value={filterValue}
                onChange={setFilterValue}
                comparator={comparator}
                setComparator={setComparator}
              />
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="button-cancel" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="button-submit" onClick={handleSubmit} disabled={!hasValue}>
          {isEditing ? "Modifier" : "Ajouter"}
        </button>
      </ModalFooter>
    </ModalContainer>
  );
}

function ModalValueSelector({ field, filterOptions, value, onChange, comparator, setComparator }) {
  if (!field) return null;
  const { type, field: name } = field;

  if (["text", "textarea"].includes(type)) {
    return (
      <input
        name={name}
        className="tailwindui !tw-mt-0 tw-w-full"
        type="text"
        value={value || ""}
        onChange={(e) => {
          e.preventDefault();
          onChange(e.target.value);
        }}
        placeholder="Saisir une valeur..."
      />
    );
  }

  if (["date-with-time", "date", "duration"].includes(type)) {
    return (
      <div className="tw-flex tw-flex-col tw-gap-2">
        <SelectCustom
          options={dateOptions}
          value={dateOptions.find((opt) => opt.value === value?.comparator)}
          isClearable={!value}
          onChange={(e) => {
            if (!e) {
              setComparator(null);
              onChange(null);
              return;
            }
            setComparator(e.value);
            onChange({ date: value?.date, comparator: e.value });
          }}
          formatOptionLabel={(option) => <span className="tw-text-sm">{option.label}</span>}
          className="tw-text-sm"
        />
        {value?.comparator !== "unfilled" && value?.comparator && (
          <DatePicker
            id={name}
            defaultValue={value?.date ? new Date(value.date) : null}
            onChange={(date) => onChange({ date: date.target.value, comparator })}
          />
        )}
      </div>
    );
  }

  if (["number"].includes(type)) {
    return (
      <div className="tw-flex tw-flex-col tw-gap-2">
        <SelectCustom
          options={numberOptions}
          value={numberOptions.find((opt) => opt.value === value?.comparator)}
          isClearable={!value}
          onChange={(e) => {
            if (!e) {
              setComparator(null);
              onChange(null);
              return;
            }
            setComparator(e.value);
            onChange({ number: value?.number, comparator: e.value });
          }}
          formatOptionLabel={(option) => <span className="tw-text-sm">{option.label}</span>}
          className="tw-text-sm"
        />
        {value?.comparator !== "unfilled" && value?.comparator && (
          <div className="tw-flex tw-items-center tw-gap-2">
            <input
              name={name}
              className="tailwindui !tw-mt-0"
              type="number"
              min="0"
              value={value?.number || ""}
              onChange={(e) => {
                onChange({ number: e.target.value, number2: value?.number2, comparator });
              }}
            />
            {value?.comparator === "between" && (
              <>
                <span>et</span>
                <input
                  name={name}
                  className="tailwindui !tw-mt-0"
                  type="number"
                  min="0"
                  value={value?.number2 || ""}
                  onChange={(e) => {
                    onChange({ number2: e.target.value, number: value?.number, comparator });
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  if (["enum", "multi-choice"].includes(type) && name !== "outOfActiveList") {
    return (
      <SelectCustom
        options={filterOptions.map((_value) => ({ label: _value, value: _value }))}
        value={value?.map?.((_value) => ({ label: _value, value: _value })) || []}
        getOptionLabel={(f) => f.label}
        getOptionValue={(f) => f.value}
        onChange={(newValue) => onChange((Array.isArray(newValue) ? newValue : []).map((option) => option.value))}
        isClearable={Boolean(value?.length)}
        isMulti
        inputId="filter-modal-value"
        classNamePrefix="filter-modal-value"
        className="tw-text-sm"
        formatOptionLabel={(option) => <span className="tw-text-sm">{option.label}</span>}
        components={{
          MultiValueContainer: (props) => {
            if (props.selectProps?.value?.length <= 1) return <components.MultiValueContainer {...props} />;
            const lastValue = props.selectProps?.value?.[props.selectProps?.value?.length - 1]?.value;
            const isLastValue = props?.data?.value === lastValue;
            return (
              <>
                <components.MultiValueLabel {...props} />
                {!isLastValue && <span className="tw-ml-1 tw-mr-2 tw-inline-block">OU</span>}
              </>
            );
          },
        }}
      />
    );
  }

  // Default: single select (boolean, outOfActiveList, etc.)
  return (
    <SelectCustom
      options={filterOptions.map((_value) => ({ label: _value, value: _value }))}
      value={value ? { label: value, value } : null}
      getOptionLabel={(f) => f.label}
      getOptionValue={(f) => f.value}
      onChange={(f) => onChange(f?.value ?? null)}
      isClearable={Boolean(value)}
      inputId="filter-modal-value"
      classNamePrefix="filter-modal-value"
      className="tw-text-sm"
      formatOptionLabel={(option) => <span className="tw-text-sm">{option.label}</span>}
    />
  );
}
