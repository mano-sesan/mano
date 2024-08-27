import React from 'react';
import { Platform } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import SceneContainer from '../../components/SceneContainer';
import ScreenTitle from '../../components/ScreenTitle';
import ActionsList from './ActionsList';
import Tabs from '../../components/Tabs';
import { CANCEL, DONE, TODO } from '../../recoil/actions';
const TabNavigator = createMaterialTopTabNavigator();

const ActionsTabNavigator = () => {
  return (
    <SceneContainer>
      <TabNavigator.Navigator
        // See: https://github.com/react-navigation/react-navigation/issues/11590
        // eslint-disable-next-line react/no-unstable-nested-components
        tabBar={(props) => (
          <>
            <ScreenTitle title="Agenda" />
            <Tabs numberOfTabs={3} forceTop {...props} />
          </>
        )}
        removeClippedSubviews={Platform.OS === 'android'}
        screenOptions={{ swipeEnabled: true }}>
        <TabNavigator.Screen lazy name={TODO} options={{ tabBarLabel: 'À Faire' }} component={ActionsList} initialParams={{ status: TODO }} />
        <TabNavigator.Screen lazy name={DONE} options={{ tabBarLabel: 'Faites' }} component={ActionsList} initialParams={{ status: DONE }} />
        <TabNavigator.Screen lazy name={CANCEL} options={{ tabBarLabel: 'Annulées' }} component={ActionsList} initialParams={{ status: CANCEL }} />
      </TabNavigator.Navigator>
    </SceneContainer>
  );
};

export default ActionsTabNavigator;
