import { post } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert, AppState } from "react-native";

// Store the invite ID when user clicks link but isn't authenticated
let pendingInviteId: string | null = null;

export default function InviteHandler() {
  const appState = useRef(AppState.currentState);
  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInviteLink = async (inviteId: string, skipAuth = false) => {
    try {
      console.log("Handling invite link:", inviteId);

      // If not authenticated and we haven't skipped auth check
      if (!skipAuth) {
        try {
          await getCurrentUser();
        } catch {
          console.log("User not authenticated, storing invite for later");
          pendingInviteId = inviteId;

          Alert.alert(
            "Join Trip",
            "You've been invited to join a trip. Please sign in first.",
            [
              { text: "Cancel", style: "cancel", onPress: () => { pendingInviteId = null; } },
              {
                text: "Sign In",
                onPress: () => {
                  // Authenticator is already shown at root level — user just needs to sign in
                }
              }
            ]
          );
          return;
        }
      }

      // Join via backend
      const response = await post({
        apiName: "app-api",
        path: "/invite/join",
        options: {
          body: { inviteId },
        },
      }).response;

      let result: any;
      try {
        result = await response.body.json();
      } catch {
        throw new Error("Invalid response from server");
      }

      if (response.statusCode === 200 && result.tripId) {
        Alert.alert(
          "Welcome!",
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
      } else {
        throw new Error(result?.error || "Failed to join trip");
      }
    } catch (error: any) {
      console.error("Error handling invite:", error);
      const message = error?.response?.body?.error || error?.message || "Something went wrong. Please try again later.";
      Alert.alert("Error", message);
    }
  };

  const processDeepLink = (url: string) => {
    console.log("Processing deep link:", url);

    const parsed = Linking.parse(url);
    console.log("Parsed link:", parsed);

    // Check if it's an invitation link: hakuba://invite/INVITE_ID
    if (parsed.hostname === "invite" && parsed.path) {
      const inviteId = parsed.path.replace(/^\/+/, "");
      if (inviteId) {
        handleInviteLink(inviteId);
      }
    }
  };

  // Handle pending invites after authentication
  const processPendingInvite = async () => {
    if (pendingInviteId) {
      const inviteId = pendingInviteId;
      pendingInviteId = null;

      console.log("Processing pending invite after auth:", inviteId);

      // Small delay to ensure user is fully authenticated
      pendingTimeout.current = setTimeout(() => {
        handleInviteLink(inviteId, true);
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
        processPendingInvite();
      }
      appState.current = nextAppState;
    };

    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    handleInitialURL();

    return () => {
      subscription?.remove();
      appStateSubscription?.remove();
      if (pendingTimeout.current) clearTimeout(pendingTimeout.current);
    };
  }, []);

  // Check for pending invites periodically (max 5 attempts after auth)
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 5;

    const timer = setInterval(() => {
      if (pendingInviteId) {
        attempts++;
        processPendingInvite();
      }
      if (attempts >= maxAttempts || !pendingInviteId) {
        clearInterval(timer);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  return null;
}

export const clearPendingInvite = () => {
  pendingInviteId = null;
};

export const hasPendingInvite = () => {
  return !!pendingInviteId;
};
