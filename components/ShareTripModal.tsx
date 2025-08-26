import { Ionicons } from "@expo/vector-icons";
import { post } from "aws-amplify/api";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

interface ShareTripModalProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  tripName: string;
}

const { width } = Dimensions.get("window");

export default function ShareTripModal({ visible, onClose, tripId, tripName }: ShareTripModalProps) {
  const [inviteLink, setInviteLink] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  // Generate invitation link using backend inviteId
  const generateInviteLink = async () => {
    if (inviteLink) return inviteLink; // Already generated
    setLoading(true);
    try {
      const { body, statusCode } = await post({
        apiName: "app-api",
        path: "/invite/create",
        options: { body: { tripId } },
      }).response;

      const result = (await body.json()) as any;
      if (statusCode !== 200 || !result?.inviteId) {
        throw new Error(result?.error || "Failed to create invite");
      }

      const link = `hakuba://invite/${result.inviteId}`;
      setInviteLink(link);
      return link;
    } catch (error) {
      console.error("Error creating invite:", error);
      Alert.alert("Error", "Failed to create invitation link. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const shareViaWhatsApp = async () => {
    const link = await generateInviteLink();
    if (!link) return;

    try {
      const message = `Hey! I've added you to my trip: ${tripName} ${link}`;
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
      
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to regular share if WhatsApp not installed
        await shareOther();
      }
    } catch (error) {
      console.error("WhatsApp share error:", error);
      await shareOther(); // Fallback
    }
  };

  const shareViaQRCode = async () => {
    const link = await generateInviteLink();
    if (!link) return;
    
    setShowQRCode(true);
  };

  const shareOther = async () => {
    const link = await generateInviteLink();
    if (!link) return;

    try {
      await Share.share({
        title: `Join "${tripName}"`,
        message: `Join my trip "${tripName}": ${link}`,
        url: link, // iOS
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setInviteLink("");
      setShowQRCode(false);
      onClose();
    }
  };

  if (showQRCode && inviteLink) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <View style={styles.qrContainer}>
          <View style={styles.header}>
            <Pressable onPress={() => setShowQRCode(false)} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#666" />
            </Pressable>
            <Text style={styles.title}>QR Code To Invite Participants</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </Pressable>
          </View>

          <View style={styles.qrCodeSection}>
            <View style={styles.qrCodeContainer}>
              <QRCode
                value={inviteLink}
                size={250}
                backgroundColor="white"
                color="black"
                logoSize={60}
                logoBackgroundColor="white"
                logoBorderRadius={15}
              />
            </View>
            
            <Text style={styles.qrDescription}>
              Let other participants scan this QR code to quickly join your {tripName}
            </Text>
            
            <Pressable style={styles.copyLinkButton} onPress={async () => {
              try {
                await Clipboard.setStringAsync(inviteLink);
                Alert.alert("Copied", "Invitation link copied to clipboard");
              } catch (e) {
                Alert.alert("Copy failed", "Could not copy the link. Please try again.");
              }
            }}>
              <Ionicons name="copy-outline" size={16} color="#667eea" />
              <Text style={styles.copyLinkText}>Copy Invitation Link</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="share-outline" size={32} color="#000000" />
          </View>
          <Text style={styles.title}>Share trip "{tripName}" with others</Text>
          <Text style={styles.subtitle}>
            Share this trip with others, so they can join you in tracking expenses
          </Text>
          <Pressable onPress={handleClose} style={styles.closeButton} disabled={loading}>
            <Ionicons name="close" size={24} color="#666" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Pressable 
            style={[styles.shareOption, loading && styles.disabledOption]} 
            onPress={shareViaWhatsApp}
            disabled={loading}
          >
            <View style={[styles.optionIcon, { backgroundColor: "#000000" }]}>
              <Ionicons name="logo-whatsapp" size={24} color="white" />
            </View>
            <Text style={styles.optionText}>Via WhatsApp</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
            {loading && <ActivityIndicator size="small" color="#667eea" />}
          </Pressable>

          <Pressable 
            style={[styles.shareOption, loading && styles.disabledOption]} 
            onPress={shareViaQRCode}
            disabled={loading}
          >
            <View style={[styles.optionIcon, { backgroundColor: "#000000" }]}>
              <Ionicons name="qr-code-outline" size={24} color="white" />
            </View>
            <Text style={styles.optionText}>Via QR Code</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
            {loading && <ActivityIndicator size="small" color="#667eea" />}
          </Pressable>

          <Pressable 
            style={[styles.shareOption, loading && styles.disabledOption]} 
            onPress={shareOther}
            disabled={loading}
          >
            <View style={[styles.optionIcon, { backgroundColor: "#000000" }]}>
              <Ionicons name="share-outline" size={24} color="white" />
            </View>
            <Text style={styles.optionText}>Other</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
            {loading && <ActivityIndicator size="small" color="#667eea" />}
          </Pressable>
        </View>

        <View style={styles.infoSection}>
          <Ionicons name="information-circle" size={20} color="#667eea" />
          <Text style={styles.infoText}>
            Anyone with the invitation link can join this trip. The invitation expires in 7 days.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  qrContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    alignItems: "center",
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  closeButton: {
    position: "absolute",
    top: 60,
    right: 20,
    padding: 4,
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  shareOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  disabledOption: {
    opacity: 0.6,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
  },
  infoSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "transparent",
    padding: 16,
    margin: 20,
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
  qrCodeSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  qrCodeContainer: {
    padding: 20,
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 30,
  },
  qrDescription: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  copyLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f4ff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  copyLinkText: {
    fontSize: 14,
    color: "#667eea",
    fontWeight: "500",
  },
});
