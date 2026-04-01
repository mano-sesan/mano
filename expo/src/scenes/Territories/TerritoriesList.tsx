import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, View } from "react-native";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import Spinner from "../../components/Spinner";
import { ListEmptyTerritories, ListNoMoreTerritories } from "../../components/ListEmptyContainer";
import FloatAddButton from "../../components/FloatAddButton";
import { FlashListStyled } from "../../components/Lists";
import Search from "../../components/Search";
import { useAtom, useAtomValue } from "jotai";
import { useIsFocused } from "@react-navigation/native";
import { refreshTriggerState, loadingState } from "../../components/Loader";
import { useTerritoriesWithObservationsSearchSelector } from "../../recoil/territory";
import RowContainer from "../../components/RowContainer";
import { MyText } from "../../components/MyText";
import styled from "styled-components/native";
import { RootStackParamList, TabsParamsList } from "@/types/navigation";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TerritoryInstance } from "@/types/territory";
import { FlashListRef } from "@shopify/flash-list";
import CheckboxLabelled from "../../components/CheckboxLabelled";
import useRefreshOnFocus from "@/utils/refresh-on-focus";

type TerritoriesListProps = BottomTabScreenProps<TabsParamsList, "TERRITOIRES">;

const TerritoriesList = ({ navigation }: TerritoriesListProps) => {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);

  const territories = useTerritoriesWithObservationsSearchSelector(search, showArchived);

  const onRefresh = async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  };
  useRefreshOnFocus();

  const onCreateTerritoryRequest = () => navigation.getParent<NativeStackNavigationProp<RootStackParamList>>().navigate("TERRITORY_NEW");

  const keyExtractor = (territory: TerritoryInstance) => territory._id;
  const ListFooterComponent = useMemo(() => {
    if (!territories.length) return null;
    return <ListNoMoreTerritories />;
  }, [territories.length]);
  const renderRow = ({ item: territory }: { item: TerritoryInstance }) => {
    const { name } = territory;
    return (
      <RowContainer onPress={() => navigation.getParent<NativeStackNavigationProp<RootStackParamList>>().push("TERRITORY", { territory })}>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Name>{name}</Name>
            {!!territory.archivedAt && <ArchivedBadge>(archivé)</ArchivedBadge>}
          </View>
        </View>
      </RowContainer>
    );
  };

  const listRef = useRef<FlashListRef<TerritoryInstance> | null>(null);
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
    { useNativeDriver: true },
  );

  return (
    <SceneContainer>
      <ScreenTitle title="Territoires" parentScroll={scrollY} />
      <Search
        placeholder="Rechercher un territoire..."
        onChange={setSearch}
        onFocus={() => listRef.current?.scrollToOffset({ offset: 100 })}
        parentScroll={scrollY}
      />
      <FlashListStyled
        // @ts-ignore FIXME
        ref={listRef}
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        withHeaderSearch
        onScroll={onScroll}
        estimatedItemSize={80}
        parentScroll={scrollY}
        data={territories}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
            <CheckboxLabelled
              _id="show-archived"
              label="Afficher les territoires archivés"
              value={showArchived}
              onPress={() => setShowArchived((prev) => !prev)}
              alone
            />
          </View>
        }
        ListEmptyComponent={ListEmptyComponent}
        initialNumToRender={10}
        ListFooterComponent={ListFooterComponent}
        defaultTop={0}
      />

      <FloatAddButton onPress={onCreateTerritoryRequest} testID="add-territory-button" />
    </SceneContainer>
  );
};

const ListEmptyComponent = () => {
  const loading = useAtomValue(loadingState);
  if (loading) return <Spinner />;
  return <ListEmptyTerritories />;
};
const Name = styled(MyText)`
  font-weight: bold;
  font-size: 17px;
`;
const ArchivedBadge = styled(MyText)`
  font-size: 12px;
  color: #d97706;
  margin-left: 8px;
`;

export default TerritoriesList;
