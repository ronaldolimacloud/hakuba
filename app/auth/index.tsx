import { Redirect } from 'expo-router';
import { SafeAreaView, StyleSheet } from 'react-native';
import AuthFlow from '../../components/AuthFlow';
import { useAuth } from '../../providers/AuthProvider';

export default function AuthScreen() {
  const { status } = useAuth();

  if (status === 'authenticated') {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <AuthFlow />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
