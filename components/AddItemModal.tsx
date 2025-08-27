import React, { useState } from 'react';
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
}

export default function AddItemModal({
  visible,
  onClose,
  listId,
  userSub,
  onItemAdded,
}: AddItemModalProps) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const client = generateClient<Schema>();

  const resetForm = () => {
    setTitle('');
    setNote('');
    setSelectedPlace(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePlaceSelect = (place: any) => {
    console.log('Place selected:', place);
    setSelectedPlace(place);
    if (!title && place?.displayName?.text) {
      setTitle(place.displayName.text);
    }
  };

  const handleAddItem = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for the item');
      return;
    }

    setLoading(true);
    try {
      const itemData = {
        listId,
        title: title.trim(),
        note: note.trim() || undefined,
        createdBy: userSub,
        likedBy: [],
        voteCount: 0,
        owners: [userSub],
        // Google Places data (using new API format)
        placeId: selectedPlace?.id || undefined,
        placeName: selectedPlace?.displayName?.text || undefined,
        placeAddress: selectedPlace?.formattedAddress || undefined,
        placeTypes: selectedPlace?.types || [],
        placeRating: selectedPlace?.rating || undefined,
        placePhotoReference: selectedPlace?.photos?.[0]?.name || undefined,
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

          <ScrollView style={{ flex: 1, padding: 16 }}>
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
            <View style={{ marginBottom: 20 }}>
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
                  <Text style={{ fontWeight: '600', color: '#111827' }}>
                    {selectedPlace.displayName?.text}
                  </Text>
                  <Text style={{ color: '#6b7280', fontSize: 14, marginTop: 2 }}>
                    {selectedPlace.formattedAddress}
                  </Text>
                  {selectedPlace.rating && (
                    <Text style={{ color: '#6b7280', fontSize: 14, marginTop: 2 }}>
                      ⭐ {selectedPlace.rating}
                    </Text>
                  )}
                  <Pressable
                    onPress={() => setSelectedPlace(null)}
                    style={{ marginTop: 8, alignSelf: 'flex-start' }}
                  >
                    <Text style={{ color: '#ef4444', fontSize: 14 }}>Remove location</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Notes Input */}
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
                numberOfLines={4}
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  fontSize: 16,
                  backgroundColor: 'white',
                  textAlignVertical: 'top',
                  minHeight: 100,
                }}
              />
            </View>

            {/* Google Attribution */}
            <Text
              style={{
                textAlign: 'center',
                fontSize: 12,
                color: '#6b7280',
                marginTop: 20,
              }}
            >
              Powered by Google
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
