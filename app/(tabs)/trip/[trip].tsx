import * as AppleColors from '@bacons/apple-colors';
import { Ionicons } from '@expo/vector-icons';
import { MenuView } from '@react-native-menu/menu';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createList,
  getTrip,
  listItemsByList,
  listListsByTrip,
  toggleListItemVote,
  deleteTrip as deleteTripMutation,
} from '../../../lib/appsyncApi';
import { List, ListItem, Trip } from '../../../lib/appsyncTypes';
import AddItemModal from '../../../components/AddItemModal';
import ShareTripModal from '../../../components/ShareTripModal';
import { Rounded } from '../../../components/ui/rounded';
import { getAwsConfig } from '../../../lib/awsConfig';
import { useAuth } from '../../../providers/AuthProvider';
import { ErrorHandler, withRetry } from '../../../utils/errorHandling';

export default function TripScreen() {
  const { trip: tripIdParam } = useLocalSearchParams<{ trip: string }>();
  const navigation = useNavigation();
  const awsConfig = useMemo(() => getAwsConfig(), []);
  const isBackendConfigured = Boolean(awsConfig.appSyncUrl);
  const { user, tokens } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [addItemModalVisible, setAddItemModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [likingItems, setLikingItems] = useState<Set<string>>(new Set());

  const tripId = typeof tripIdParam === 'string' ? tripIdParam : null;

  const loadTrip = React.useMemo(() => {
    if (!isBackendConfigured) {
      return async () => undefined;
    }

    return withRetry(async () => {
      if (!tripId) return;
      const tripData = await getTrip(tripId, tokens ?? null);
      if (tripData) {
        setTrip(tripData);
        navigation.setOptions({ title: tripData.name ?? 'Trip' });
      }
    }, `load-trip-${tripId}`, 'loading trip');
  }, [isBackendConfigured, navigation, tokens, tripId]);

  const loadLists = React.useMemo(() => {
    if (!isBackendConfigured) {
      return async () => undefined;
    }

    return withRetry(async () => {
      if (!tripId) return;
      const data = await listListsByTrip(tripId, tokens ?? null);
      setLists(data);
      if (!selectedListId && data.length > 0) {
        setSelectedListId(data[0].id);
      }
    }, `load-lists-${tripId}`, 'loading lists');
  }, [isBackendConfigured, tokens, tripId, selectedListId]);

  const loadItems = React.useMemo(() => {
    if (!isBackendConfigured) {
      return async () => undefined;
    }

    return withRetry(async () => {
      if (!tripId || !selectedListId) {
        setItems([]);
        return;
      }
      const data = await listItemsByList(tripId, selectedListId, tokens ?? null);
      setItems(data);
    }, `load-items-${tripId}-${selectedListId}`, 'loading items');
  }, [isBackendConfigured, tokens, tripId, selectedListId]);

  useEffect(() => {
    if (!isBackendConfigured) {
      setLoading(false);
      return;
    }

    if (!tripId || !tokens) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        await loadTrip();
        await loadLists();
      } catch (error) {
        ErrorHandler.showError(error, 'Failed to load trip', 'loading trip');
      } finally {
        setLoading(false);
      }
    })();
  }, [isBackendConfigured, loadLists, loadTrip, tokens, tripId]);

  useEffect(() => {
    if (!isBackendConfigured) {
      setItems([]);
      return;
    }

    loadItems().catch((error) => {
      ErrorHandler.showError(error, 'Failed to load items', 'loading items');
    });
  }, [isBackendConfigured, loadItems]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <MenuView
          actions={[
            { id: 'share', title: 'Share', image: 'square.and.arrow.up' },
            { id: 'addItem', title: 'Add Item', image: 'plus' },
            { id: 'delete', title: 'Delete', image: 'trash', attributes: { destructive: true } },
          ]}
          onPressAction={({ nativeEvent }) => {
            switch (nativeEvent.event) {
              case 'share':
                if (!isBackendConfigured) {
                  Alert.alert(
                    'Backend Not Configured',
                    'Trip planner requires EXPO_PUBLIC_APPSYNC_URL (and related Expo env vars). Update your environment configuration before sharing trips.'
                  );
                  return;
                }
                setShareModalVisible(true);
                break;
              case 'addItem':
                if (!isBackendConfigured) {
                  Alert.alert(
                    'Backend Not Configured',
                    'Trip planner requires EXPO_PUBLIC_APPSYNC_URL (and related Expo env vars). Update your environment configuration before adding items.'
                  );
                  return;
                }
                if (selectedListId) {
                  setAddItemModalVisible(true);
                } else {
                  Alert.alert('No List Selected', 'Please select or create a list first.');
                }
                break;
              case 'delete':
                confirmDeleteTrip();
                break;
              default:
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
      headerTitleStyle: { color: 'white' },
    });
  }, [isBackendConfigured, navigation, selectedListId, tripId]);

  const confirmDeleteTrip = useCallback(() => {
    if (!isBackendConfigured) {
      Alert.alert(
        'Backend Not Configured',
        'Trip planner requires EXPO_PUBLIC_APPSYNC_URL (and related Expo env vars). Update your environment configuration before deleting trips.'
      );
      return;
    }

    if (!tripId) return;
    Alert.alert('Delete trip', 'Are you sure you want to delete this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTripMutation(tripId, tokens ?? null);
            Alert.alert('Trip deleted', 'The trip has been removed.');
            navigation.goBack();
          } catch (error) {
            ErrorHandler.showError(error, 'Failed to delete trip', 'deleting trip');
          }
        },
      },
    ]);
  }, [isBackendConfigured, navigation, tokens, tripId]);

  const handleCreateList = useCallback(async () => {
    if (!isBackendConfigured) {
      Alert.alert(
        'Backend Not Configured',
        'Trip planner requires EXPO_PUBLIC_APPSYNC_URL (and related Expo env vars). Update your environment configuration before creating lists.'
      );
      return;
    }

    if (!tripId) return;
    const trimmed = newListName.trim();
    if (!trimmed) {
      Alert.alert('Missing Information', 'Please enter a list name');
      return;
    }

    try {
      const result = await createList({ tripId, name: trimmed }, tokens ?? null);
      setLists((prev) => [result, ...prev]);
      setNewListName('');
      setSelectedListId(result.id);
    } catch (error) {
      ErrorHandler.showError(error, 'Failed to create list', 'creating list');
    }
  }, [isBackendConfigured, newListName, tokens, tripId]);

  const handleToggleVote = useCallback(
    async (item: ListItem) => {
      if (!isBackendConfigured) {
        Alert.alert(
          'Backend Not Configured',
          'Trip planner requires EXPO_PUBLIC_APPSYNC_URL (and related Expo env vars). Update your environment configuration before voting on items.'
        );
        return;
      }

      if (!user) {
        Alert.alert('Sign in required', 'Please sign in to vote on items.');
        return;
      }

      const hasLiked = item.likedBy?.includes(user.sub) ?? false;
      const nextState = new Set(likingItems);
      nextState.add(item.id);
      setLikingItems(nextState);

      try {
        const updated = await toggleListItemVote(item.id, !hasLiked, tokens ?? null);
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } catch (error) {
        ErrorHandler.showError(error, 'Unable to update vote', 'voting');
      } finally {
        setLikingItems((prev) => {
          const copy = new Set(prev);
          copy.delete(item.id);
          return copy;
        });
      }
    },
    [isBackendConfigured, likingItems, tokens, user]
  );

  if (!isBackendConfigured) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 12 }}>
          Planner backend isn't configured for this build.
        </Text>
        <Text style={{ color: '#999', fontSize: 13, textAlign: 'center' }}>
          Set EXPO_PUBLIC_APPSYNC_URL and related Expo environment variables (or update expo.extra) before opening trip details.
        </Text>
      </View>
    );
  }

  if (!tripId) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff' }}>Trip not found.</Text>
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

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', textAlign: 'center' }}>Unable to load trip details.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Rounded padding style={{ backgroundColor: '#1c1c1e', marginBottom: 16 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{trip.name}</Text>
          <Text style={{ color: '#999', marginTop: 4 }}>Members: {trip.owners.length}</Text>
        </Rounded>

        <Rounded padding style={{ backgroundColor: '#1c1c1e', marginBottom: 16 }}>
          <Text style={{ color: '#666', fontSize: 12, textTransform: 'uppercase', marginBottom: 12, fontWeight: '600' }}>
            Create New List
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={newListName}
              onChangeText={setNewListName}
              placeholder="List name"
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
              onPress={handleCreateList}
              style={{
                backgroundColor: AppleColors.systemBlue,
                paddingHorizontal: 20,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
            </Pressable>
          </View>
        </Rounded>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {lists.map((list) => {
              const isSelected = list.id === selectedListId;
              return (
                <Pressable
                  key={list.id}
                  onPress={() => setSelectedListId(list.id)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: isSelected ? '#fff' : '#1c1c1e',
                  }}
                >
                  <Text style={{ color: isSelected ? '#000' : '#fff', fontWeight: '600' }}>{list.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Rounded padding style={{ backgroundColor: '#1c1c1e', minHeight: 200 }}>
          {selectedListId ? (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              renderItem={({ item }) => {
                const liked = item.likedBy?.includes(user?.sub ?? '') ?? false;
                const pending = likingItems.has(item.id);
                return (
                  <View style={{ backgroundColor: '#2c2c2e', borderRadius: 12, padding: 16 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
                    {item.note && <Text style={{ color: '#999', marginTop: 6 }}>{item.note}</Text>}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                      <Text style={{ color: '#999', fontSize: 12 }}>Votes: {item.voteCount}</Text>
                      <Pressable
                        onPress={() => handleToggleVote(item)}
                        disabled={pending}
                        style={{
                          flexDirection: 'row',
                          gap: 6,
                          alignItems: 'center',
                          backgroundColor: liked ? '#34c759' : '#3a3a3c',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 16,
                        }}
                      >
                        <Ionicons name="thumbs-up" size={16} color={liked ? '#000' : '#fff'} />
                        <Text style={{ color: liked ? '#000' : '#fff', fontWeight: '600' }}>
                          {liked ? 'Liked' : 'Like'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          ) : (
            <Text style={{ color: '#999', textAlign: 'center' }}>Select a list to view items.</Text>
          )}
        </Rounded>
      </ScrollView>

      <AddItemModal
        visible={addItemModalVisible}
        onClose={() => setAddItemModalVisible(false)}
        listId={selectedListId ?? ''}
        userSub={user?.sub ?? ''}
        tripId={tripId ?? undefined}
        onItemAdded={() => loadItems()}
      />
      <ShareTripModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        tripId={tripId ?? ''}
        tripName={trip?.name ?? ''}
      />
    </View>
  );
}
