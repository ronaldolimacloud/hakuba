import * as AppleColors from "@bacons/apple-colors";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { Schema } from "../../../amplify/data/resource";
import { Rounded } from "../../../components/ui/rounded";

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

  if (loading) return <View style={{ flex: 1, justifyContent: "center", backgroundColor: '#000' }}><ActivityIndicator color="white" /></View>;

  return (
    <ScrollView style={{ backgroundColor: '#000' }}>
      <View style={{ paddingVertical: 16, paddingHorizontal: 16, gap: 24 }}>
        
        {/* Create Trip Card */}
        <Rounded 
          padding 
          style={{ backgroundColor: '#1c1c1e' }}
        >
          <Text style={{ 
            color: '#666', 
            fontSize: 12, 
            textTransform: 'uppercase', 
            marginBottom: 12,
            fontWeight: '600'
          }}>
            CREATE NEW TRIP
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              placeholder="New trip name"
              placeholderTextColor="#666"
              value={newTripName}
              onChangeText={setNewTripName}
              style={{ 
                flex: 1, 
                borderWidth: 0.5, 
                borderColor: '#333', 
                borderRadius: 6, 
                paddingHorizontal: 10, 
                height: 40, 
                color: 'white',
                backgroundColor: '#2c2c2e',
              }}
            />
            <Pressable 
              onPress={createTrip} 
              style={{ 
                backgroundColor: AppleColors.systemBlue, 
                paddingHorizontal: 16, 
                justifyContent: "center", 
                borderRadius: 6 
              }}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>Create</Text>
            </Pressable>
          </View>
        </Rounded>

        {/* Trips List */}
        <View>
          <Text style={{ 
            color: '#666', 
            fontSize: 12, 
            textTransform: 'uppercase', 
            marginBottom: 12,
            paddingHorizontal: 4,
            fontWeight: '600'
          }}>
            YOUR TRIPS
          </Text>
          
          {trips.length === 0 ? (
            <Rounded 
              padding 
              style={{ backgroundColor: '#1c1c1e' }}
            >
              <View style={{ padding: 16, alignItems: "center" }}>
                <Text style={{ 
                  color: '#999', 
                  fontSize: 16, 
                  fontWeight: "500",
                  textAlign: "center",
                }}>
                  No trips yet
                </Text>
                <Text style={{ 
                  color: '#666', 
                  fontSize: 14, 
                  marginTop: 4,
                  textAlign: "center",
                }}>
                  Create your first trip above
                </Text>
              </View>
            </Rounded>
          ) : (
            trips.map((item, index) => (
              <View key={item.id ?? item.name} style={{ marginBottom: 12 }}>
                <Rounded 
                  padding 
                  style={{ backgroundColor: '#1c1c1e' }}
                >
                  <Pressable
                    onPress={() => router.push({ pathname: "/(tabs)/trip/[trip]", params: { trip: item.id! } })}
                    style={{ paddingVertical: 4 }}
                  >
                    <Text style={{ color: "white", fontWeight: "600", fontSize: 16, marginBottom: 4 }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: "#999", fontSize: 14 }}>
                      Members: {item.owners?.length ?? 1}
                    </Text>
                  </Pressable>
                </Rounded>
              </View>
            ))
          )}
        </View>

      </View>
    </ScrollView>
  );
}