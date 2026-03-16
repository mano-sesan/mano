import React, { useMemo, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { useAtom, useAtomValue } from "jotai";
import SceneContainer from "@/components/SceneContainer";
import ScreenTitle from "@/components/ScreenTitle";
import ScrollContainer from "@/components/ScrollContainer";
import Search from "@/components/Search";
import Tags from "@/components/Tags";
import FilterGroup from "@/components/FilterGroup";
import { personsFiltersState, availablePersonFiltersSelector, customFieldsPersonsSelector } from "@/recoil/persons";
import { FilterableField } from "@/types/field";
import { formatFilterLabel } from "@/utils/personFilters";
import { MyText } from "@/components/MyText";

type PersonsFilterScreenProps = {
  onBack: () => void;
  onNavigateToConfig?: (field: FilterableField) => void;
};

const PersonsFilterScreen = ({ onBack, onNavigateToConfig }: PersonsFilterScreenProps) => {
  const [filters, setFilters] = useAtom(personsFiltersState);
  const availableFields = useAtomValue(availablePersonFiltersSelector);
  const customFieldsSections = useAtomValue(customFieldsPersonsSelector);
  const [search, setSearch] = useState("");

  // Group fields into categories
  const groupedFields = useMemo(() => {
    const identityFields = ["name", "otherNames", "age", "birthdate", "gender", "phone", "email"];
    const situationFields = ["outOfActiveList", "assignedTeams", "followedSince", "alertness", "wanderingAt", "outOfActiveListReasons"];
    const statisticsFields = [
      "numberOfActions",
      "numberOfConsultations",
      "numberOfTreatments",
      "numberOfPassages",
      "numberOfRencontres",
      "followSinceMonths",
    ];
    const activityFields = ["actionCategories", "actionCategoriesCombined", "hasAtLeastOneConsultation", "group"];
    const placesFields = ["places"];

    // Filter fields by search
    const searchLower = search.toLowerCase();
    const filteredFields = availableFields.filter((field) => {
      if (!search) return true;
      return field.label.toLowerCase().includes(searchLower) || field.field.toLowerCase().includes(searchLower);
    });

    // Standard groups
    const groups = [
      {
        title: "IDENTITÉ",
        fields: filteredFields.filter((f) => identityFields.includes(f.field)),
      },
      {
        title: "SITUATION",
        fields: filteredFields.filter((f) => situationFields.includes(f.field)),
      },
      {
        title: "STATISTIQUES",
        fields: filteredFields.filter((f) => statisticsFields.includes(f.field)),
      },
      {
        title: "ACTIVITÉ",
        fields: filteredFields.filter((f) => activityFields.includes(f.field)),
      },
      {
        title: "LIEUX",
        fields: filteredFields.filter((f) => placesFields.includes(f.field)),
      },
    ];

    // Add custom fields sections dynamically
    for (const section of customFieldsSections) {
      const sectionFieldNames = section.fields.map((f) => f.name);
      const sectionFields = filteredFields.filter((f) => sectionFieldNames.includes(f.field));
      if (sectionFields.length > 0) {
        groups.push({
          title: section.name.toUpperCase(),
          fields: sectionFields,
        });
      }
    }

    // TODO: Add medical group if user.healthcareProfessional
    // if (user?.healthcareProfessional) {
    //   groups.push({
    //     title: "MÉDICAL",
    //     fields: filteredFields.filter((f) => f.category === "medicalFile" || f.category === "flattenedConsultations"),
    //   });
    // }

    // Filter out empty groups
    return groups.filter((g) => g.fields.length > 0);
  }, [availableFields, search, customFieldsSections]);

  const handleFieldPress = React.useCallback(
    (field: FilterableField) => {
      if (onNavigateToConfig) {
        onNavigateToConfig(field);
      }
    },
    [onNavigateToConfig],
  );

  const handleResetAll = React.useCallback(() => {
    setFilters([]);
  }, [setFilters]);

  const activeFilters = filters.filter((f) => Boolean(f?.value));

  return (
    <SceneContainer testID="persons-filter-screen">
      <ScreenTitle title="Filtres" onBack={onBack} testID="persons-filter-screen-title" />
      <ScrollContainer testID="persons-filter-scroll">
        <View>
          {/* Active filters tags */}
          {activeFilters.length > 0 ? (
            <View>
              <View className="flex-row items-center justify-between mb-2">
                <MyText className="font-bold text-base">Filtres actifs ({activeFilters.length})</MyText>
                <TouchableOpacity onPress={handleResetAll}>
                  <MyText className="text-blue-500 text-sm">Tout réinitialiser</MyText>
                </TouchableOpacity>
              </View>
              <Tags
                data={activeFilters}
                onChange={(newFilters) => setFilters(newFilters)}
                editable
                renderTag={(filter) => {
                  const label = formatFilterLabel(filter, availableFields);
                  return <MyText>{label}</MyText>;
                }}
                listEmptyText="Aucun filtre actif"
              />
            </View>
          ) : (
            <View className="mb-4 py-4 px-3 bg-gray-50 rounded-lg">
              <MyText className="text-gray-600 text-center">Aucun filtre actif. Sélectionnez un champ ci-dessous pour commencer.</MyText>
            </View>
          )}

          {/* Search */}
          <View className="mb-4">
            <Search placeholder="Rechercher un champ..." onChange={setSearch} />
          </View>

          {/* Field groups */}
          {groupedFields.map((group) => (
            <FilterGroup key={group.title} title={group.title} fields={group.fields} activeFilters={activeFilters} onFieldPress={handleFieldPress} />
          ))}

          {groupedFields.length === 0 && search && (
            <View className="py-8 items-center">
              <MyText className="text-gray-500">Aucun champ trouvé</MyText>
            </View>
          )}
        </View>
      </ScrollContainer>
    </SceneContainer>
  );
};

export default PersonsFilterScreen;
