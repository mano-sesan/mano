import React, { useState, useMemo, useRef } from "react";
import { atom, useAtomValue } from "jotai";
import { TouchableOpacity, View, ScrollView, Modal } from "react-native";
import { actionsCategoriesSelector, actionsState, flattenedActionsCategoriesSelector } from "../recoil/actions";
import Label from "./Label";
import { MyText } from "./MyText";
import Row from "./Row";
import Tags from "./Tags";
import SceneContainer from "./SceneContainer";
import ScreenTitle from "./ScreenTitle";
import ScrollContainer from "./ScrollContainer";
import { FlashList } from "@shopify/flash-list";
import Search from "./Search";
import styled from "styled-components/native";
import colors from "../utils/colors";

const categoriesSortedByMostUsedSelector = atom((get) => {
  const actions = get(actionsState);
  const flattenedActionsCategories = get(flattenedActionsCategoriesSelector);
  if (!actions?.length) return [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const categories: Record<string, number> = {};
  for (const action of actions) {
    if (!action.categories) continue;
    if (new Date(action.createdAt!) < thirtyDaysAgo) continue;
    for (const category of action.categories) {
      if (!categories[category]) categories[category] = 0;
      categories[category]++;
    }
  }

  return Object.entries(categories) // [[{category}, {count}], [{category}, {count}]]
    .sort(([_, countCat1], [__, countCat2]) => countCat2 - countCat1)
    .map(([category]) => category)
    .filter((category) => flattenedActionsCategories.includes(category));
});

type ActionCategoriesModalSelectProps = {
  values: string[];
  onChange: (categories: string[]) => void;
  editable?: boolean;
  withMostUsed?: boolean;
};

const ActionCategoriesModalSelect = ({ values = [], onChange, editable, withMostUsed }: ActionCategoriesModalSelectProps) => {
  const [open, setOpen] = useState(false);
  const allGroups = useAtomValue(actionsCategoriesSelector);
  const categoriesSortedByMostUsed = useAtomValue(categoriesSortedByMostUsedSelector);

  const [search, setSearch] = useState("");
  const [groupSelected, setGroupSelected] = useState(allGroups[0].groupTitle);

  const mostUsedCategoriesToShow = useMemo(
    () => categoriesSortedByMostUsed.filter((category) => !values.some((_category) => _category === category)).slice(0, 5),
    [categoriesSortedByMostUsed, values]
  );

  const groups = useMemo(() => {
    if (!search && !values.length) return allGroups;
    return allGroups.map(({ groupTitle, categories }) => {
      if (search) {
        categories = categories.filter((_category) => _category.toLowerCase().trim().includes(search.toLowerCase().trim()));
      }
      if (values.length) {
        categories = categories.filter((_category) => !values.includes(_category));
      }
      return { groupTitle, categories };
    });
  }, [search, values, allGroups]);

  const categories = useMemo(() => {
    if (search) {
      // When searching, show results from all groups
      return groups.flatMap((group) => group.categories).filter((category) => !values.includes(category));
    }
    // Otherwise show only the selected group's categories
    const group = groups.find((group) => group.groupTitle === groupSelected);
    return group?.categories || [];
  }, [groupSelected, groups, search, values]);

  const selectedCategoriesRef = useRef<ScrollView>(null);

  return (
    <>
      {editable ? <Label label="Catégories" /> : <InlineLabel bold>Catégories :</InlineLabel>}
      <Tags
        data={values}
        onChange={onChange}
        editable={editable}
        onAddRequest={() => setOpen(true)}
        renderTag={(category) => <MyText>{category}</MyText>}
      />
      {!!withMostUsed && !!mostUsedCategoriesToShow.length && (
        <ScrollView horizontal className="flex-grow-0 flex-shrink-0 -mt-8 mb-8 -mx-[30px] px-2">
          <MyText className="self-center">Catégories les plus utilisées: </MyText>
          {mostUsedCategoriesToShow.map((category) => (
            <TouchableOpacity
              onPress={() => onChange([...values, category])}
              className="rounded-full ml-2 px-2 py-1 border border-main"
              key={category}
            >
              <MyText>{category}</MyText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <Modal animationType="fade" visible={!!open} onRequestClose={() => setOpen(false)}>
        <SceneContainer>
          <ScreenTitle title="Catégories de l'action" onBack={() => setOpen(false)} />
          <ScrollContainer scrollEnabled={false} noPadding>
            <Search placeholder="Rechercher une catégorie..." onChange={setSearch} />
            <ScrollView ref={selectedCategoriesRef} horizontal className="flex-grow-0 flex-shrink-0">
              <Tags
                data={values}
                disableAdd
                onChange={onChange}
                editable
                renderTag={(category) => <MyText>{category}</MyText>}
                className="min-h-0 m-0"
              />
            </ScrollView>
            {!search && (
              <ScrollView contentContainerStyle={{ paddingVertical: 16 }} horizontal className="flex-grow-0 flex-shrink-0">
                {groups.map((group) => (
                  <TouchableOpacity
                    onPress={() => setGroupSelected(group.groupTitle)}
                    className={["rounded-full ml-2 px-2 py-1 border border-main", groupSelected === group.groupTitle ? "bg-main" : ""].join(" ")}
                    key={group.groupTitle}
                  >
                    <MyText className={[groupSelected === group.groupTitle ? "text-white" : ""].join(" ")}>
                      {group.groupTitle} ({group.categories.length})
                    </MyText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View className="flex-grow flex-shrink h-96">
              <FlashList
                data={categories}
                renderItem={({ item: category }) => (
                  <Row
                    onPress={() => {
                      selectedCategoriesRef.current?.scrollToEnd();
                      onChange([...values, category]);
                    }}
                    caption={category}
                  />
                )}
              />
            </View>
          </ScrollContainer>
        </SceneContainer>
      </Modal>
    </>
  );
};

const InlineLabel = styled(MyText)`
  font-size: 15px;
  color: ${colors.app.color};
  margin-bottom: 15px;
`;

export default ActionCategoriesModalSelect;
