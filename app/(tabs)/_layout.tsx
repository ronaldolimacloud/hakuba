import { Ionicons } from "@expo/vector-icons";
import { router, Tabs } from "expo-router";
import { Image, Pressable } from "react-native";


export default function Layout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />, title: "Home" }} />
      <Tabs.Screen
        name="hakuba"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Image
            
              source={require("../../assets/icons/hakuba.png")}
              style={{ width: 35, height: 35, tintColor: color }}
              resizeMode="contain"
            />
          ),
          title: "Hakuba"
        }}
      />
      <Tabs.Screen
        name="travel"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="airplane" size={size} color={color} />
          ),
          headerShown: true,
          headerRight: () => (
            <Pressable
              onPress={() => {
                router.push("../(modals)/settings");
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.5 : 1,
                marginRight: 16,
              })}
            >
              <Ionicons name="settings-sharp" size={24} color="white" />
            </Pressable>
          ),
          title: "Travel"
        }}
      />
      <Tabs.Screen name="viajando" options={{ tabBarIcon: ({ color, size }) => <Ionicons name="airplane" size={size} color={color} />, title: "Viajando" }} />
      <Tabs.Screen
        name="trip"
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="book-sharp" size={size} color={color} />,
          title: "Planner",
          headerShown: false,
        }}
      />
    </Tabs>
  )
}