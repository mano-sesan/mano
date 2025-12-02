import React from "react";
import ScrollContainer from "../../components/ScrollContainer";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import ActionCategoriesModalSelect from "../../components/ActionCategoriesModalSelect";
import { actionsFiltersState } from "../../recoil/actions";
import { useRecoilState } from "recoil";

const ActionsFilter = ({ navigation }) => {
  const [actionsFilters, setActionsFilters] = useRecoilState(actionsFiltersState);

  const onBackRequested = () => {
    navigation.navigate("ActionsList");
  };

  return (
    <SceneContainer>
      <ScreenTitle title="Filtres" onBack={onBackRequested} />
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
