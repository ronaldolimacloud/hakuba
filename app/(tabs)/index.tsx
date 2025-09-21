import { useCallback } from 'react';
import { ActivityIndicator, Alert, Button, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '../../providers/AuthProvider';

export default function Home() {
  const router = useRouter();
  const { user, status, signOut } = useAuth();

  const loading = status === 'loading';
  const authenticated = status === 'authenticated' && !!user;

  const handleNavigateToAuth = useCallback(() => {
    router.push('/auth');
  }, [router]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert('Sign-out failed', error?.message ?? 'Unable to sign out at the moment.');
    }
  }, [signOut]);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: 'white' }]}>Welcome to Hakuba!!</Text>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Checking your session…</Text>
        </View>
      )}

      {authenticated && user && (
        <View style={styles.userInfo}>
          <Text style={styles.userText}>Signed in as:</Text>
          <Text style={styles.email}>{user.name ?? user.email ?? user.sub}</Text>
          {user.email && <Text style={styles.userId}>{user.email}</Text>}
        </View>
      )}

      <View style={styles.buttonContainer}>
        {!authenticated && !loading && (
          <View style={styles.signInButtons}>
            <Button title="Sign in or create account" onPress={handleNavigateToAuth} color="#0a84ff" />
          </View>
        )}
        {authenticated && <Button title="Sign Out" onPress={handleSignOut} />}
      </View>

      {!authenticated && !loading && (
        <Text style={styles.helperText}>
          Use your username and password to sign in, sign up for a new account, or reset your password.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  userInfo: {
    backgroundColor: '#1c1c1e',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  userText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#fff',
  },
  email: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  userId: {
    fontSize: 12,
    color: '#999',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 220,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  signInButtons: {
    gap: 10,
  },
  helperText: {
    marginTop: 20,
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
});
