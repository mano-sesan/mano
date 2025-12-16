import React, { useMemo, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PersonsList from "./PersonsList";
import PersonsFilter from "./PersonsFilter";
import { TabsParamsList } from "@/types/navigation";
import { useAtomValue } from "jotai";
import { userState } from "@/recoil/auth";
import { arrayOfitemsGroupedByPersonSelector } from "@/recoil/selectors";
import { filterBySearch } from "@/utils/search";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import NewPersonForm from "./NewPersonForm";

type PersonsListStackParams = {
  PERSONS_LIST: undefined;
  PERSONS_FILTER: undefined;
  PERSON_NEW: undefined;
};

const PersonsListStack = createNativeStackNavigator<PersonsListStackParams>();
type PersonsStackProps = BottomTabScreenProps<TabsParamsList, "PERSONNES">;

type Filters = {
  filterTeams: string[];
  filterAlertness: boolean;
  filterOutOfActiveList: string;
};

export default function PersonsListNavigator(props: PersonsStackProps) {
  const [personFilters, setPersonFilters] = useState<Filters>({ filterTeams: [], filterAlertness: false, filterOutOfActiveList: "" });
  const [search, setSearch] = useState("");
  const filterTeams = personFilters.filterTeams;
  const filterAlertness = personFilters.filterAlertness;
  const filterOutOfActiveList = personFilters.filterOutOfActiveList;
  const numberOfFilters = Number(Boolean(filterAlertness)) + filterTeams.length + Number(["Oui", "Non"].includes(filterOutOfActiveList));

  const filteredPersons = usePersonsFilteredBySearchSelector(filterTeams, filterOutOfActiveList, filterAlertness, search);

  return (
    <PersonsListStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="PERSONS_LIST">
      <PersonsListStack.Screen name="PERSONS_LIST">
        {({ navigation }) => (
          <PersonsList
            persons={filteredPersons}
            numberOfFilters={numberOfFilters}
            search={search}
            setSearch={setSearch}
            personFilters={personFilters}
            onFiltersPress={() => navigation.navigate("PERSONS_FILTER")}
            {...props}
          />
        )}
      </PersonsListStack.Screen>
      <PersonsListStack.Screen name="PERSONS_FILTER">
        {({ navigation }) => (
          <PersonsFilter
            onBack={(filters) => {
              setPersonFilters(filters);
              navigation.navigate("PERSONS_LIST");
            }}
            personFilters={personFilters}
            {...props}
          />
        )}
      </PersonsListStack.Screen>
      <PersonsListStack.Screen name="PERSON_NEW">
        {({ navigation }) => <NewPersonForm onBack={() => navigation.goBack()} onPersonCreated={(person) => navigation.goBack()} />}
      </PersonsListStack.Screen>
    </PersonsListStack.Navigator>
  );
}

function usePersonsFilteredSelector(
  filterTeams: Filters["filterTeams"],
  filterOutOfActiveList: Filters["filterOutOfActiveList"],
  filterAlertness: Filters["filterAlertness"]
) {
  const persons = useAtomValue(arrayOfitemsGroupedByPersonSelector);

  return useMemo(() => {
    let personsFiltered = persons;
    if (!filterTeams.length && !filterOutOfActiveList && !filterAlertness) {
      return persons;
    }
    if (filterOutOfActiveList) {
      personsFiltered = personsFiltered.filter((p) => (filterOutOfActiveList === "Oui" ? p.outOfActiveList : !p.outOfActiveList));
    }
    if (filterAlertness) personsFiltered = personsFiltered.filter((p) => !!p.alertness);
    if (filterTeams.length) {
      personsFiltered = personsFiltered.filter((p) => {
        const assignedTeams = p.assignedTeams || [];
        for (let assignedTeam of assignedTeams) {
          if (filterTeams.includes(assignedTeam)) return true;
        }
        return false;
      });
    }
    return personsFiltered;
  }, [filterTeams, filterOutOfActiveList, filterAlertness, persons]);
}

const emptyArray: string[] = [];
function usePersonsFilteredBySearchSelector(
  filterTeams: Filters["filterTeams"],
  filterOutOfActiveList: Filters["filterOutOfActiveList"],
  filterAlertness: Filters["filterAlertness"],
  search: string
) {
  const user = useAtomValue(userState)!;

  const personsFiltered = usePersonsFilteredSelector(filterTeams, filterOutOfActiveList, filterAlertness);

  const restrictedFields =
    user.role === "restricted-access" ? ["name", "phone", "otherNames", "gender", "formattedBirthDate", "assignedTeams", "email"] : emptyArray;

  const personsfilteredBySearch = filterBySearch(search, personsFiltered, restrictedFields);

  return personsfilteredBySearch;
}
