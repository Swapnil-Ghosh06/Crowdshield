import React from "react";
import { View, StyleSheet } from "react-native";
import HomeScreen from "./screens/HomeScreen";
import { Colors } from "./constants/theme";

export default function App() {
  return (
    <View style={styles.root}>
      <HomeScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
});
