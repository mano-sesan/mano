import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { personsState, usePreparePersonForEncryption } from "../atoms/persons";
import { atom, useAtom, useAtomValue } from "jotai";
import AsyncSelect from "react-select/async-creatable";
import API, { tryFetchExpectOk } from "../services/api";
import { formatBirthDate } from "../services/date";
import { currentTeamState, userState } from "../atoms/auth";
import dayjs from "dayjs";
import { useDataLoader } from "../services/dataLoader";

function removeDiatricsAndAccents(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function personsToOptions(persons) {
  return persons.slice(0, 50).map((person) => ({
    value: person._id,
    label: person.name,
    ...person,
  }));
}

const searchablePersonsSelector = atom((get) => {
  const persons = get(personsState);
  return persons.map((person) => {
    return {
      ...person,
      searchString: [removeDiatricsAndAccents(person.name), removeDiatricsAndAccents(person.otherNames), formatBirthDate(person.birthdate)]
        .join(" ")
        .toLowerCase(),
    };
  });
});

// This function is used to filter persons by search string. It ignores diacritics and accents.
const filterEasySearch = (search, items = []) => {
  const searchNormalized = removeDiatricsAndAccents((search || "").toLocaleLowerCase());
  const searchTerms = searchNormalized.split(" ");
  // Items that have exact match in the beginning of the search string are first.
  const firstItems = items.filter((item) => item.searchString.startsWith(searchNormalized));
  const firstItemsIds = new Set(firstItems.map((item) => item._id));
  // Items that have all words in search (the order does not matter) are second.
  const secondItems = items.filter(
    (item) =>
      // Include only items that are not already in firstItems…
      !firstItemsIds.has(item._id) &&
      //  … and that have all words in search (the order does not matter).
      searchTerms.every((e) => item.searchString.includes(e))
  );
  return [...firstItems, ...secondItems];
};

const SelectAndCreatePerson = ({ value, onChange }) => {
  const { refresh } = useDataLoader();
  const [persons] = useAtom(personsState);
  const [isDisabled, setIsDisabled] = useState(false);
  const currentTeam = useAtomValue(currentTeamState);
  const user = useAtomValue(userState);

  const optionsExist = useRef(null);
  const { encryptPerson } = usePreparePersonForEncryption();

  const searchablePersons = useAtomValue(searchablePersonsSelector);

  return (
    <AsyncSelect
      loadOptions={(inputValue) => {
        const options = personsToOptions(filterEasySearch(inputValue, searchablePersons));
        optionsExist.current = options.length;
        return Promise.resolve(options);
      }}
      defaultOptions={personsToOptions(searchablePersons)}
      name="persons"
      instanceId="persons"
      isMulti
      isDisabled={isDisabled}
      isSearchable
      onChange={(person) => {
        onChange?.({ currentTarget: { value: person.map((p) => p._id), name: "persons" } });
      }}
      getOptionValue={(option) => option._id}
      getOptionLabel={(option) => option.name}
      placeholder="Choisir..."
      onCreateOption={async (name) => {
        const existingPerson = persons.find((p) => p.name === name);
        if (existingPerson) return toast.error("Un utilisateur existe déjà à ce nom");
        setIsDisabled(true);
        const newPerson = { name, assignedTeams: [currentTeam._id], followedSince: dayjs(), user: user._id };
        const currentValue = value || [];
        const [error, response] = await tryFetchExpectOk(async () =>
          API.post({
            path: "/person",
            body: await encryptPerson(newPerson),
          })
        );
        if (!error && response?.data) {
          await refresh();
          toast.success("Nouvelle personne ajoutée !");
          onChange({ currentTarget: { value: [...currentValue, response.data._id], name: "persons" } });
          setIsDisabled(false);
        } else {
          toast.error("Erreur lors de la création de la personne");
        }
      }}
      value={value != null && persons.filter((i) => value?.includes(i._id))}
      formatOptionLabel={(person, options) => {
        if (options.context === "menu") {
          if (person.__isNew__) return <span>Créer "{person.value}"</span>;
          return (
            <div className="tw-flex tw-items-center">
              {person?.name}
              {Boolean(person?.otherNames) && <span className="tw-ml-2 tw-text-xs tw-opacity-50">{person?.otherNames}</span>}
            </div>
          );
        }
        if (person.__isNew__) return <span>Création de {person.name}...</span>;
        return (
          <div className="tw-flex tw-items-center">
            {person?.name}
            {Boolean(person?.otherNames) && <span className="tw-ml-2 tw-text-xs tw-opacity-50">{person?.otherNames}</span>}
          </div>
        );
      }}
      format
      creatable
      onKeyDown={(e) => {
        // prevent create Person on Enter press
        if (e.key === "Enter" && !optionsExist.current) e.preventDefault();
      }}
      inputId={"person"}
      classNamePrefix={"person"}
    />
  );
};

export default SelectAndCreatePerson;
