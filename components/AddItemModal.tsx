import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GooglePlacesTextInput from 'react-native-google-places-textinput';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { config } from '../config';

interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
  listId: string;
  userSub: string;
  onItemAdded?: () => void;
  tripId?: string; // Add tripId to fetch available lists
}

export default function AddItemModal({
  visible,
  onClose,
  listId,
  userSub,
  onItemAdded,
  tripId,
}: AddItemModalProps) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [placePhoto, setPlacePhoto] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedListId, setSelectedListId] = useState(listId);
  const [availableLists, setAvailableLists] = useState<Schema["List"]["type"][]>([]);
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  const client = generateClient<Schema>();

  // Load available lists when modal opens
  useEffect(() => {
    if (visible && tripId) {
      loadAvailableLists();
    }
  }, [visible, tripId]);

  // Update selected list when listId prop changes
  useEffect(() => {
    setSelectedListId(listId);
  }, [listId]);

  const loadAvailableLists = async () => {
    if (!tripId) return;
    try {
      const { data } = await client.models.List.list({ 
        filter: { tripId: { eq: tripId } } 
      });
      setAvailableLists(data || []);
    } catch (error) {
      console.error('Error loading lists:', error);
    }
  };

  const resetForm = () => {
    setTitle('');
    setNote('');
    setSelectedPlace(null);
    setPlacePhoto(null);
    setLoadingPhoto(false);
    setSelectedListId(listId);
    setShowCategorySelector(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const fetchPlacePhoto = async (placeId: string) => {
    if (!placeId) return;
    
    setLoadingPhoto(true);
    try {
      // Fetch place details to get photo reference
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${config.googlePlacesApiKey}`;
      const detailsResponse = await fetch(detailsUrl);
      const detailsData = await detailsResponse.json();
      
      if (detailsData.result?.photos?.[0]?.photo_reference) {
        const photoReference = detailsData.result.photos[0].photo_reference;
        // Construct photo URL
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${config.googlePlacesApiKey}`;
        setPlacePhoto(photoUrl);
      }
    } catch (error) {
      console.error('Error fetching place photo:', error);
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handlePlaceSelect = (place: any) => {
    console.log('Place selected:', place);
    setSelectedPlace(place);
    setPlacePhoto(null); // Reset photo
    
    // Handle the actual data structure from react-native-google-places-textinput
    const placeName = place?.structuredFormat?.mainText?.text || place?.text?.text || '';
    if (!title && placeName) {
      setTitle(placeName);
    }
    
    // Fetch photo if place ID is available
    if (place?.placeId) {
      fetchPlacePhoto(place.placeId);
    }
  };

  const handleAddItem = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for the item');
      return;
    }

    if (!selectedListId) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    setLoading(true);
    try {
      const itemData = {
        listId: selectedListId,
        title: title.trim(),
        note: note.trim() || undefined,
        createdBy: userSub,
        likedBy: [],
        voteCount: 0,
        owners: [userSub],
        // Google Places data (using actual API format from react-native-google-places-textinput)
        placeId: selectedPlace?.placeId || undefined,
        placeName: selectedPlace?.structuredFormat?.mainText?.text || selectedPlace?.text?.text || undefined,
        placeAddress: selectedPlace?.structuredFormat?.secondaryText?.text || undefined,
        placeTypes: selectedPlace?.types || [],
        placeRating: selectedPlace?.rating || undefined,
        placePhotoReference: selectedPlace?.photos?.[0]?.name || undefined,
        placePhotoUrl: placePhoto || undefined, // Save the photo URL
      };

      await client.models.ListItem.create(itemData);
      
      Alert.alert('Success', 'Item added successfully!');
      onItemAdded?.();
      handleClose();
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ flex: 1, backgroundColor: 'white' }}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
            }}
          >
            <Pressable onPress={handleClose}>
              <Ionicons name="close" size={24} color="#374151" />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
              Add Item
            </Text>
            <Pressable
              onPress={handleAddItem}
              disabled={loading || !title.trim()}
              style={{
                backgroundColor: loading || !title.trim() ? '#d1d5db' : '#111827',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 6,
              }}
            >
              <Text
                style={{
                  color: 'white',
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                {loading ? 'Adding...' : 'Add'}
              </Text>
            </Pressable>
          </View>

          {/* Content - Remove ScrollView wrapper */}
          <View style={{ flex: 1, padding: 16 }}>
            {/* Category Selection */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: 8,
                }}
              >
                Category *
              </Text>
              <Pressable
                onPress={() => setShowCategorySelector(!showCategorySelector)}
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  backgroundColor: 'white',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 16, color: selectedListId ? '#111827' : '#9ca3af' }}>
                  {availableLists.find(list => list.id === selectedListId)?.name || 'Select category'}
                </Text>
                <Ionicons 
                  name={showCategorySelector ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#6b7280" 
                />
              </Pressable>
              
              {showCategorySelector && (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderTopWidth: 0,
                    borderBottomLeftRadius: 8,
                    borderBottomRightRadius: 8,
                    backgroundColor: 'white',
                    maxHeight: 150,
                  }}
                >
                  <FlatList
                    data={availableLists}
                    keyExtractor={(item) => item.id || item.name}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => {
                          setSelectedListId(item.id || '');
                          setShowCategorySelector(false);
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 12,
                          borderBottomWidth: 0.5,
                          borderBottomColor: '#e5e7eb',
                          backgroundColor: selectedListId === item.id ? '#f3f4f6' : 'white',
                        }}
                      >
                        <Text style={{ 
                          fontSize: 16, 
                          color: '#111827',
                          fontWeight: selectedListId === item.id ? '600' : '400'
                        }}>
                          {item.name}
                        </Text>
                      </Pressable>
                    )}
                    showsVerticalScrollIndicator={false}
                  />
                </View>
              )}
            </View>

            {/* Title Input */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: 8,
                }}
              >
                Title *
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Enter item title"
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  fontSize: 16,
                  backgroundColor: 'white',
                }}
                autoFocus
              />
            </View>

            {/* Google Places Search */}
            <View style={{ marginBottom: 20, flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: 8,
                }}
              >
                Location (Optional)
              </Text>
              <GooglePlacesTextInput
                apiKey={config.googlePlacesApiKey}
                onPlaceSelect={handlePlaceSelect}
                placeHolderText="Search for a place..."
                style={{
                  container: {
                    width: '100%',
                    flex: 1,
                  },
                  input: {
                    height: 48,
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    fontSize: 16,
                    backgroundColor: 'white',
                  },
                  suggestionsContainer: {
                    backgroundColor: '#ffffff',
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderTopWidth: 0,
                    borderBottomLeftRadius: 8,
                    borderBottomRightRadius: 8,
                    maxHeight: 200,
                  },
                  suggestionItem: {
                    padding: 12,
                    borderBottomWidth: 0.5,
                    borderBottomColor: '#e5e7eb',
                  },
                  suggestionText: {
                    main: {
                      fontSize: 16,
                      color: '#111827',
                      fontWeight: '600',
                    },
                    secondary: {
                      fontSize: 14,
                      color: '#6b7280',
                      marginTop: 2,
                    }
                  },
                }}
                minCharsToFetch={2}
                debounceMs={300}
              />
              
              {selectedPlace && (
                <View
                  style={{
                    marginTop: 8,
                    padding: 12,
                    backgroundColor: '#f3f4f6',
                    borderRadius: 8,
                  }}
                >
                  {/* Photo Section */}
                  {loadingPhoto && (
                    <View style={{ 
                      height: 120, 
                      backgroundColor: '#e5e7eb', 
                      borderRadius: 6, 
                      marginBottom: 8,
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      <ActivityIndicator size="small" color="#6b7280" />
                      <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>Loading photo...</Text>
                    </View>
                  )}
                  
                  {placePhoto && !loadingPhoto && (
                    <Image
                      source={{ uri: placePhoto }}
                      style={{
                        width: '100%',
                        height: 120,
                        borderRadius: 6,
                        marginBottom: 8,
                      }}
                      resizeMode="cover"
                    />
                  )}
                  
                  {!placePhoto && !loadingPhoto && (
                    <View style={{ 
                      height: 120, 
                      backgroundColor: '#e5e7eb', 
                      borderRadius: 6, 
                      marginBottom: 8,
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      <Ionicons name="image-outline" size={32} color="#9ca3af" />
                      <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>No photo available</Text>
                    </View>
                  )}

                  {/* Place Info */}
                  <Text style={{ fontWeight: '600', color: '#111827' }}>
                    {selectedPlace.structuredFormat?.mainText?.text || selectedPlace.text?.text || 'Selected Place'}
                  </Text>
                  <Text style={{ color: '#6b7280', fontSize: 14, marginTop: 2 }}>
                    {selectedPlace.structuredFormat?.secondaryText?.text || 'Address not available'}
                  </Text>
                  {selectedPlace.types && selectedPlace.types.length > 0 && (
                    <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                      {selectedPlace.types.slice(0, 3).join(', ')}
                    </Text>
                  )}
                  <Pressable
                    onPress={() => {
                      setSelectedPlace(null);
                      setPlacePhoto(null);
                    }}
                    style={{ marginTop: 8, alignSelf: 'flex-start' }}
                  >
                    <Text style={{ color: '#ef4444', fontSize: 14 }}>Remove location</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Notes Input - Move to bottom */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: 8,
                }}
              >
                Notes (Optional)
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add any notes or details..."
                multiline
                numberOfLines={3}
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  fontSize: 16,
                  backgroundColor: 'white',
                  textAlignVertical: 'top',
                  height: 80,
                }}
              />
            </View>

            {/* Google Attribution */}
            <Text
              style={{
                textAlign: 'center',
                fontSize: 12,
                color: '#6b7280',
              }}
            >
              Powered by Google
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
