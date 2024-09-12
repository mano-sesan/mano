import { useHistory } from "react-router-dom";
import { selector, useRecoilValue } from "recoil";
import { personsState, sortPersons } from "../recoil/persons";
import SelectCustom from "./SelectCustom";

const sortedPersonsByNameSelector = selector({
  key: "sortedPersonsByNameSelector",
  get: ({ get }) => {
    const persons = get(personsState);
    return [...persons].sort(sortPersons("name", "ASC"));
  },
});

const SelectPerson = ({
  value = "",
  defaultValue = null,
  onChange,
  isMulti = false,
  noLabel = false,
  isClearable = false,
  disableAccessToPerson = false,
  inputId = "person",
  name = "person",
  ...props
}) => {
  const sortedPersonsByName = useRecoilValue(sortedPersonsByNameSelector);
  const history = useHistory();

  return (
    <>
      {!noLabel && <label htmlFor={inputId}>{isMulti ? "Personnes(s) suivie(s)" : "Personne suivie"}</label>}
      <SelectCustom
        options={sortedPersonsByName}
        name={name}
        inputId={inputId}
        classNamePrefix={inputId}
        isMulti={isMulti}
        isClearable={isClearable}
        isSearchable
        onChange={(person) => onChange?.({ currentTarget: { value: isMulti ? person.map((p) => p._id) : person?._id, name } })}
        value={
          value != null && isMulti ? sortedPersonsByName.filter((i) => value?.includes(i._id)) : sortedPersonsByName.find((i) => i._id === value)
        }
        defaultValue={
          defaultValue != null && isMulti
            ? sortedPersonsByName.filter((i) => defaultValue?.includes(i._id))
            : sortedPersonsByName.find((i) => i._id === defaultValue)
        }
        getOptionValue={(i) => i._id}
        getOptionLabel={(i) => (i?.otherNames ? `${i?.name} ${i?.otherNames}` : i?.name)}
        formatOptionLabel={(i, options) => {
          return (
            <div className="tw-flex tw-items-center">
              {i?.name}
              {Boolean(i?.otherNames) && <span className="tw-ml-2 tw-text-xs tw-opacity-50">{i?.otherNames}</span>}
              {!disableAccessToPerson && options.context !== "menu" && (
                <button
                  type="button"
                  className="tw-ml-2 tw-font-semibold tw-text-sm tw-text-main tw-z-50"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    history.push(`/person/${i._id}`);
                  }}
                >
                  Accéder au dossier
                </button>
              )}
            </div>
          );
        }}
        {...props}
      />
    </>
  );
};

export default SelectPerson;
