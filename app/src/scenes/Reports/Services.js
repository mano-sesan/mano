import { useRecoilState, useRecoilValue } from 'recoil';
import React, { useCallback, useEffect, useState } from 'react';
import SceneContainer from '../../components/SceneContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { refreshTriggerState } from '../../components/Loader';
import { FlashListStyled } from '../../components/Lists';
import { ListEmptyServices } from '../../components/ListEmptyContainer';
import { getPeriodTitle } from './utils';
import { currentTeamState, organisationState } from '../../recoil/auth';
import API from '../../services/api';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { servicesSelector } from '../../recoil/reports';
const keyExtractor = (item) => item._id;

const Services = ({ navigation, route }) => {
  const groupedServices = useRecoilValue(servicesSelector);
  const { date } = route.params;
  const organisation = useRecoilValue(organisationState);
  const [refreshTrigger, setRefreshTrigger] = useRecoilState(refreshTriggerState);
  const currentTeam = useRecoilValue(currentTeamState);
  const [services, setServices] = useState([]);
  const [activeTab, setActiveTab] = useState(groupedServices[0]?.groupTitle || null);

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
    return (
      <View className="flex flex-row justify-between px-4 py-2">
        <Text className="text-lg font-bold">{item?.service}</Text>
        <Text className="text-lg">{item?.count}</Text>
      </View>
    );
  };

  if (!organisation.receptionEnabled || !organisation?.services || !groupedServices.length) return null;

  const selectedServices = (groupedServices.find((e) => e.groupTitle === activeTab)?.services || []).map((e) => {
    const service = (services || []).find((f) => f.service === e);
    return { service: e, _id: service?._id || e, count: service?.count || 0 };
  });

  return (
    <SceneContainer backgroundColor="#fff">
      <ScreenTitle title={`Services\n${getPeriodTitle(date, currentTeam?.nightSession)}`} onBack={navigation.goBack} />
      <ScrollView horizontal className="flex-grow-0 gap-4 flex-shrink-0 px-2 bg-white border-b border-b-gray-300">
        {groupedServices.map((group) => {
          return (
            <TouchableOpacity key={group.groupTitle} onPress={() => setActiveTab(group.groupTitle)}>
              <View className={`p-3 bg-white ${group.groupTitle === activeTab ? 'border-b-green-700 border-b-4' : ''}`}>
                <Text>{group.groupTitle}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlashListStyled
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        data={selectedServices}
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
