import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "./screens/HomeScreen";
import MyZoneScreen from "./screens/MyZoneScreen";
import ReportScreen from "./screens/ReportScreen";
import { Colors } from "./constants/theme";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, size }) => {
            let iconName;
            if (route.name === "All Zones") {
              iconName = "grid";
            } else if (route.name === "My Zone") {
              iconName = "location";
            } else if (route.name === "Report") {
              iconName = "warning";
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            paddingTop: 5,
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            paddingBottom: 5,
          },
        })}
      >
        <Tab.Screen name="All Zones" component={HomeScreen} />
        <Tab.Screen name="My Zone" component={MyZoneScreen} />
        <Tab.Screen name="Report" component={ReportScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
