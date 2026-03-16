import { useState, useEffect } from "react";
import { components } from "react-select";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../../components/tailwind/Modal";
import SelectCustom from "../../components/SelectCustom";

export default function FilterModalSimple({ open, onClose, filterBase, editingFilter, onAddFilter, onEditFilter, filterLabel = "" }) {
  const [selectedField, setSelectedField] = useState(null);
  const [filterValue, setFilterValue] = useState([]);

  const isEditing = editingFilter != null;

  useEffect(() => {
    if (open && editingFilter) {
      const field = filterBase.find((f) => f.field === editingFilter.field);
      setSelectedField(field || null);
      setFilterValue(editingFilter.value || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetState = () => {
    setSelectedField(null);
    setFilterValue([]);
  };

  const handleSubmit = () => {
    if (!selectedField || !filterValue.length) return;
    const filter = { field: selectedField.field, value: filterValue };
    if (isEditing) {
      onEditFilter(filter);
    } else {
      onAddFilter(filter);
    }
    onClose();
  };

  // Strip `options` from filterBase items to prevent React-Select from treating them as groups
  const fieldChoices = filterBase.map(({ field, label }) => ({ field, label }));
  const selectedFieldOptions = selectedField ? filterBase.find((f) => f.field === selectedField.field)?.options || [] : [];

  return (
    <ModalContainer open={open} onClose={onClose} onAfterLeave={resetState} size="lg">
      <ModalHeader title={isEditing ? "Modifier le filtre" : `Ajouter un filtre ${filterLabel}`.trim()} />
      <ModalBody className="tw-py-4 tw-px-6">
        <div className="tw-flex tw-flex-col tw-gap-4">
          <div>
            <label className="tw-block tw-text-sm tw-font-medium tw-text-zinc-700 tw-mb-1">Champ</label>
            <SelectCustom
              options={fieldChoices}
              value={selectedField ? { field: selectedField.field, label: selectedField.label } : null}
              onChange={(newField) => {
                setSelectedField(newField ? filterBase.find((f) => f.field === newField.field) : null);
                setFilterValue([]);
              }}
              getOptionLabel={(f) => f.label}
              getOptionValue={(f) => f.field}
              isSearchable
              isClearable
              isMulti={false}
              inputId="filter-modal-simple-field"
              classNamePrefix="filter-modal-simple-field"
              className="tw-text-sm"
            />
          </div>
          {selectedField && (
            <div>
              <label className="tw-block tw-text-sm tw-font-medium tw-text-zinc-700 tw-mb-1">Valeur</label>
              <SelectCustom
                options={selectedFieldOptions.map((o) => (typeof o === "string" ? { label: o, value: o } : o))}
                value={filterValue.map((v) => (typeof v === "string" ? { label: v, value: v } : v))}
                getOptionLabel={(f) => f.label}
                getOptionValue={(f) => f.value}
                onChange={(newValue) => setFilterValue((Array.isArray(newValue) ? newValue : []).map((o) => (typeof o === "string" ? o : o.value)))}
                isClearable={Boolean(filterValue.length)}
                isMulti
                inputId="filter-modal-simple-value"
                classNamePrefix="filter-modal-simple-value"
                className="tw-text-sm"
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
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="button-cancel" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="button-submit" onClick={handleSubmit} disabled={!selectedField || !filterValue.length}>
          {isEditing ? "Modifier" : "Ajouter"}
        </button>
      </ModalFooter>
    </ModalContainer>
  );
}
