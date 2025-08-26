import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import type { Schema } from "../../../amplify/data/resource";

// Amplify is already configured in _layout.tsx with REST API support

export default function Trip() {
  const [userSub, setUserSub] = useState<string | null>(null);
  const [trips, setTrips] = useState<Schema["Trip"]["type"][]>([]);
  const [loading, setLoading] = useState(true);
  const [newTripName, setNewTripName] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  // Generate client inside component to ensure Amplify is configured
  const client = generateClient<Schema>();

  useEffect(() => {
    (async () => {
      try {
        const u = await getCurrentUser();
        setUserSub(u.userId);
        await refresh(u.userId);
      } catch (error) {
        console.error('User not authenticated:', error);
        setUserSub(null);
        await refresh(null);
      }
    })();
  }, []);

  async function refresh(uid?: string | null) {
    const id = uid ?? userSub;
    if (!id) {
      setTrips([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const result = await client.models.Trip.list({
        filter: { owners: { contains: id } },
        limit: 200,
      });

      setTrips(result.data ?? []);
    } catch (error) {
      console.error('Failed to load trips:', error);
      Alert.alert('Error', 'Failed to load trips. Please try again.');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }

  async function createTrip() {
    if (!userSub) return;
    
    const name = newTripName.trim();
    if (!name) {
      Alert.alert('Missing Information', 'Please enter a trip name');
      return;
    }
    
    try {
      const created = await client.models.Trip.create({
        name,
        owners: [userSub],
        admins: [userSub],
        createdBy: userSub,
      });
      
      const tripId = created.data?.id;
      if (tripId) {
        // Create a default list so the trip screen has one to show
        await client.models.List.create({
          tripId,
          name: "General",
          createdBy: userSub,
          owners: [userSub],
        });
        
        setNewTripName("");
        await refresh();
        router.push({ pathname: "/(tabs)/trip/[trip]", params: { trip: tripId } });
      }
    } catch (error) {
      console.error('Failed to create trip:', error);
      Alert.alert('Error', 'Failed to create trip. Please try again.');
    }
  }

  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <TextInput
          placeholder="New trip name"
          value={newTripName}
          onChangeText={setNewTripName}
          style={{ flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 6, paddingHorizontal: 10, height: 40 }}
        />
        <Pressable onPress={createTrip} style={{ backgroundColor: "#111827", paddingHorizontal: 14, justifyContent: "center", borderRadius: 6 }}>
          <Text style={{ color: "white", fontWeight: "600" }}>Create</Text>
        </Pressable>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(t) => t.id ?? t.name}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/(tabs)/trip/[trip]", params: { trip: item.id! } })}
            style={{ padding: 14, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8 }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>{item.name}</Text>
            <Text style={{color: "grey", opacity: 0.7, marginTop: 4 }}>Members: {item.owners?.length ?? 1}</Text>
          </Pressable>
        )}
        ListEmptyComponent={() => (
          <View style={{ paddingTop: 40, alignItems: "center" }}>
            <Text>No trips yet. Create your first one above.</Text>
          </View>
        )}
      />
    </View>
  );
}