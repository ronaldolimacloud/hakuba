import { Authenticator } from "@aws-amplify/ui-react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeProvider } from "@react-navigation/native";
import { Amplify } from "aws-amplify";
import { autoSignIn } from "aws-amplify/auth";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { Pressable } from "react-native";
import hakubaTheme from "../components/ThemeProvider";

import outputs from "../amplify_outputs.json";

Amplify.configure(outputs);




const theme = hakubaTheme;

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      try {
        await autoSignIn();
      } catch (e) {
        // no-op: autoSignIn is best-effort and only applies when enabled during signUp
      }
    })();
  }, []);
  return (
    <Authenticator.Provider>
      <Authenticator>
    <ThemeProvider value={theme}>
      <Stack
        screenOptions={{
          headerShown: true,
          headerRight: () => (
            <Pressable
              onPress={() => {
                router.push("/settingsao");
                // Add your onPress logic here, e.g., navigate to settings
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.5 : 1,
                marginRight: 16,
              })}
            >
              <Ionicons name="settings-sharp" size={24} color="white" />
            </Pressable>
          ),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: true, headerTitle: "Hakuba App" }} />
        <Stack.Screen
          name="settingsao"
          options={{ presentation: "modal", headerRight: () => null }}
        />
      </Stack>
    </ThemeProvider>
    </Authenticator>
    </Authenticator.Provider>
  );
}
