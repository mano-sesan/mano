import { useRecoilState, useRecoilValue } from 'recoil';
import React, { useCallback, useEffect, useState } from 'react';
import SceneContainer from '../../components/SceneContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { refreshTriggerState } from '../../components/Loader';
import { FlashListStyled } from '../../components/Lists';
import { ListEmptyServices, ListNoMoreServices } from '../../components/ListEmptyContainer';
import { getPeriodTitle } from './utils';
import { currentTeamState, organisationState } from '../../recoil/auth';
import API from '../../services/api';
import { Alert, Text, View } from 'react-native';
const keyExtractor = (item) => item._id;

const Services = ({ navigation, route }) => {
  const { date } = route.params;
  const organisation = useRecoilValue(organisationState);
  const [refreshTrigger, setRefreshTrigger] = useRecoilState(refreshTriggerState);
  const currentTeam = useRecoilValue(currentTeamState);
  const [services, setServices] = useState([]);

  const onRefresh = useCallback(async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  }, [setRefreshTrigger]);

  useEffect(() => {
    async function initServices() {
      const response = await API.get({ path: `/service/team/${currentTeam._id}/date/${date}` });
      if (response.error) return Alert.alert(response.error);
      setServices(response.data);
    }
    initServices();
  }, [currentTeam._id, date]);

  const renderItem = ({ item }) => {
    const service = item;
    return (
      <View className="flex flex-row justify-between px-4 py-2">
        <Text className="text-lg font-bold">{service.service}</Text>
        <Text className="text-lg">{service.count}</Text>
      </View>
    );
  };

  console.log(services.length);

  if (!organisation.receptionEnabled || !organisation?.services) return null;

  return (
    <SceneContainer backgroundColor="#fff">
      <ScreenTitle title={`Services\n${getPeriodTitle(date, currentTeam?.nightSession)}`} onBack={navigation.goBack} />
      <FlashListStyled
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        data={services}
        initialNumToRender={50}
        renderItem={renderItem}
        estimatedItemSize={545}
        keyExtractor={keyExtractor}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={ListEmptyServices}
        ListFooterComponent={null}
      />
    </SceneContainer>
  );
};

export default Services;
