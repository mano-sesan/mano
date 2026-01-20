import { useAtom, useAtomValue } from "jotai";
import React, { useCallback, useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import { refreshTriggerState } from "../../components/Loader";
import { FlashListStyled } from "../../components/Lists";
import { ListEmptyServices } from "../../components/ListEmptyContainer";
import { getPeriodTitle } from "./utils";
import { currentTeamState, organisationState } from "../../recoil/auth";
import API from "../../services/api";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { servicesSelector } from "../../recoil/reports";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { ServiceInstance } from "@/types/service";

type ServiceToShow = Pick<ServiceInstance, "service" | "_id" | "count">;

const keyExtractor = (item: ServiceToShow) => item._id;

function IncrementorSmall({
  service,
  date,
  team,
  initialValue,
  onUpdated,
}: {
  service: ServiceToShow;
  date: string;
  team: string;
  initialValue: number;
  onUpdated: (count: number) => void;
}) {
  const debounced = useDebouncedCallback(
    function updateServiceInDatabase(_value) {
      if (_value === initialValue) return;

      API.post({ path: `/service/team/${team}/date/${date}`, body: { count: _value, service: service.service } }).then((res) => {
        if (res.error) {
          return Alert.alert("Erreur lors de la mise à jour du service");
        }
        onUpdated(res.data.count);
      });
    },
    500,
    { maxWait: 4000 }
  );

  const [value, setValue] = useState(initialValue);
  useEffect(() => setValue(initialValue), [initialValue]);
  useEffect(() => debounced(value), [debounced, value]);
  useEffect(
    () => () => {
      debounced.flush();
    },
    [debounced]
  );

  return (
    <View className="flex flex-row justify-between px-4 py-2">
      <Text className="text-lg font-bold grow">{service?.service}</Text>
      <View className="flex flex-row gap-4 items-center">
        <TouchableOpacity onPress={() => setValue(value - 1)}>
          <View className="bg-main rounded w-8 h-8 flex items-center justify-center">
            <Text className="text-white text-lg font-bold">-</Text>
          </View>
        </TouchableOpacity>
        <Text className="text-lg w-10 text-center">{value}</Text>
        <TouchableOpacity onPress={() => setValue(value + 1)}>
          <View className="bg-main rounded w-8 h-8 flex items-center justify-center">
            <Text className="text-white text-lg font-bold">+</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, "SERVICES">;
const Services = ({ navigation, route }: Props) => {
  const groupedServices = useAtomValue(servicesSelector);
  const { date } = route.params;
  const organisation = useAtomValue(organisationState)!;
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);
  const currentTeam = useAtomValue(currentTeamState)!;
  const [services, setServices] = useState<Array<ServiceToShow>>([]);
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

  const renderItem = ({ item: service }: { item: ServiceToShow }) => {
    return (
      <IncrementorSmall
        service={service}
        date={date}
        team={currentTeam._id}
        initialValue={service?.count || 0}
        onUpdated={(newCount) => {
          if (services.find((e) => e.service === service.service)) {
            setServices(services.map((e) => (e.service === service.service ? { ...e, count: newCount } : e)));
          } else {
            setServices([...services, { service: service.service, count: newCount, _id: service._id } as ServiceToShow]);
          }
          return;
        }}
      />
    );
  };

  if (!organisation.receptionEnabled || !groupedServices.length) return null;

  const selectedServices: Array<ServiceToShow> = (groupedServices.find((e) => e.groupTitle === activeTab)?.services || []).map((e) => {
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
              <View className={`p-3 bg-white ${group.groupTitle === activeTab ? "border-b-green-700 border-b-4" : ""}`}>
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
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={ListEmptyServices}
        ListFooterComponent={null}
      />
    </SceneContainer>
  );
};

export default Services;
