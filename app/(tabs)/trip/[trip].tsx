import { Ionicons } from "@expo/vector-icons";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, Text, TextInput, View } from "react-native";
import type { Schema } from "../../../amplify/data/resource";
import AddItemModal from "../../../components/AddItemModal";
import ShareTripModal from "../../../components/ShareTripModal";

// Amplify is already configured in _layout.tsx with REST API support

export default function TripScreen() {
  const { trip } = useLocalSearchParams<{ trip: string }>();
  const [userSub, setUserSub] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [lists, setLists] = useState<Schema["List"]["type"][]>([]);
  const [items, setItems] = useState<Schema["ListItem"]["type"][]>([]);
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState("");
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [addItemModalVisible, setAddItemModalVisible] = useState(false);
  const [tripData, setTripData] = useState<Schema["Trip"]["type"] | null>(null);
  
  // Generate client inside component to ensure Amplify is configured
  const client = generateClient<Schema>();

  // Initialize user and load trip data
  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      setUserSub(u.userId);

      // Simple invite handling - check if user needs to be added to trip
      await handlePotentialInvite(u.userId);

      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle joining trip via invite (simplified - no Lambda needed)
  async function handlePotentialInvite(userId: string) {
    try {
      // Check if user is already a member of this trip
      const tripResult = await client.models.Trip.get({ id: trip as string });
      const tripData = tripResult.data;
      
      if (tripData && !tripData.owners?.includes(userId)) {
        // User is not a member - they might be joining via invite
        // For now, we'll just add them (you could add invite validation here)
        const updatedOwners = [...(tripData.owners || []), userId];
        await client.models.Trip.update({
          id: trip as string,
          owners: updatedOwners,
        });
      }
    } catch (error) {
      console.error('Error handling invite:', error);
      // Don't show error to user - they might just be viewing their own trip
    }
  }

  async function refresh() {
    setLoading(true);
    
    // Load trip data
    const tripResult = await client.models.Trip.get({ id: trip as string });
    setTripData(tripResult.data);
    
    // Load lists for this trip
    const listsResp = await client.models.List.list({ filter: { tripId: { eq: trip as string } } });
    const allLists = listsResp.data ?? [];
    setLists(allLists);
    
    // If no lists exist, create default categories
    if (allLists.length === 0 && userSub) {
      await createDefaultCategories();
      return; // refresh will be called again after creating categories
    }
    
    // Set first list as selected if none selected
    if (!listId && allLists.length > 0) {
      setListId(allLists[0].id ?? null);
    }
    
    // Load items for selected list
    if (listId) {
      const { data } = await client.models.ListItem.list({
        filter: { listId: { eq: listId } },
        limit: 200,
      });
      
      // Ensure all items have proper array fields to prevent filter errors
      const sanitizedItems = (data ?? []).map(item => ({
        ...item,
        likedBy: item.likedBy || [],
        placeTypes: item.placeTypes || [],
      }));
      
      setItems(sanitizedItems);
    } else {
      setItems([]);
    }
    
    setLoading(false);
  }

  async function createDefaultCategories() {
    if (!userSub) return;
    
    const defaultCategories = [
      { name: "🍽️ Restaurants", icon: "🍽️" },
      { name: "🎯 Attractions", icon: "🎯" },
      { name: "🏨 Hotels", icon: "🏨" },
      { name: "🚗 Transportation", icon: "🚗" },
      { name: "📝 General", icon: "📝" }
    ];
    
    try {
      for (const category of defaultCategories) {
        await client.models.List.create({
          tripId: trip as string,
          name: category.name,
          createdBy: userSub,
          owners: [userSub],
        });
      }
      await refresh(); // Reload after creating categories
    } catch (error) {
      console.error('Error creating default categories:', error);
    }
  }

  // Simple real-time subscriptions - let Amplify handle the complexity
  useEffect(() => {
    if (!listId) {
      setItems([]);
      return;
    }

    // Load items for the selected list
    const loadItems = async () => {
      try {
        const { data } = await client.models.ListItem.list({
          filter: { listId: { eq: listId } },
          limit: 200,
        });
        
        const sanitizedItems = (data ?? []).map(item => ({
          ...item,
          likedBy: item.likedBy || [],
          placeTypes: item.placeTypes || [],
        }));
        
        setItems(sanitizedItems);
      } catch (error) {
        console.error('Error loading items:', error);
      }
    };

    loadItems();

    const subscription = client.models.ListItem.observeQuery({
      filter: { listId: { eq: listId } }
    }).subscribe({
      next: ({ items }) => {
        // Ensure all items have proper array fields to prevent filter errors
        const sanitizedItems = items.map(item => ({
          ...item,
          likedBy: item.likedBy || [],
          placeTypes: item.placeTypes || [],
        }));
        setItems(sanitizedItems);
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
    
    const currentLikedBy = item.likedBy || [];
    const isLiked = currentLikedBy.includes(userSub);
    const newLikedBy = isLiked 
      ? currentLikedBy.filter(id => id !== userSub)
      : [...currentLikedBy, userSub];
    
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
            style={{ flex: 1, borderWidth: 0.5, borderColor: "#ccc", borderRadius: 6, paddingHorizontal: 10, height: 40, color: "white" }}
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
                  owners: [userSub],
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

        {/* Quick category buttons */}
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Quick categories:</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {["🛍️ Shopping", "🎭 Entertainment", "☕ Cafes", "🏖️ Beaches"].map((category) => (
              <Pressable
                key={category}
                onPress={async () => {
                  if (!userSub) return;
                  try {
                    const created = await client.models.List.create({
                      tripId: trip as string,
                      name: category,
                      createdBy: userSub,
                      owners: [userSub],
                    });
                    await refresh();
                    const createdId = created.data?.id ?? null;
                    if (createdId) setListId(createdId);
                  } catch (e: any) {
                    Alert.alert("Failed to create list", e?.message || String(e));
                  }
                }}
                style={{
                  backgroundColor: "#f3f4f6",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                }}
              >
                <Text style={{ fontSize: 12, color: "#374151" }}>{category}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Share trip with others */}
      <View style={{ marginBottom: 12, flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => setShareModalVisible(true)}
          style={{ 
            backgroundColor: "#667eea", 
            paddingHorizontal: 16, 
            paddingVertical: 12, 
            borderRadius: 8, 
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flex: 1,
          }}
        >
          <Ionicons name="share-outline" size={16} color="white" />
          <Text style={{ color: "white", fontWeight: "600" }}>Share Trip</Text>
        </Pressable>
        
        {listId && (
          <Pressable
            onPress={() => setAddItemModalVisible(true)}
            style={{ 
              backgroundColor: "#10b981", 
              paddingHorizontal: 16, 
              paddingVertical: 12, 
              borderRadius: 8, 
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flex: 1,
            }}
          >
            <Ionicons name="add" size={16} color="white" />
            <Text style={{ color: "white", fontWeight: "600" }}>Add Item</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id ?? `${it.listId}:${it.placeId}`}
        renderItem={({ item }) => (
          <View style={{ 
            paddingVertical: 16, 
            paddingHorizontal: 16,
            marginVertical: 4,
            backgroundColor: "white",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#f3f4f6",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}>
            {/* Photo Section */}
            {item.placePhotoUrl && (
              <Image
                source={{ uri: item.placePhotoUrl }}
                style={{
                  width: '100%',
                  height: 160,
                  borderRadius: 8,
                  marginBottom: 12,
                }}
                resizeMode="cover"
              />
            )}
            
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontWeight: "600", fontSize: 16, color: "#111827", marginBottom: 4 }}>
                  {item.title ?? item.placeId}
                </Text>
                
                {item.placeAddress && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <Ionicons name="location-outline" size={14} color="#6b7280" />
                    <Text style={{ color: "#6b7280", fontSize: 14, marginLeft: 4, flex: 1 }}>
                      {item.placeAddress}
                    </Text>
                  </View>
                )}
                
                {item.placeRating && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <Text style={{ color: "#f59e0b", fontSize: 14 }}>⭐ {item.placeRating}</Text>
                  </View>
                )}
                
                {item.note && (
                  <Text style={{ color: "#6b7280", fontSize: 14, marginTop: 4, lineHeight: 20 }}>
                    {item.note}
                  </Text>
                )}
              </View>
              
              <Pressable 
                onPress={() => toggleLike(item)} 
                style={{ 
                  flexDirection: "row", 
                  alignItems: "center", 
                  backgroundColor: "#f9fafb",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: (item.likedBy || []).includes(userSub || "") ? "#10b981" : "#e5e7eb",
                }}
              >
                <Text style={{ 
                  color: (item.likedBy || []).includes(userSub || "") ? "#10b981" : "#6b7280",
                  fontSize: 16,
                  marginRight: 4,
                }}>
                  👍
                </Text>
                <Text style={{ 
                  color: (item.likedBy || []).includes(userSub || "") ? "#10b981" : "#6b7280",
                  fontWeight: "600",
                  fontSize: 14,
                }}>
                  {item.voteCount ?? 0}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={{ 
            padding: 32, 
            alignItems: "center",
            backgroundColor: "white",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#f3f4f6",
            borderStyle: "dashed",
          }}>
            <Ionicons name="list-outline" size={48} color="#d1d5db" />
            <Text style={{ 
              color: "#6b7280", 
              fontSize: 16, 
              fontWeight: "500",
              marginTop: 12,
              textAlign: "center",
            }}>
              {listId ? "No items yet" : "Select a list to view items"}
            </Text>
            <Text style={{ 
              color: "#9ca3af", 
              fontSize: 14, 
              marginTop: 4,
              textAlign: "center",
            }}>
              {listId ? "Add your first item to get started" : "Create a list first, then add items"}
            </Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
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
      
      {/* Add Item Modal */}
      {listId && userSub && (
        <AddItemModal
          visible={addItemModalVisible}
          onClose={() => setAddItemModalVisible(false)}
          listId={listId}
          userSub={userSub}
          onItemAdded={refresh}
          tripId={trip as string}
        />
      )}
    </View>
  );
}