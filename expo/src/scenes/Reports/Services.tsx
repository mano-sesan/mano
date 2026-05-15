import { useAtomValue } from "jotai";
import React, { useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import { FlashListStyled } from "../../components/Lists";
import { ListEmptyServices } from "../../components/ListEmptyContainer";
import { getPeriodTitle } from "./utils";
import { currentTeamState, organisationState } from "../../atoms/auth";
import API from "../../services/api";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { filterServicesForTeam, servicesSelector } from "../../atoms/reports";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { ServiceInstance } from "@/types/service";
import { useDataLoader } from "@/services/dataLoader";

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

      API.post({ path: `/service/team/${team}/date/${date}`, body: { count: _value, service: service.service } }).then((response) => {
        if (!response.ok) {
          if (response.error) {
            Alert.alert("Erreur lors de la mise à jour du service");
          }
          return;
        }
        onUpdated(response.data.count);
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
  const allGroupedServices = useAtomValue(servicesSelector);
  const { date } = route.params;
  const organisation = useAtomValue(organisationState)!;
  const currentTeam = useAtomValue(currentTeamState)!;
  const groupedServices = useMemo(() => filterServicesForTeam(allGroupedServices, currentTeam?._id), [allGroupedServices, currentTeam?._id]);
  const [services, setServices] = useState<Array<ServiceToShow>>([]);
  const [activeTab, setActiveTab] = useState<string | null>(groupedServices[0]?.groupTitle || null);
  const { refresh, isLoading } = useDataLoader();

  // Si l'équipe change et que l'onglet sélectionné disparaît de la liste filtrée, on retombe sur le
  // premier groupe disponible pour éviter une liste vide.
  useEffect(() => {
    if (!groupedServices.find((g) => g.groupTitle === activeTab)) {
      setActiveTab(groupedServices[0]?.groupTitle || null);
    }
  }, [groupedServices, activeTab]);

  useEffect(() => {
    async function initServices() {
      const response = await API.get({ path: `/service/team/${currentTeam._id}/date/${date}` });
      if (!response.ok) {
        if (response.error) {
          Alert.alert(response.error);
        }
        return;
      }
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

  const selectedServices: Array<ServiceToShow> = (groupedServices.find((e) => e.groupTitle === activeTab)?.services || []).map((item) => {
    const service = (services || []).find((f) => f.service === item.name);
    return { service: item.name, _id: service?._id || item.name, count: service?.count || 0 };
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
        refreshing={isLoading}
        onRefresh={refresh}
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
