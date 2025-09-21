import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import '../lib/polyfills';

import hakubaTheme from '../components/ThemeProvider';
import { AuthProvider, useAuth } from '../providers/AuthProvider';

function AppHeader() {
  return (
    <View
      style={{
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 5,
        backgroundColor: 'transparent',
      }}
    >
      <Image
        source={require('../assets/icons/hakubawhite.png')}
        style={{ width: 40, height: 40 }}
        resizeMode="stretch"
        accessible
        accessibilityLabel="Hakuba logo"
      />
      <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>Hakuba App</Text>
    </View>
  );
}

function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={{ color: '#fff', marginTop: 16 }}>Checking your session…</Text>
      </View>
    );
  }

  if (status !== 'authenticated') {
    return (
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="auth/index" />
      </Stack>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: 'Hakuba App',
        headerRight: () => (
          <Pressable
            onPress={() => {
              router.push('/settingsao');
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
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: true,
          headerTitle: () => <AppHeader />,
        }}
      />
      <Stack.Screen name="settingsao" options={{ presentation: 'modal', headerRight: () => null }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NavigationThemeProvider value={hakubaTheme}>
        <RootNavigator />
      </NavigationThemeProvider>
    </AuthProvider>
  );
}
