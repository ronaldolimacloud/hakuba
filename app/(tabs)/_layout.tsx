import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function Layout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />, title: "Home" }} />
      <Tabs.Screen
        name="trip"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="airplane" size={size} color={color} />
          ),
          title: "Trips"
        }}
      />
    </Tabs>
  )
}
