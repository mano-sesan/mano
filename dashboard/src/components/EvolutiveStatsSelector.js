import React from 'react';
import SelectCustom from './SelectCustom';
import { components } from 'react-select';
import { dayjsInstance, isOnSameDay } from '../services/date';
import DatePicker from './DatePicker';

const EvolutiveStatsSelector = ({ onChange, base, selection, title = '', saveInURLParams = false }) => {
  selection = !!selection.length ? selection : [{ field: null, type: null, value: null }];
  const onAddFilter = () => onChange([...selection, {}], saveInURLParams);
  const filterFields = base.filter((_filter) => _filter.field !== 'alertness').map((f) => ({ label: f.label, field: f.field, type: f.type }));

  function getFilterOptionsByField(field, base, index) {
    if (!field) return [];
    const current = base.find((filter) => filter.field === field);
    if (!current) {
      onChange(
        selection.filter((_f, i) => i !== index),
        saveInURLParams
      );
      return [];
    }
    if (['yes-no'].includes(current.type)) return ['Oui', 'Non', 'Non renseigné'];
    if (['boolean'].includes(current.type)) return ['Oui', 'Non'];
    if (current?.field === 'outOfActiveList') return current.options;
    if (current?.options?.length) return [...current?.options, 'Non renseigné'];
    return ['Non renseigné'];
  }

  function getFilterValue(filterValue) {
    if (typeof filterValue === 'object') {
      if (filterValue?.date != null) {
        if (filterValue.comparator === 'unfilled') return 'Non renseigné';
        if (filterValue.comparator === 'before') return `Avant le ${dayjsInstance(filterValue.date).format('DD/MM/YYYY')}`;
        if (filterValue.comparator === 'after') return `Après le ${dayjsInstance(filterValue.date).format('DD/MM/YYYY')}`;
        if (filterValue.comparator === 'equals') return `Le ${dayjsInstance(filterValue.date).format('DD/MM/YYYY')}`;
        return '';
      }
      if (filterValue?.number != null) {
        if (filterValue.comparator === 'unfilled') return 'Non renseigné';
        if (filterValue.comparator === 'between') return `Entre ${filterValue.number} et ${filterValue.number2}`;
        if (filterValue.comparator === 'equals') return `Égal à ${filterValue.number}`;
        if (filterValue.comparator === 'lower') return `Inférieur à ${filterValue.number}`;
        if (filterValue.comparator === 'greater') return `Supérieur à ${filterValue.number}`;
      }
      return '';
    }
    return filterValue;
  }

  return (
    <>
      <div className="printonly tw-flex tw-gap-2">
        <p>{title}</p>
        <ul>
          {selection.map((filter, index) => {
            if (!filter?.field) return null;
            const current = base.find((_filter) => _filter.field === filter.field);
            if (!current) return null;
            const filterValue = getFilterValue(filter.value);
            if (!filterValue) return null;
            return (
              <li key={index} className="tw-list-disc">
                {current.label}: {filterValue}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="border-b noprint tw-z-10 tw-mb-8 tw-flex tw-w-full tw-flex-col tw-justify-center tw-gap-2 tw-self-center tw-border-gray-300 tw-pb-4">
        <div className="tw-flex tw-flex-wrap">
          <div className="tw-basis-5/6">
            <p className="tw-m-0">{title}</p>
          </div>
        </div>
        <div className="tw-w-full">
          {selection.map((filter, index) => {
            // filter: field, value, type
            const filterValues = getFilterOptionsByField(filter.field, base, index);
            const onChangeField = (newField) => {
              onChange(
                selection.map((_filter, i) => (i === index ? { field: newField?.field, value: null, type: newField?.type } : _filter)),
                saveInURLParams
              );
            };
            const onChangeValue = (newValue) => {
              onChange(
                selection.map((f, i) => (i === index ? { field: filter.field, value: newValue, type: filter.type } : f)),
                saveInURLParams
              );
            };
            const onRemoveFilter = () => {
              onChange(
                selection.filter((_f, i) => i !== index),
                saveInURLParams
              );
            };

            return (
              <div className="tw-mx-auto tw-mb-2.5 tw-flex tw-items-center tw-gap-2 tw-border-2" key={`${filter.field || 'empty'}${index}`}>
                <div className="tw-grow tw-basis-1/12">
                  <p className="tw-m-0 tw-w-full tw-pr-4 tw-text-right">{index === 0 ? 'Indicateur' : 'ET indicateur'}</p>
                </div>
                <div className="tw-basis-4/12">
                  <SelectCustom
                    options={filterFields}
                    value={filter.field ? filter : null}
                    onChange={onChangeField}
                    getOptionLabel={(_option) => filterFields.find((_filter) => _filter.field === _option.field)?.label}
                    getOptionValue={(_option) => _option.field}
                    isClearable={true}
                    isMulti={false}
                  />
                </div>
                <div className="tw-flex tw-basis-1/12 tw-items-center tw-justify-center">
                  <p className="tw-m-0">de</p>
                </div>
                <div className="tw-basis-2/12">
                  <ValueSelector field={filter.field} filterValues={filterValues} value={filter.value} base={base} onChangeValue={onChangeValue} />
                </div>
                <div className="tw-flex tw-basis-1/12 tw-items-center tw-justify-center">
                  <p className="tw-m-0">à</p>
                </div>
                <div className="tw-basis-2/12">
                  <ValueSelector field={filter.field} filterValues={filterValues} value={filter.value} base={base} onChangeValue={onChangeValue} />
                </div>
                <div className="tw-basis-2/12">
                  {!!selection.filter((_filter) => Boolean(_filter.field)).length && (
                    <button
                      type="button"
                      className="tw-h-full tw-w-full tw-rounded tw-border tw-border-gray-300 tw-bg-white tw-text-red-500"
                      onClick={onRemoveFilter}>
                      Retirer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="tw-flex tw-w-full">
          <div className="tw-basis-1/12" />
          <button
            type="button"
            className="tw-h-full tw-rounded tw-text-main disabled:tw-opacity-20"
            onClick={onAddFilter}
            disabled={selection.find((f) => !f.field)}>
            + Ajouter un indicateur
          </button>
        </div>
      </div>
    </>
  );
};

const dateOptions = [
  {
    label: 'Avant',
    value: 'before',
  },
  {
    label: 'Après',
    value: 'after',
  },
  {
    label: 'Date exacte',
    value: 'equals',
  },
  {
    label: 'Non renseigné',
    value: 'unfilled',
  },
];

const numberOptions = [
  {
    label: 'Inférieur à',
    value: 'lower',
  },
  {
    label: 'Supérieur à',
    value: 'greater',
  },
  {
    label: 'Égal à',
    value: 'equals',
  },
  {
    label: 'Entre',
    value: 'between',
  },
  {
    label: 'Non renseigné',
    value: 'unfilled',
  },
];

const ValueSelector = ({ field, filterValues, value, onChangeValue, base }) => {
  const [comparator, setComparator] = React.useState(null);
  if (!field) return <></>;
  const current = base.find((filter) => filter.field === field);
  if (!current) return <></>;
  const { type, field: name } = current;

  if (['text', 'textarea'].includes(type)) {
    return (
      <input
        name={name}
        className="tailwindui !tw-mt-0"
        type="text"
        value={value || ''}
        onChange={(e) => {
          e.preventDefault();
          onChangeValue(e.target.value);
        }}
      />
    );
  }

  if (['date-with-time', 'date'].includes(type)) {
    return (
      <div className="tw-flex tw-border-2">
        <div className={['tw-px-4', value?.comparator !== 'unfilled' ? 'tw-basis-1/2' : 'tw-basis-full'].join(' ')}>
          <SelectCustom
            options={dateOptions}
            value={dateOptions.find((opt) => opt.value === value?.comparator)}
            isClearable={!value}
            onChange={(e) => {
              if (!e) return setComparator(null);
              setComparator(e.value);
              onChangeValue({ date: value?.date, comparator: e.value });
            }}
          />
        </div>
        {value?.comparator !== 'unfilled' && (
          <div className="tw-basis-1/2 tw-px-4">
            <DatePicker
              id={name}
              defaultValue={value?.date ? new Date(value?.date) : null}
              onChange={(date) => onChangeValue({ date: date.target.value, comparator })}
            />
          </div>
        )}
      </div>
    );
  }

  if (['number'].includes(type)) {
    return (
      <div className="-tw-mx-4 tw-flex tw-flex-wrap tw-items-center">
        <div
          className={[
            'tw-px-4',
            value?.comparator === 'unfilled' ? 'tw-basis-full' : '',
            value?.comparator === 'between' ? 'tw-basis-5/12' : '',
            !['unfilled', 'between'].includes(value?.comparator) ? 'tw-basis-1/2' : '',
          ].join(' ')}>
          <SelectCustom
            options={numberOptions}
            value={numberOptions.find((opt) => opt.value === value?.comparator)}
            isClearable={!value}
            onChange={(e) => {
              if (!e) return setComparator(null);
              setComparator(e.value);
              onChangeValue({ number: value?.number, comparator: e.value });
            }}
          />
        </div>
        {value?.comparator !== 'unfilled' && (
          <div className={['tw-px-4', value?.comparator === 'between' ? 'tw-basis-3/12' : 'tw-basis-1/2'].join(' ')}>
            <input
              name={name}
              className="tailwindui !tw-mt-0"
              type="number"
              min="0"
              value={value?.number || ''}
              onChange={(e) => {
                onChangeValue({ number: e.target.value, number2: value?.number2, comparator });
              }}
            />
          </div>
        )}
        {value?.comparator === 'between' && (
          <>
            <div>et</div>
            <div className="tw-basis-3/12 tw-px-4">
              <input
                name={name}
                className="tailwindui !tw-mt-0"
                type="number"
                min="0"
                value={value?.number2 || ''}
                onChange={(e) => {
                  onChangeValue({ number2: e.target.value, number: value?.number, comparator });
                }}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  if (['enum', 'multi-choice'].includes(type) && name !== 'outOfActiveList') {
    try {
      return (
        <SelectCustom
          options={filterValues.map((_value) => ({ label: _value, value: _value }))}
          value={value?.map((_value) => ({ label: _value, value: _value })) || []}
          getOptionLabel={(f) => f.label}
          getOptionValue={(f) => f.value}
          onChange={(newValue) => onChangeValue(newValue?.map((option) => option.value))}
          isClearable={!value?.length}
          isMulti
          components={{
            MultiValueContainer: (props) => {
              if (props.selectProps?.values?.length <= 1) {
                return <components.MultiValueContainer {...props} />;
              }
              const lastValue = props.selectProps?.value?.[props.selectProps?.value?.length - 1]?.value;
              const isLastValue = props?.data?.value === lastValue;
              return (
                <>
                  <components.MultiValueLabel {...props} />
                  {!isLastValue && <span className="tw-mr-2 tw-ml-1 tw-inline-block">OU</span>}
                </>
              );
            },
          }}
        />
      );
    } catch (e) {
      console.log(e);
    }
    return null;
  }

  return (
    <SelectCustom
      options={filterValues.map((_value) => ({ label: _value, value: _value }))}
      value={value ? { label: value, value } : null}
      getOptionLabel={(f) => f.label}
      getOptionValue={(f) => f.value}
      onChange={(f) => onChangeValue(f.value)}
      isClearable={!value}
    />
  );
};

export default EvolutiveStatsSelector;