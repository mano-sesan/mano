import React, { useMemo } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PersonsList from "./PersonsList";
import PersonsFilterScreen from "./PersonsFilterScreen";
import FilterConfigModal from "./FilterConfigModal";
import { TabsParamsList } from "@/types/navigation";
import { useAtom, useAtomValue } from "jotai";
import { teamsState, userState } from "@/recoil/auth";
import { arrayOfitemsGroupedByPersonSelector } from "@/recoil/selectors";
import { filterBySearch } from "@/utils/search";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import PersonNew from "./PersonNew";
import { personsFiltersState } from "@/recoil/persons";
import { filterPersons, FilterContext } from "@/utils/personFilters";
import { Filter } from "@/types/field";

type PersonsListStackParams = {
  PERSONS_LIST: undefined;
  PERSONS_FILTER: undefined;
  FILTER_CONFIG: { field: any };
  PERSON_NEW: undefined;
};

const PersonsListStack = createNativeStackNavigator<PersonsListStackParams>();
type PersonsStackProps = BottomTabScreenProps<TabsParamsList, "PERSONNES">;

export default function PersonsListNavigator(props: PersonsStackProps) {
  const [filters, setFilters] = useAtom(personsFiltersState);
  const [search, setSearch] = React.useState("");
  const numberOfFilters = filters.filter((f) => Boolean(f?.value)).length;

  const filteredPersons = usePersonsFilteredBySearchSelector(filters, search);

  return (
    <PersonsListStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="PERSONS_LIST">
      <PersonsListStack.Screen name="PERSONS_LIST">
        {({ navigation }) => (
          <PersonsList
            persons={filteredPersons}
            numberOfFilters={numberOfFilters}
            setSearch={setSearch}
            onFiltersPress={() => navigation.navigate("PERSONS_FILTER")}
            onCreatePersonRequest={() => navigation.navigate("PERSON_NEW")}
            {...props}
          />
        )}
      </PersonsListStack.Screen>
      <PersonsListStack.Screen name="PERSONS_FILTER">
        {({ navigation }) => (
          <PersonsFilterScreen
            onBack={() => {
              navigation.goBack();
            }}
            onNavigateToConfig={(field) => {
              navigation.navigate("FILTER_CONFIG", { field });
            }}
          />
        )}
      </PersonsListStack.Screen>
      <PersonsListStack.Screen name="FILTER_CONFIG">
        {({ navigation, route }) => (
          <FilterConfigModal
            field={route.params.field}
            onBack={() => {
              navigation.goBack();
            }}
            onAdd={(filter: Filter) => {
              // Add or replace filter
              const existingFilterIndex = filters.findIndex((f) => f.field === filter.field);
              if (existingFilterIndex >= 0) {
                const newFilters = [...filters];
                newFilters[existingFilterIndex] = filter;
                setFilters(newFilters);
              } else {
                setFilters([...filters, filter]);
              }
            }}
          />
        )}
      </PersonsListStack.Screen>
      <PersonsListStack.Screen name="PERSON_NEW">
        {({ navigation }) => <PersonNew onBack={() => navigation.goBack()} onPersonCreated={(person) => navigation.goBack()} />}
      </PersonsListStack.Screen>
    </PersonsListStack.Navigator>
  );
}

const emptyArray: string[] = [];
function usePersonsFilteredBySearchSelector(filters: Array<any>, search: string) {
  const user = useAtomValue(userState)!;
  const persons = useAtomValue(arrayOfitemsGroupedByPersonSelector);
  const teams = useAtomValue(teamsState);

  const filterContext: FilterContext = useMemo(() => {
    const teamNameToId: Record<string, string> = {};
    for (const team of teams) {
      teamNameToId[team.name] = team._id;
    }
    return { teamNameToId };
  }, [teams]);

  return useMemo(() => {
    // First apply filters
    const personsFiltered = filterPersons(persons, filters, filterContext);

    // Then apply search
    const restrictedFields =
      user.role === "restricted-access" ? ["name", "phone", "otherNames", "gender", "formattedBirthDate", "assignedTeams", "email"] : emptyArray;

    const personsfilteredBySearch = filterBySearch(search, personsFiltered, restrictedFields);

    return personsfilteredBySearch;
  }, [filters, search, persons, user.role, filterContext]);
}
