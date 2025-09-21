import React, { useState } from 'react';
import { Alert, Image, ImageBackground, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { SignInResult, useAuth } from '../providers/AuthProvider';

type AuthScreen = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset' | 'newPassword';

interface NewPasswordChallenge {
  session: string;
  username: string;
}

const colors = {
  background: '#000',
  surface: '#1c1c1e',
  border: '#2c2c2e',
  primary: '#0a84ff',
  text: '#fff',
  textSecondary: '#9ca3af',
};

export default function AuthFlow() {
  const {
    signIn,
    signUp,
    confirmSignUp,
    forgotPassword,
    confirmForgotPassword,
    completeNewPassword,
  } = useAuth();
  const [screen, setScreen] = useState<AuthScreen>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [newPasswordChallenge, setNewPasswordChallenge] = useState<NewPasswordChallenge | null>(null);

  const resetForm = () => {
    setPassword('');
    setCode('');
    setNewPassword('');
  };

  const handleSignIn = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter username and password.');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn(username.trim(), password);
      handleSignInResult(result);
    } catch (error: unknown) {
      const message = extractMessage(error) ?? 'Invalid username or password.';
      Alert.alert('Sign-in failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignInResult = (result: SignInResult) => {
    if (result.kind === 'challenge') {
      setNewPasswordChallenge({ session: result.session, username: result.username });
      setScreen('newPassword');
      Alert.alert('Action required', 'Please set a new password to finish signing in.');
    } else {
      resetForm();
    }
  };

  const handleSignUp = async () => {
    if (!username || !password || !email) {
      Alert.alert('Error', 'Please fill in username, email, and password.');
      return;
    }

    setLoading(true);
    try {
      await signUp(username.trim(), password, email.trim());
      Alert.alert('Success', 'Check your email for the verification code.');
      setScreen('confirm');
    } catch (error: unknown) {
      const message = extractMessage(error) ?? 'Could not create your account.';
      Alert.alert('Sign-up failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async () => {
    if (!username || !code) {
      Alert.alert('Error', 'Please enter your username and the code.');
      return;
    }

    setLoading(true);
    try {
      await confirmSignUp(username.trim(), code.trim());
      Alert.alert('Confirmed', 'Account confirmed! Please sign in.');
      resetForm();
      setScreen('signin');
    } catch (error: unknown) {
      const message = extractMessage(error) ?? 'Could not confirm the code provided.';
      Alert.alert('Confirmation failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!username) {
      Alert.alert('Error', 'Please enter your username.');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(username.trim());
      Alert.alert('Check your email', 'We sent a reset code to your email.');
      resetForm();
      setScreen('reset');
    } catch (error: unknown) {
      const message = extractMessage(error) ?? 'Could not send the reset code.';
      Alert.alert('Request failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!username || !code || !newPassword) {
      Alert.alert('Error', 'Please enter your username, code, and new password.');
      return;
    }

    setLoading(true);
    try {
      await confirmForgotPassword(username.trim(), code.trim(), newPassword);
      Alert.alert('Success', 'Password reset! Please sign in.');
      resetForm();
      setScreen('signin');
    } catch (error: unknown) {
      const message = extractMessage(error) ?? 'Could not reset the password.';
      Alert.alert('Reset failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteNewPassword = async () => {
    if (!newPasswordChallenge?.session) {
      Alert.alert('Error', 'Missing password challenge session. Please sign in again.');
      setScreen('signin');
      setNewPasswordChallenge(null);
      return;
    }

    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password.');
      return;
    }

    setLoading(true);
    try {
      const result = await completeNewPassword(
        newPasswordChallenge.username,
        newPassword,
        newPasswordChallenge.session,
      );

      if (result.kind === 'success') {
        setNewPassword('');
        setNewPasswordChallenge(null);
      }
    } catch (error: unknown) {
      const message = extractMessage(error) ?? 'Could not update the password.';
      Alert.alert('Update failed', message);
    } finally {
      setLoading(false);
    }
  };

  const renderSignIn = () => (
    <View style={styles.container}>
      <Image
        source={require('../assets/icons/hakubawhite1.png')}
        style={styles.logo}
        resizeMode="contain"
        accessible
        accessibilityLabel="Hakuba logo"
      />
      <Text style={styles.title}>Sign In</Text>

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setScreen('forgot')}>
        <Text style={styles.linkText}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setScreen('signup')}>
        <Text style={styles.linkText}>Need an account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSignUp = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Creating…' : 'Sign Up'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setScreen('signin')}>
        <Text style={styles.linkText}>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );

  const renderConfirm = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Confirm Account</Text>
      <Text style={styles.subtitle}>Enter the code sent to your email.</Text>

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        placeholder="Verification code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
      />

      <TouchableOpacity style={styles.button} onPress={handleConfirmSignUp} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Confirming…' : 'Confirm'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setScreen('signin')}>
        <Text style={styles.linkText}>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );

  const renderForgot = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>Enter your username to receive a reset code.</Text>

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.button} onPress={handleForgotPassword} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Send reset code'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setScreen('signin')}>
        <Text style={styles.linkText}>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReset = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>Enter the code and your new password.</Text>

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        placeholder="Reset code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
      />

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        placeholder="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleResetPassword} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Resetting…' : 'Reset password'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setScreen('signin')}>
        <Text style={styles.linkText}>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNewPassword = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Update Password</Text>
      <Text style={styles.subtitle}>Set a new password to continue.</Text>

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        placeholder="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleCompleteNewPassword} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Updating…' : 'Save password'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          setNewPassword('');
          setNewPasswordChallenge(null);
          setScreen('signin');
        }}
      >
        <Text style={styles.linkText}>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ImageBackground
      source={require('../assets/images/bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} style={styles.scrollView}>
        {screen === 'signin' && renderSignIn()}
        {screen === 'signup' && renderSignUp()}
        {screen === 'confirm' && renderConfirm()}
        {screen === 'forgot' && renderForgot()}
        {screen === 'reset' && renderReset()}
        {screen === 'newPassword' && renderNewPassword()}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: 'transparent',
    padding: 24,
    borderRadius: 12,
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  logo: {
    width: 300,
    height: 300,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#f1020a',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'transparent',
  },
  button: {
    backgroundColor: '#f1020a',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    color: '#f1020a',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
});

const extractMessage = (error: unknown): string | null => {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return (error as { message: string }).message;
  }

  return null;
};
