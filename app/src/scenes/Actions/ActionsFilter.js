import React, { useState } from 'react';
import ScrollContainer from '../../components/ScrollContainer';
import SceneContainer from '../../components/SceneContainer';
import ScreenTitle from '../../components/ScreenTitle';
import ActionCategoriesModalSelect from '../../components/ActionCategoriesModalSelect';

const ActionsFilter = ({ route, navigation }) => {
  const [filterCategories, setFilterCategories] = useState(route.params?.filters?.filterCategories || []);

  const onBackRequested = () => {
    navigation.navigate('ActionsList', {
      filters: { filterCategories },
      merge: true,
    });
  };

  return (
    <SceneContainer>
      <ScreenTitle title="Filtres" onBack={onBackRequested} />
      <ScrollContainer>
        <ActionCategoriesModalSelect values={filterCategories} onChange={setFilterCategories} editable withMostUsed />
      </ScrollContainer>
    </SceneContainer>
  );
};

export default ActionsFilter;
