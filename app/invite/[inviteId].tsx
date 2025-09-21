import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import InviteHandler from '../../components/InviteHandler';

export default function InviteRoute() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string }>();

  useEffect(() => {
    console.log('Invite route accessed with ID:', inviteId);
  }, [inviteId]);

  if (!inviteId) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Invalid invitation link</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#667eea" />
      <Text style={styles.loadingText}>Processing invitation...</Text>
      <InviteHandler inviteId={inviteId as string} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    textAlign: 'center',
  },
});