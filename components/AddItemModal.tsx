import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

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
  const [loading, setLoading] = useState(false);

  const client = generateClient<Schema>();

  const handleClose = () => {
    setTitle('');
    onClose();
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
        createdBy: userSub,
        likedBy: [],
        voteCount: 0,
        owners: [userSub],
        placeTypes: [], // Always an empty array to avoid undefined issues
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
      <View style={{ flex: 1, backgroundColor: 'white', padding: 20 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
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

        <Text style={{ color: '#6b7280', fontSize: 14 }}>
          Minimal version for debugging - Google Places temporarily removed
        </Text>
      </View>
    </Modal>
  );
}
