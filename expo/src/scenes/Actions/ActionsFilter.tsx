import React from "react";
import ScrollContainer from "../../components/ScrollContainer";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import ActionCategoriesModalSelect from "../../components/ActionCategoriesModalSelect";
import { actionsFiltersState } from "../../recoil/actions";
import { useAtom } from "jotai";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";

type ActionsFilterProps = NativeStackScreenProps<RootStackParamList, "ACTIONS_FILTER">;

const ActionsFilter = ({ navigation }: ActionsFilterProps) => {
  const [actionsFilters, setActionsFilters] = useAtom(actionsFiltersState);

  return (
    <SceneContainer>
      <ScreenTitle title="Filtres" onBack={navigation.goBack} />
      <ScrollContainer>
        <ActionCategoriesModalSelect
          values={actionsFilters.categories}
          onChange={(categories) => {
            setActionsFilters({ ...actionsFilters, categories });
          }}
          editable
        />
      </ScrollContainer>
    </SceneContainer>
  );
};

export default ActionsFilter;
