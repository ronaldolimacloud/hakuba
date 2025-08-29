import { getCurrentUser } from "aws-amplify/auth";
import { router } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";
import { ApiError, inviteApi } from "../utils/api";

interface InviteHandlerProps {
  inviteId?: string;
}

export default function InviteHandler({ inviteId }: InviteHandlerProps) {
  useEffect(() => {
    if (inviteId) {
      handleInvite(inviteId);
    }
  }, [inviteId]);

  const handleInvite = async (inviteId: string) => {
    try {
      // Ensure user is authenticated
      await getCurrentUser();

      // Get invite info to show user what they're joining
      const inviteInfo = await inviteApi.getInviteInfo(inviteId);

      // If already a member, just navigate
      if (inviteInfo.alreadyMember) {
        router.push({ pathname: "/(tabs)/trip/[trip]", params: { trip: inviteInfo.tripId } });
        return;
      }

      // Show confirmation dialog
      Alert.alert(
        "Join Trip",
        `Would you like to join "${inviteInfo.tripName}"?\n\nMembers: ${inviteInfo.memberCount}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Join",
            onPress: async () => {
              try {
                const joinResult = await inviteApi.joinTrip(inviteId);

                // Navigate to the trip
                Alert.alert(
                  "Welcome!",
                  joinResult.message || `You've successfully joined "${joinResult.tripName}"!`,
                  [
                    {
                      text: "View Trip",
                      onPress: () => router.push({ pathname: "/(tabs)/trip/[trip]", params: { trip: joinResult.tripId } })
                    }
                  ]
                );

              } catch (error) {
                console.error("Error joining trip:", error);
                const message = error instanceof ApiError ? error.message : "Failed to join trip. Please try again.";
                Alert.alert("Join Failed", message);
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error("Error handling invite:", error);
      const message = error instanceof ApiError ? error.message : "Failed to process invitation. Please try again.";
      Alert.alert("Invalid Invite", message);
    }
  };

  return null; // This component doesn't render anything
}
