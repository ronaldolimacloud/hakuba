import * as AppleColors from "@bacons/apple-colors";
import { Ionicons } from "@expo/vector-icons";
import { MenuView } from '@react-native-menu/menu';
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect, useLayoutEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { Schema } from "../../../amplify/data/resource";
import AddItemModal from "../../../components/AddItemModal";
import ShareTripModal from "../../../components/ShareTripModal";
import { Rounded } from "../../../components/ui/rounded";

// Amplify is already configured in _layout.tsx with REST API support

export default function TripScreen() {
  const { trip } = useLocalSearchParams<{ trip: string }>();
  const navigation = useNavigation();
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

  // Set up header with menu button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <MenuView
          actions={[
            {
              id: 'share',
              title: 'Share',
              image: 'square.and.arrow.up',
            },
            {
              id: 'addItem',
              title: 'Add Item',
              image: 'plus',
            },
            {
              id: 'delete',
              title: 'Delete',
              image: 'trash',
              attributes: { destructive: true },
            },
          ]}
          onPressAction={({ nativeEvent }) => {
            switch (nativeEvent.event) {
              case 'share':
                setShareModalVisible(true);
                break;
              case 'addItem':
                if (listId) {
                  setAddItemModalVisible(true);
                } else {
                  Alert.alert("No List Selected", "Please select or create a list first.");
                }
                break;
              case 'delete':
                deleteTrip();
                break;
            }
          }}
        >
          <Pressable
            style={{
              marginRight: 16,
              width: 30,
              height: 30,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="white" />
          </Pressable>
        </MenuView>
      ),
      headerTintColor: 'white',
      headerTitleStyle: {
        color: 'white',
      },
    });
  }, [navigation, listId, setShareModalVisible, setAddItemModalVisible]);

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

  async function deleteTrip() {
    if (!tripData || !userSub) return;
    
    Alert.alert(
      "Delete Trip",
      "Are you sure you want to delete this trip? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              // Delete all lists and items associated with the trip
              const listsResult = await client.models.List.list({ 
                filter: { tripId: { eq: trip as string } }
              });
              
              for (const list of listsResult.data || []) {
                if (list.id) {
                  // Delete all items in the list
                  const itemsResult = await client.models.ListItem.list({
                    filter: { listId: { eq: list.id } }
                  });
                  
                  for (const item of itemsResult.data || []) {
                    if (item.id) {
                      await client.models.ListItem.delete({ id: item.id });
                    }
                  }
                  
                  // Delete the list
                  await client.models.List.delete({ id: list.id });
                }
              }
              
              // Delete the trip
              await client.models.Trip.delete({ id: trip as string });
              
              Alert.alert("Success", "Trip deleted successfully", [
                { text: "OK", onPress: () => {
                  // Navigate back or handle navigation as needed
                  // You might want to navigate to the trips list or home screen
                }}
              ]);
            } catch (error) {
              console.error('Failed to delete trip:', error);
              Alert.alert("Error", "Failed to delete trip. Please try again.");
            }
          }
        }
      ]
    );
  }

  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ backgroundColor: '#000' }}>
      <View style={{ paddingVertical: 16, paddingHorizontal: 16, gap: 24 }}>
        
        {/* List picker and creation */}
        <Rounded 
          padding 
          style={{ backgroundColor: '#1c1c1e' }}
        >
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
                borderColor: (item.id === listId ? AppleColors.systemBlue : '#333'),
                backgroundColor: (item.id === listId ? AppleColors.systemBlue : '#2c2c2e'),
              }}
            >
              <Text style={{ color: (item.id === listId ? "white" : "white"), fontWeight: "600" }}>{item.name}</Text>
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <Text style={{ opacity: 0.7, color: '#666' }}>No lists yet. Create one below.</Text>
          )}
          showsHorizontalScrollIndicator={false}
        />

          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TextInput
              placeholder="New list name"
              placeholderTextColor="#666"
              value={newListName}
              onChangeText={setNewListName}
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
              style={{ backgroundColor: AppleColors.systemBlue, paddingHorizontal: 14, justifyContent: "center", borderRadius: 6 }}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>Add</Text>
            </Pressable>
          </View>

          {/* Quick category buttons */}
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Quick categories:</Text>
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
                    backgroundColor: '#2c2c2e',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#333',
                  }}
                >
                  <Text style={{ fontSize: 12, color: 'white' }}>{category}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Rounded>



        {/* Items list */}
        <View>
          <FlatList
            data={items}
            keyExtractor={(it) => it.id ?? `${it.listId}:${it.placeId}`}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 12 }}>
                <Rounded 
                  padding 
                  style={{ backgroundColor: '#1c1c1e' }}
                >
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
                      <Text style={{ fontWeight: "600", fontSize: 16, color: 'white', marginBottom: 4 }}>
                        {item.title ?? item.placeId}
                      </Text>
                      
                      {item.placeAddress && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                          <Ionicons name="location-outline" size={14} color="#999" />
                          <Text style={{ color: "#999", fontSize: 14, marginLeft: 4, flex: 1 }}>
                            {item.placeAddress}
                          </Text>
                        </View>
                      )}
                      
                      {item.placeRating && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                          <Text style={{ color: AppleColors.systemOrange, fontSize: 14 }}>⭐ {item.placeRating}</Text>
                        </View>
                      )}
                      
                      {item.note && (
                        <Text style={{ color: "#999", fontSize: 14, marginTop: 4, lineHeight: 20 }}>
                          {item.note}
                        </Text>
                      )}
                    </View>
              
                    <Pressable 
                      onPress={() => toggleLike(item)} 
                      style={{ 
                        flexDirection: "row", 
                        alignItems: "center", 
                        backgroundColor: '#2c2c2e',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: (item.likedBy || []).includes(userSub || "") ? AppleColors.systemGreen : '#333',
                      }}
                    >
                      <Text style={{ 
                        color: (item.likedBy || []).includes(userSub || "") ? AppleColors.systemGreen : '#999',
                        fontSize: 16,
                        marginRight: 4,
                      }}>
                        👍
                      </Text>
                      <Text style={{ 
                        color: (item.likedBy || []).includes(userSub || "") ? AppleColors.systemGreen : '#999',
                        fontWeight: "600",
                        fontSize: 14,
                      }}>
                        {item.voteCount ?? 0}
                      </Text>
                    </Pressable>
                  </View>
                </Rounded>
              </View>
            )}
            ListEmptyComponent={() => (
              <Rounded 
                padding 
                style={{ backgroundColor: '#1c1c1e' }}
              >
                <View style={{ 
                  padding: 16, 
                  alignItems: "center",
                }}>
                  <Ionicons name="list-outline" size={48} color="#555" />
                  <Text style={{ 
                    color: '#999', 
                    fontSize: 16, 
                    fontWeight: "500",
                    marginTop: 12,
                    textAlign: "center",
                  }}>
                    {listId ? "No items yet" : "Select a list to view items"}
                  </Text>
                  <Text style={{ 
                    color: '#666', 
                    fontSize: 14, 
                    marginTop: 4,
                    textAlign: "center",
                  }}>
                    {listId ? "Add your first item to get started" : "Create a list first, then add items"}
                  </Text>
                </View>
              </Rounded>
            )}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />
        </View>
      
        {/* Google attribution */}
        <Text style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: '#666' }}>Powered by Google</Text>
      
      </View>
      </ScrollView>
      
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