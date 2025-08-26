import { get, post } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert, AppState } from "react-native";

// Store the invite ID when user clicks link but isn't authenticated
let pendingInviteId: string | null = null;

export default function InviteHandler() {
  const appState = useRef(AppState.currentState);

  const handleInviteLink = async (inviteId: string, skipAuth = false) => {
    try {
      console.log("Handling invite link:", inviteId);

      // If not authenticated and we haven't skipped auth check
      if (!skipAuth) {
        try {
          await getCurrentUser();
        } catch (error) {
          console.log("User not authenticated, storing invite for later");
          // Store the invite ID and let them authenticate first
          pendingInviteId = inviteId;
          
          // Show preview of what they're joining
          try {
            const response = await get({
              apiName: "app-api", 
              path: `/invite/info?inviteId=${inviteId}`
            }).response;
            
            const inviteInfo = await response.body.json();
            
            if (response.status === 200) {
              Alert.alert(
                "Join Trip",
                `You've been invited to join "${inviteInfo.tripName}". Please sign in first.`,
                [
                  { text: "Cancel", style: "cancel" },
                  { 
                    text: "Sign In", 
                    onPress: () => router.replace("/(modals)/settings") 
                  }
                ]
              );
            }
          } catch (previewError) {
            console.error("Error getting invite preview:", previewError);
            Alert.alert(
              "Join Trip",
              "You've been invited to join a trip. Please sign in first.",
              [
                { text: "Cancel", style: "cancel" },
                { 
                  text: "Sign In", 
                  onPress: () => router.replace("/(modals)/settings") 
                }
              ]
            );
          }
          return;
        }
      }

      // TEMPORARY: Until backend deploys, inviteId is actually tripId
      // Try to join via backend first, fallback to direct navigation
      try {
        const response = await post({
          apiName: "app-api",
          path: "/invite/join",
          options: {
            body: { inviteId },
          },
        }).response;

        const result = await response.body.json();

        if (response.status === 200) {
          Alert.alert(
            "Welcome! 🎉",
            result.message || "You've successfully joined the trip!",
            [
              {
                text: "View Trip",
                onPress: () => {
                  router.replace(`/(tabs)/trip/${result.tripId}`);
                },
              },
            ]
          );
          return;
        }
      } catch (backendError) {
        console.log("Backend not ready, using temporary direct navigation:", backendError);
      }

      // TEMPORARY FALLBACK: Direct navigation using inviteId as tripId
      Alert.alert(
        "Join Trip",
        "Opening the trip...",
        [
          {
            text: "View Trip",
            onPress: () => {
              // Use inviteId as tripId since we're temporarily using tripId as invite code
              router.replace(`/(tabs)/trip/${inviteId}`);
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error handling invite:", error);
      Alert.alert("Error", "Something went wrong. Please try again later.");
    }
  };

  const processDeepLink = (url: string) => {
    console.log("Processing deep link:", url);
    
    const parsed = Linking.parse(url);
    console.log("Parsed link:", parsed);
    
    // Check if it's an invitation link: hakuba://invite/INVITE_ID
    if (parsed.hostname === "invite" && parsed.path) {
      const inviteId = parsed.path.replace("/", "");
      if (inviteId) {
        handleInviteLink(inviteId);
      }
    }
  };

  // Handle pending invites after authentication
  const processPendingInvite = async () => {
    if (pendingInviteId) {
      const inviteId = pendingInviteId;
      pendingInviteId = null; // Clear it immediately
      
      console.log("Processing pending invite after auth:", inviteId);
      
      // Small delay to ensure user is fully authenticated
      setTimeout(() => {
        handleInviteLink(inviteId, true); // Skip auth check since we just authenticated
      }, 1000);
    }
  };

  useEffect(() => {
    // Handle app launch with deep link
    const handleInitialURL = async () => {
      const initialURL = await Linking.getInitialURL();
      if (initialURL) {
        processDeepLink(initialURL);
      }
    };

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      processDeepLink(event.url);
    });

    // Handle app state changes to process pending invites
    const handleAppStateChange = (nextAppState: string) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground, check for pending invites
        processPendingInvite();
      }
      appState.current = nextAppState;
    };

    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    handleInitialURL();

    // Clean up
    return () => {
      subscription?.remove();
      appStateSubscription?.remove();
    };
  }, []);

  // Also expose a way to manually process pending invites
  // This can be called after successful authentication
  useEffect(() => {
    const timer = setInterval(() => {
      if (pendingInviteId) {
        processPendingInvite();
      }
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  return null; // This is a utility component with no UI
}

// Export utility functions for use in authentication flow
export const clearPendingInvite = () => {
  pendingInviteId = null;
};

export const hasPendingInvite = () => {
  return !!pendingInviteId;
};

export const processPendingInviteManually = async () => {
  if (pendingInviteId) {
    const inviteId = pendingInviteId;
    pendingInviteId = null;
    
    const response = await post({
      apiName: "app-api",
      path: "/invite/join",
      options: {
        body: { inviteId },
      },
    }).response;

    const result = await response.body.json();

    if (response.status === 200) {
      Alert.alert(
        "Welcome! 🎉",
        result.message || "You've successfully joined the trip!",
        [
          {
            text: "View Trip",
            onPress: () => {
              router.replace(`/(tabs)/trip/${result.tripId}`);
            },
          },
        ]
      );
    }
  }
};
