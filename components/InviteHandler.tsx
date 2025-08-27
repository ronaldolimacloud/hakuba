import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import { router } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";
import type { Schema } from "../amplify/data/resource";

interface InviteHandlerProps {
  inviteId?: string;
}

export default function InviteHandler({ inviteId }: InviteHandlerProps) {
  const client = generateClient<Schema>();

  useEffect(() => {
    if (inviteId) {
      handleInvite(inviteId);
    }
  }, [inviteId]);

  const handleInvite = async (inviteId: string) => {
    try {
      // Get current user
      const user = await getCurrentUser();
      
      // Get the invite
      const inviteResult = await client.models.TripInvite.get({ id: inviteId });
      const invite = inviteResult.data;
      
      if (!invite) {
        Alert.alert("Invalid Invite", "This invitation link is not valid.");
        return;
      }

      // Check if invite is still valid
      const now = new Date();
      const expiresAt = new Date(invite.expiresAt);
      
      if (now > expiresAt || !invite.isActive) {
        Alert.alert("Expired Invite", "This invitation has expired.");
        return;
      }

      // Check if user has already used this invite
      if (invite.usedBy?.includes(user.userId)) {
        // User already joined, just navigate to trip
        router.push({ pathname: "/(tabs)/trip/[trip]", params: { trip: invite.tripId } });
        return;
      }

      // Get the trip and add user to it
      const tripResult = await client.models.Trip.get({ id: invite.tripId });
      const trip = tripResult.data;
      
      if (!trip) {
        Alert.alert("Error", "Trip not found.");
        return;
      }

      // Add user to trip owners
      const updatedOwners = [...(trip.owners || []), user.userId];
      await client.models.Trip.update({
        id: invite.tripId,
        owners: updatedOwners,
      });

      // Update invite usage
      const updatedUsedBy = [...(invite.usedBy || []), user.userId];
      await client.models.TripInvite.update({
        id: inviteId,
        usedBy: updatedUsedBy,
        usedCount: (invite.usedCount || 0) + 1,
      });

      // Navigate to the trip
      Alert.alert(
        "Welcome!",
        `You've successfully joined "${trip.name}"!`,
        [
          {
            text: "View Trip",
            onPress: () => router.push({ pathname: "/(tabs)/trip/[trip]", params: { trip: invite.tripId } })
          }
        ]
      );

    } catch (error) {
      console.error("Error handling invite:", error);
      Alert.alert("Error", "Failed to join trip. Please try again.");
    }
  };

  return null; // This component doesn't render anything
}
