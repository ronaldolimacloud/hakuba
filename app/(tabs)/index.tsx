
import { useAuthenticator } from "@aws-amplify/ui-react-native";
import { signOut as amplifySignOut, fetchAuthSession, signInWithRedirect } from 'aws-amplify/auth';
import { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';

export default function Home() {
  const { signOut, user } = useAuthenticator();
  // Start with loginId (email/username) so we never show "Unknown" while claims load
  const [displayName, setDisplayName] = useState<string | null>(user?.signInDetails?.loginId ?? null);
  const handleGoogleSignIn = async () => {
    try {
      await signInWithRedirect({
        provider: 'Google'
      });
    } catch (error) {
      console.error('Error signing in with Google:', error);
      Alert.alert('Error', 'Failed to sign in with Google. Please try again.');
    }
  };
  const handleSignOut = async () => {
    try {
      await amplifySignOut({
        global: false,
        // This tells Amplify where to send the app after sign-out completes.
        // It must match your app's custom URL scheme configuration.
        oauth: {
          redirectUrl: 'hakuba://signout/'
        }
      });
    } catch (error) {
      console.error('Error signing out:', error);
      // Fallback to UI provider signOut if needed
      try { signOut(); } catch {}
    }
  };

  // Enrich display name from ID token claims (Google: name/given_name/email)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await fetchAuthSession();
        const claims: any = session?.tokens?.idToken?.payload ?? {};
        const claimName: string | undefined =
          claims?.name || claims?.given_name || claims?.preferred_username || claims?.nickname || claims?.email;
        if (!cancelled && claimName) {
          setDisplayName(claimName);
        } else if (!cancelled) {
          // fallback to what we already have
          setDisplayName((prev) => prev ?? user?.signInDetails?.loginId ?? null);
        }
      } catch {
        if (!cancelled) setDisplayName((prev) => prev ?? user?.signInDetails?.loginId ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.userId, user?.signInDetails?.loginId]);

  return (


    <View style={styles.container}>
      <Text style={[styles.title, { color: 'white' }]}>Welcome to Hakuba!!</Text>
      {/* If a user is signed in, show their basic info. */}
      {user && (
        <View style={styles.userInfo}>
          <Text style={styles.userText}>Signed in as:</Text>
          <Text style={styles.email}>{displayName}</Text>
          {user.signInDetails?.loginId && (
            <Text style={styles.userId}>{user.signInDetails?.loginId}</Text>
          )}
          {user.signInDetails?.authFlowType && (
            <Text style={styles.authFlow}>
              Auth Method: {user.signInDetails.authFlowType}
            </Text>
          )}
        </View>
      )}
      {/* The buttons below change depending on whether someone is signed in. */}
      <View style={styles.buttonContainer}>
        {/* If NOT signed in, show the Google sign-in button. */}
        {!user && (
          <View style={styles.signInButtons}>
            <Button 
              title="Sign In with Google" 
              onPress={handleGoogleSignIn}
              color="#4285F4"
            />
          </View>
        )}
        {/* If signed in, show the Sign Out button. */}
        {user && (
          <Button title="Sign Out" onPress={handleSignOut} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Screen wrapper that centers content
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  // Big title at the top
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  // Card-like box showing who is signed in
  userInfo: {
    backgroundColor: "#f0f0f0",
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
    width: "100%",
    alignItems: "center",
  },
  // Small helper text
  userText: {
    fontSize: 16,
    marginBottom: 10,
  },
  // Email address highlighted in blue
  email: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 5,
  },
  // User ID in a lighter style
  userId: {
    fontSize: 12,
    color: "#666",
  },
  // Shows the sign-in method (e.g., OIDC, etc.)
  authFlow: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
    fontStyle: "italic",
  },
  // Container for buttons
  buttonContainer: {
    width: "100%",
    maxWidth: 200,
  },
  // Vertical spacing for the sign-in area
  signInButtons: {
    gap: 10,
  },
});
