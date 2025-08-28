import { Stack } from "expo-router";

export default function TripLayout() {
  return <Stack 
  screenOptions={{
    headerShown: true,
    headerTitle: "Planner",
    headerStyle: {
      backgroundColor: '#000',
    },
    headerTintColor: 'white',
    headerTitleStyle: {
      color: 'white',
      fontWeight: '600',
    },
  }}
  />;
}