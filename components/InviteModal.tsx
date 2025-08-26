import { Ionicons } from "@expo/vector-icons";
import { post } from "aws-amplify/api";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  tripName: string;
}

export default function InviteModal({ visible, onClose, tripId, tripName }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const sendInvite = async () => {
    if (!email.trim()) {
      Alert.alert("Missing Email", "Please enter an email address");
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert("Invalid Email", "Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const response = await post({
        apiName: "app-api",
        path: "/invite/create",
        options: {
          body: {
            tripId,
          },
        },
      }).response;

      const result = await response.body.json();

      if (response.status === 200) {
        const link = result.inviteId ? `hakuba://invite/${result.inviteId}` : undefined;
        const expires = result.expiresAt ? new Date(result.expiresAt).toLocaleString() : undefined;
        const message = link
          ? `Invitation link created for "${tripName}"\n\nLink: ${link}${expires ? `\nExpires: ${expires}` : ''}`
          : `Invitation created for "${tripName}".`;

        Alert.alert(
          "Invitation Created! ✅",
          message,
          [
            {
              text: "OK",
              onPress: () => {
                setEmail("");
                setRecipientName("");
                onClose();
              },
            },
          ]
        );
      } else {
        throw new Error(result.error || "Failed to send invitation");
      }
    } catch (error: any) {
      console.error("Error sending invite:", error);
      
      let errorMessage = "Failed to create invitation. Please try again.";
      
      if (error.response?.status === 409) {
        errorMessage = "An invitation has already been sent to this email address.";
      } else if (error.response?.status === 400) {
        errorMessage = "The email address is invalid.";
      } else if (error.response?.status === 403) {
        errorMessage = "You don't have permission to invite users to this trip.";
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setEmail("");
      setRecipientName("");
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Invite to {tripName}</Text>
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            disabled={loading}
          >
            <Ionicons name="close" size={24} color="#666" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="friend@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Recipient Name (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Their name"
              value={recipientName}
              onChangeText={setRecipientName}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#667eea" />
            <Text style={styles.infoText}>
              They'll receive an in-app invitation to join this trip. The invitation expires in 7 days.
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.sendButton, loading && styles.disabledButton]}
              onPress={sendInvite}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ionicons name="mail" size={16} color="white" />
                  <Text style={styles.sendButtonText}>Send Invite</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0f4ff",
    padding: 16,
    borderRadius: 8,
    marginBottom: 30,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: "auto",
    paddingBottom: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cancelButton: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
  },
  sendButton: {
    backgroundColor: "#667eea",
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "white",
  },
  disabledButton: {
    opacity: 0.6,
  },
});
