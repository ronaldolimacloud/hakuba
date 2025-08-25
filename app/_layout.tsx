import { ThemeProvider as AmplifyThemeProvider, Authenticator } from "@aws-amplify/ui-react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { Amplify } from "aws-amplify";
import { autoSignIn } from "aws-amplify/auth";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { Image, Pressable, Text, View } from "react-native";
import hakubaTheme from "../components/ThemeProvider";

import outputs from "../amplify_outputs.json";

Amplify.configure(outputs);

function MyHeader() {
  return (
    <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 5, backgroundColor: "transparent" }}>
      <Image
        source={require("../assets/icons/hakubawhite.png")}
        style={{ width: 120, height: 120 }}
        resizeMode="contain"
        accessible
        accessibilityLabel="App logo"
      />
      <Text style={{ color: "white", fontSize: 20, fontWeight: "bold" }}>Hakuba App</Text>
    </View>
  );
}




const theme = hakubaTheme;

// Amplify UI dark theme tokens for the Authenticator
const amplifyDarkTheme: any = {
  tokens: {
    colors: {
      primary: {
        10: "#f5f5f5",
        20: "#e5e5e5",
        40: "#cccccc",
        60: "#999999",
        80: "#666666",
        90: "#4d4d4d",
        100: theme.colors.primary,
      },
      font: {
        primary: "#ffffff",
        secondary: "#d1d1d1",
        tertiary: "#a3a3a3",
      },
      background: {
        primary: "#000000",
      },
    },
  },
};

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
    <AmplifyThemeProvider theme={amplifyDarkTheme}>
      <Authenticator.Provider>
        <Authenticator
          Container={(props) => (
            <Authenticator.Container {...props} style={{ backgroundColor: "transparent" }} />
          )}
          Header={MyHeader}
        >
    <NavigationThemeProvider value={theme}>
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
    </NavigationThemeProvider>
        </Authenticator>
      </Authenticator.Provider>
    </AmplifyThemeProvider>
  );
}
