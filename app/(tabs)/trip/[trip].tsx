import { Ionicons } from "@expo/vector-icons";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import type { Schema } from "../../../amplify/data/resource";
import ShareTripModal from "../../../components/ShareTripModal";

// Amplify is already configured in _layout.tsx with REST API support

const client = generateClient<Schema>();

export default function TripScreen() {
  const { trip } = useLocalSearchParams<{ trip: string }>();
  const [userSub, setUserSub] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [lists, setLists] = useState<Schema["List"]["type"][]>([]);
  const [items, setItems] = useState<Schema["ListItem"]["type"][]>([]);
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState("");
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [tripData, setTripData] = useState<Schema["Trip"]["type"] | null>(null);

  // Initialize user and load trip data
  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      setUserSub(u.userId);

      // Invitation handling is now simplified through the TripInvitation model

      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setLoading(true);
    
    // Load trip data
    const tripResult = await client.models.Trip.get({ id: trip as string });
    setTripData(tripResult.data);
    
    // Load lists for this trip, then load items (simple example assumes one list per trip)
    const listsResp = await client.models.List.list({ filter: { tripId: { eq: trip as string } } });
    const allLists = listsResp.data ?? [];
    setLists(allLists);
    const selectedListId = allLists?.[0]?.id;
    setListId(selectedListId ?? null);
    if (!selectedListId) { setItems([]); setLoading(false); return; }

    const { data } = await client.models.ListItem.list({
      filter: { listId: { eq: selectedListId } },
      limit: 200,
    });
    setItems(data ?? []);
    setLoading(false);
  }

  // Simple real-time subscriptions - let Amplify handle the complexity
  useEffect(() => {
    if (!listId) return;

    const subscription = client.models.ListItem.observeQuery({
      filter: { listId: { eq: listId } }
    }).subscribe({
      next: ({ items }) => {
        setItems(items);
      },
      error: (error) => {
        console.error('Subscription error:', error);
        // Amplify will handle reconnection automatically
      }
    });

    return () => subscription.unsubscribe();
  }, [listId]);

  async function toggleLike(item: Schema["ListItem"]["type"]) {
    if (!userSub) return;
    
    const isLiked = item.likedBy?.includes(userSub) ?? false;
    const newLikedBy = isLiked 
      ? (item.likedBy ?? []).filter(id => id !== userSub)
      : [...(item.likedBy ?? []), userSub];
    
    try {
      await client.models.ListItem.update({
        id: item.id,
        likedBy: newLikedBy,
        voteCount: (item.voteCount ?? 0) + (isLiked ? -1 : 1),
      });
      // Real-time subscription will update the UI automatically
    } catch (error) {
      console.error('Failed to toggle like:', error);
      Alert.alert("Error", "Failed to update like. Please try again.");
    }
  }

  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {/* List picker and creation */}
      <View style={{ marginBottom: 12 }}>
        <FlatList
          data={lists}
          horizontal
          keyExtractor={(l) => l.id ?? l.name}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setListId(item.id ?? null)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: (item.id === listId ? "#111827" : "#e5e7eb"),
                backgroundColor: (item.id === listId ? "#111827" : "white"),
              }}
            >
              <Text style={{ color: (item.id === listId ? "white" : "#111827"), fontWeight: "600" }}>{item.name}</Text>
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <Text style={{ opacity: 0.7 }}>No lists yet. Create one below.</Text>
          )}
          showsHorizontalScrollIndicator={false}
        />

        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <TextInput
            placeholder="New list name"
            value={newListName}
            onChangeText={setNewListName}
            style={{ flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 6, paddingHorizontal: 10, height: 40 }}
          />
          <Pressable
            onPress={async () => {
              if (!userSub) return;
              const name = newListName.trim();
              if (!name) { Alert.alert("Please enter a list name"); return; }
              try {
                const created = await client.models.List.create({
                  tripId: trip as string,
                  name,
                  createdBy: userSub,
                });
                setNewListName("");
                await refresh();
                const createdId = created.data?.id ?? null;
                if (createdId) setListId(createdId);
              } catch (e: any) {
                Alert.alert("Failed to create list", e?.message || String(e));
              }
            }}
            style={{ backgroundColor: "#111827", paddingHorizontal: 14, justifyContent: "center", borderRadius: 6 }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>Add</Text>
          </Pressable>
        </View>
      </View>

      {/* Share trip with others */}
      <View style={{ marginBottom: 12 }}>
        <Pressable
          onPress={() => setShareModalVisible(true)}
          style={{ 
            backgroundColor: "#667eea", 
            paddingHorizontal: 16, 
            paddingVertical: 12, 
            borderRadius: 8, 
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Ionicons name="share-outline" size={16} color="white" />
          <Text style={{ color: "white", fontWeight: "600" }}>Share Trip</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id ?? `${it.listId}:${it.placeId}`}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 12, borderBottomWidth: 0.5 }}>
            <Text style={{ fontWeight: "600" }}>{item.title ?? item.placeId}</Text>
            <Text style={{ opacity: 0.7 }}>{item.note ?? ""}</Text>
            <Pressable onPress={() => toggleLike(item)} style={{ marginTop: 8 }}>
              <Text>👍 {item.voteCount ?? 0}</Text>
            </Pressable>
          </View>
        )}
      />
      {/* Remember Google attribution wherever you show place details */}
      <Text style={{ textAlign: "center", marginTop: 8, fontSize: 12 }}>Powered by Google</Text>
      
      {/* Share Trip Modal */}
      <ShareTripModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        tripId={trip as string}
        tripName={tripData?.name || "Trip"}
      />
    </View>
  );
}