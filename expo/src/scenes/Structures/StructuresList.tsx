import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useAtom } from "jotai";
import API from "../../services/api";
import { PersonIcon } from "../../icons";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import Row from "../../components/Row";
import Spinner from "../../components/Spinner";
import { ListEmptyStructures } from "../../components/ListEmptyContainer";
import FloatAddButton from "../../components/FloatAddButton";
import { FlashListStyled } from "../../components/Lists";
import { structuresState } from "../../recoil/structures";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { StructureInstance } from "@/types/structure";

type Props = NativeStackScreenProps<RootStackParamList, "STRUCTURES">;
const Structures = ({ navigation }: Props) => {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [structures, setStructures] = useAtom(structuresState);

  const getStructures = async (refresh = true) => {
    if (refresh) setRefreshing(true);
    const response = await API.get({ path: "/structure" });
    setRefreshing(false);
    setLoading(false);
    if (response.error) Alert.alert(response.error);
    if (response.ok) setStructures(response.data);
  };

  useEffect(() => {
    getStructures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreateStructureRequest = () => navigation.navigate("STRUCTURE_NEW");

  const keyExtractor = (structure: StructureInstance) => structure._id;
  const renderRow = ({ item: structure }: { item: StructureInstance }) => {
    const { name } = structure;
    return <Row withNextButton onPress={() => navigation.push("STRUCTURE", { structure })} caption={name} />;
  };
  return (
    <SceneContainer>
      <ScreenTitle title="Contacts" onBack={navigation.goBack} />
      <FlashListStyled
        refreshing={refreshing}
        onRefresh={getStructures}
        key={JSON.stringify(structures)}
        data={structures}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        ListEmptyComponent={loading ? Spinner : ListEmptyStructures}
      />
      <FloatAddButton onPress={onCreateStructureRequest} />
    </SceneContainer>
  );
};

export default Structures;
