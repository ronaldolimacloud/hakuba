import * as AppleColors from '@bacons/apple-colors';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Rounded } from '../../../components/ui/rounded';
import { createTrip as createTripMutation, deleteTrip as deleteTripMutation, listTripsByUser } from '../../../lib/appsyncApi';
import type { Trip as TripType } from '../../../lib/appsyncTypes';
import { getAwsConfig } from '../../../lib/awsConfig';
import { useAuth } from '../../../providers/AuthProvider';
import { ErrorHandler, withRetry } from '../../../utils/errorHandling';

export default function Trip() {
  const awsConfig = useMemo(() => getAwsConfig(), []);
  const isBackendConfigured = Boolean(awsConfig.appSyncUrl);
  const { user, tokens } = useAuth();
  const [trips, setTrips] = useState<TripType[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [isOnline, setIsOnline] = useState(true);

  const userSub = user?.sub ?? null;

  const refreshTrips = useMemo(() => {
    if (!isBackendConfigured) {
      return async () => undefined;
    }

    return withRetry(async () => {
      if (!userSub) {
        setTrips([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await listTripsByUser(userSub, tokens ?? null);
        setTrips(response);
      } finally {
        setLoading(false);
      }
    }, 'refresh-trips', 'loading trips');
  }, [isBackendConfigured, tokens, userSub]);

  useEffect(() => {
    if (!isBackendConfigured) {
      setLoading(false);
      return;
    }

    refreshTrips().catch((error) => {
      if (error) {
        ErrorHandler.showError(error, 'Failed to Load Trips', 'loading trips');
      }
    });
  }, [isBackendConfigured, refreshTrips]);

  useEffect(() => {
    if (!isBackendConfigured) {
      return () => undefined;
    }

    const unsubscribe = ErrorHandler.setupNetworkListener(
      () => {
        setIsOnline(true);
        refreshTrips().catch(() => undefined);
      },
      () => {
        setIsOnline(false);
        ErrorHandler.showNetworkStatus(false);
      }
    );
    return unsubscribe;
  }, [isBackendConfigured, refreshTrips]);

  const createTrip = useCallback(async () => {
    if (!isBackendConfigured) {
      Alert.alert(
        'Backend Not Configured',
        'Trip planner requires EXPO_PUBLIC_APPSYNC_URL (and related Expo env vars). Update your environment configuration before creating trips.'
      );
      return;
    }

    if (!userSub) {
      Alert.alert('Sign in required', 'Please sign in before creating a trip.');
      return;
    }
    const trimmedName = newTripName.trim();
    if (!trimmedName) {
      Alert.alert('Missing Information', 'Please enter a trip name');
      return;
    }

    setNewTripName('');

    try {
      const created = await createTripMutation({ name: trimmedName }, tokens ?? null);
      setTrips((prev) => [created, ...prev]);
      router.push({ pathname: '/(tabs)/trip/[trip]', params: { trip: created.id } });
    } catch (error) {
      ErrorHandler.showError(error, 'Failed to Create Trip', 'creating trip');
    }
  }, [isBackendConfigured, newTripName, tokens, userSub]);

  const deleteTrip = useCallback(
    (tripId: string) => {
      if (!isBackendConfigured) {
        Alert.alert(
          'Backend Not Configured',
          'Trip planner requires EXPO_PUBLIC_APPSYNC_URL (and related Expo env vars). Update your environment configuration before deleting trips.'
        );
        return;
      }

      Alert.alert('Delete Trip', 'Are you sure you want to delete this trip?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTripMutation(tripId, tokens ?? null);
              setTrips((prev) => prev.filter((trip) => trip.id !== tripId));
            } catch (error) {
              ErrorHandler.showError(error, 'Failed to Delete Trip', 'deleting trip');
            }
          },
        },
      ]);
    },
    [isBackendConfigured, tokens]
  );

  if (!isBackendConfigured) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 12 }}>
          Planner backend isn't configured for this build.
        </Text>
        <Text style={{ color: '#999', fontSize: 13, textAlign: 'center' }}>
          Set EXPO_PUBLIC_APPSYNC_URL and related Expo environment variables (or update expo.extra) before using the Planner tab.
        </Text>
      </View>
    );
  }

  if (!userSub) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center' }}>
          Sign in to view and manage your trips.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator color="white" />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: '#000' }}>
      {!isOnline && (
        <View
          style={{
            backgroundColor: '#ff6b6b',
            paddingVertical: 8,
            paddingHorizontal: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 14, fontWeight: '500' }}>No internet connection</Text>
        </View>
      )}

      <View style={{ paddingVertical: 16, paddingHorizontal: 16, gap: 24 }}>
        <Rounded padding style={{ backgroundColor: '#1c1c1e' }}>
          <Text
            style={{
              color: '#666',
              fontSize: 12,
              textTransform: 'uppercase',
              marginBottom: 12,
              fontWeight: '600',
            }}
          >
            Create New Trip
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={newTripName}
              onChangeText={setNewTripName}
              placeholder="Trip name"
              placeholderTextColor="#666"
              style={{
                flex: 1,
                borderRadius: 10,
                backgroundColor: '#2c2c2e',
                paddingHorizontal: 16,
                color: '#fff',
                height: 44,
              }}
            />
            <Pressable
              onPress={createTrip}
              style={{
                backgroundColor: AppleColors.systemBlue,
                paddingHorizontal: 20,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Create</Text>
            </Pressable>
          </View>
        </Rounded>

        <View style={{ gap: 16 }}>
          {trips.map((trip) => (
            <Pressable
              key={trip.id}
              onPress={() => router.push({ pathname: '/(tabs)/trip/[trip]', params: { trip: trip.id } })}
              onLongPress={() => deleteTrip(trip.id)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Rounded padding style={{ backgroundColor: '#1c1c1e' }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 4 }}>
                  {trip.name}
                </Text>
                <Text style={{ color: '#999', fontSize: 12 }}>Owners: {trip.owners.length}</Text>
              </Rounded>
            </Pressable>
          ))}

          {trips.length === 0 && (
            <Text style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>
              No trips yet. Create one to get started!
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
