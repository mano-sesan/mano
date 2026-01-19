import React, { useCallback, useEffect, useRef } from "react";
import { Animated } from "react-native";
import * as Sentry from "@sentry/react-native";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import PersonRow from "./PersonRow";
import Spinner from "../../components/Spinner";
import { ListEmptyPersons, ListNoMorePersons } from "../../components/ListEmptyContainer";
import FloatAddButton from "../../components/FloatAddButton";
import { FlashListStyled } from "../../components/Lists";
import Search from "../../components/Search";
import { useAtom, useAtomValue } from "jotai";
import { loadingState, refreshTriggerState } from "../../components/Loader";
import { useIsFocused } from "@react-navigation/native";
import { PersonInstance } from "@/types/person";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { RootStackParamList, TabsParamsList } from "@/types/navigation";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashListRef } from "@shopify/flash-list";

type PersonListProps = BottomTabScreenProps<TabsParamsList, "PERSONNES"> & {
  setSearch: (search: string) => void;
  numberOfFilters: number;
  onFiltersPress: () => void;
  persons: PersonInstance[];
  onCreatePersonRequest: () => void;
};

const PersonsList = ({ navigation, route, persons, numberOfFilters, setSearch, onFiltersPress, onCreatePersonRequest }: PersonListProps) => {
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);

  const onRefresh = async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  };

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused && refreshTrigger.status !== true) onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const keyExtractor = (person: PersonInstance) => person._id;
  const ListFooterComponent = useCallback(() => {
    if (!persons.length) return null;
    return <ListNoMorePersons />;
  }, [persons.length]);
  const renderPersonRow = ({ item: person }: { item: PersonInstance }) => {
    const onPress = () => {
      Sentry.setContext("person", { _id: person._id });
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>().push("PERSON_STACK", { person });
    };
    return <PersonRow onPress={onPress} person={person} />;
  };

  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event(
    [
      {
        nativeEvent: {
          contentOffset: {
            y: scrollY,
          },
        },
      },
    ],
    { useNativeDriver: true }
  );

  const listref = useRef<FlashListRef<PersonInstance> | null>(null);

  return (
    <SceneContainer>
      <ScreenTitle title="Personnes suivies" parentScroll={scrollY} customRight={`Filtres (${numberOfFilters})`} onPressRight={onFiltersPress} />
      <Search
        placeholder="Rechercher une personne..."
        onFocus={() => listref?.current?.scrollToOffset({ offset: 100 })}
        parentScroll={scrollY}
        onChange={setSearch}
      />
      <FlashListStyled
        // @ts-ignore FIXME
        ref={listref}
        withHeaderSearch
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        onScroll={onScroll}
        parentScroll={scrollY}
        data={persons}
        extraData={persons}
        estimatedItemSize={114}
        renderItem={renderPersonRow}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        initialNumToRender={10}
        ListFooterComponent={ListFooterComponent}
        defaultTop={0}
      />
      <FloatAddButton onPress={onCreatePersonRequest} testID="add-person-button" />
    </SceneContainer>
  );
};

const ListEmptyComponent = () => {
  const loading = useAtomValue(loadingState);
  if (loading) return <Spinner />;
  return <ListEmptyPersons />;
};

export default PersonsList;
