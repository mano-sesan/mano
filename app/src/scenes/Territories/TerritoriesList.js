import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import SceneContainer from '../../components/SceneContainer';
import ScreenTitle from '../../components/ScreenTitle';
import Spinner from '../../components/Spinner';
import { ListEmptyTerritories, ListNoMoreTerritories } from '../../components/ListEmptyContainer';
import FloatAddButton from '../../components/FloatAddButton';
import { FlashListStyled } from '../../components/Lists';
import Search from '../../components/Search';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { refreshTriggerState, loadingState } from '../../components/Loader';
import { territoriesWithObservationsSearchSelector } from '../../recoil/territory';
import RowContainer from '../../components/RowContainer';
import { MyText } from '../../components/MyText';
import styled from 'styled-components/native';
import { dayjsInstance } from '../../services/dateDayjs';

const TerritoriesList = () => {
  const [search, setSearch] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useRecoilState(refreshTriggerState);

  const navigation = useNavigation();

  const loading = useRecoilValue(loadingState);
  const territories = useRecoilValue(territoriesWithObservationsSearchSelector({ search }));

  const onRefresh = async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  };
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused && refreshTrigger.status !== true) onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const onCreateTerritoryRequest = () => navigation.navigate('NewTerritoryForm');

  const keyExtractor = (territory) => territory._id;
  const ListFooterComponent = useMemo(() => {
    if (!territories.length) return null;
    return <ListNoMoreTerritories />;
  }, [territories.length]);
  const renderRow = ({ item: territory }) => {
    const { name } = territory;
    const lastObservationDate = territory.lastObservationDate ? dayjsInstance(territory.lastObservationDate).format('DD/MM/YYYY') : null;
    return (
      <RowContainer onPress={() => navigation.push('Territory', { territory })}>
        <View>
          <View>
            <Name>{name}</Name>
          </View>
          {!!lastObservationDate && <MyText color="#777">Dernière observation le {lastObservationDate}</MyText>}
        </View>
      </RowContainer>
    );
  };

  const listRef = useRef(null);
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

  return (
    <SceneContainer>
      <ScreenTitle title="Territoires" parentScroll={scrollY} />
      <Search
        placeholder="Rechercher un territoire..."
        onChange={setSearch}
        onFocus={() => listRef.current.scrollToOffset({ offset: 100 })}
        parentScroll={scrollY}
      />
      <FlashListStyled
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
        ListEmptyComponent={loading ? Spinner : ListEmptyTerritories}
        initialNumToRender={10}
        ListFooterComponent={ListFooterComponent}
        defaultTop={0}
      />
      <FloatAddButton onPress={onCreateTerritoryRequest} testID="add-territory-button" />
    </SceneContainer>
  );
};

const Name = styled(MyText)`
  font-weight: bold;
  font-size: 17px;
`;

export default TerritoriesList;
