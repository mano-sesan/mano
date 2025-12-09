// app/src/scenes/Actions/ActionsTabNavigator.js
import React, { useState } from "react";
import { Platform, View, TouchableOpacity, Animated } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import ActionsList from "./ActionsList";
import Tabs from "../../components/Tabs";
import { actionsFiltersState, CANCEL, DONE, TODO } from "../../recoil/actions";
import { INCOMINGDAYS, PASSED, TODAY } from "../../recoil/selectors";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAtomValue } from "jotai";

const TopTab = createMaterialTopTabNavigator();
const SubTab = createMaterialTopTabNavigator();

function MyTabBar({ state, descriptors, navigation, position }) {
  return (
    <View
      className="flex-row"
      // style={{ flexDirection: 'row', backgroundColor: '#f1f1f1', borderRadius: 25, padding: 4 }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel !== undefined ? options.tabBarLabel : options.title !== undefined ? options.title : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
        };

        const inputRange = state.routes.map((_, i) => i);
        const opacity = position.interpolate({
          inputRange,
          outputRange: inputRange.map((i) => (i === index ? 1 : 0.5)),
        });

        return (
          <TouchableOpacity
            key={index}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            className="flex-1 justify-center items-center py-2"
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              // textDecoration: isFocused ? 'underline' : 'none',
              borderBottomWidth: isFocused ? 2 : 0,
            }}
          >
            <Animated.Text
              // eslint-disable-next-line react-native/no-inline-styles
              style={{
                color: isFocused ? "#000" : "#000",
                fontWeight: isFocused ? "bold" : "normal",
                opacity,
              }}
            >
              {label}
            </Animated.Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const TodoNavigator = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <SubTab.Navigator
      id="todo"
      // we NEED this custom tab bar because there is a bug in the underline of the default tab bar
      // https://github.com/react-navigation/react-navigation/issues/12052
      tabBar={MyTabBar}
      initialRouteName={TODAY}
      screenListeners={{
        focus: (e) => {
          console.log("Focused tab:", e.target);
          setActiveTab(e.target);
        },
      }}
      screenOptions={{
        // swipeEnabled: true,
        tabBarItemStyle: {
          flexShrink: 1,
          borderColor: "transparent",
          borderWidth: 1,
        },
        tabBarLabelStyle: {
          textTransform: "none",
        },
        tabBarContentContainerStyle: {
          flex: 1,
          borderColor: "red",
          borderWidth: 3,
        },
      }}
    >
      <SubTab.Screen
        options={{ tabBarLabel: "Passées", lazy: true }}
        name={PASSED}
        component={ActionsList}
        initialParams={{ status: TODO, timeframe: PASSED }}
      />
      <SubTab.Screen
        options={{ tabBarLabel: "Aujourd'hui", lazy: true }}
        name={TODAY}
        component={ActionsList}
        initialParams={{ status: TODO, timeframe: TODAY }}
      />
      <SubTab.Screen
        options={{ tabBarLabel: "À venir", lazy: true }}
        name={INCOMINGDAYS}
        component={ActionsList}
        initialParams={{ status: TODO, timeframe: INCOMINGDAYS }}
      />
    </SubTab.Navigator>
  );
};

const ActionsTabBar = (props) => {
  const actionsFilters = useAtomValue(actionsFiltersState);
  const { key, ...rest } = props;
  const navigation = useNavigation();
  const route = useRoute();
  const numberOfFilters = actionsFilters.categories?.length || 0;

  const onFiltersPress = () => navigation.push("ActionsFilter", route.params);

  return (
    <>
      <ScreenTitle title="Agenda" customRight={`Filtres (${numberOfFilters})`} onPressRight={onFiltersPress} />
      <Tabs numberOfTabs={3} forceTop key={key} {...rest} />
    </>
  );
};

const ActionsTabNavigator = () => {
  return (
    <SceneContainer>
      <TopTab.Navigator tabBar={ActionsTabBar} removeClippedSubviews={Platform.OS === "android"} screenOptions={{ swipeEnabled: true }}>
        <TopTab.Screen name={TODO} options={{ tabBarLabel: "À Faire" }} component={TodoNavigator} />
        <TopTab.Screen
          name={DONE}
          options={{ tabBarLabel: "Terminées" }}
          component={ActionsList}
          initialParams={{
            status: DONE,
            timeframe: PASSED,
          }}
        />
        <TopTab.Screen
          name={CANCEL}
          options={{ tabBarLabel: "Annulées" }}
          component={ActionsList}
          initialParams={{
            status: CANCEL,
            timeframe: PASSED,
          }}
        />
      </TopTab.Navigator>
    </SceneContainer>
  );
};

export default ActionsTabNavigator;
