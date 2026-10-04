import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { SPLASH_BACKGROUND } from '@/components/ui/AnimatedSplash';

export default function SplashScreen() {
  const { user, loading } = useAuth();

  // AnimatedSplash (rendered in the root layout) covers this while auth loads.
  if (loading) {
    return <View style={{ flex: 1, backgroundColor: SPLASH_BACKGROUND }} />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
