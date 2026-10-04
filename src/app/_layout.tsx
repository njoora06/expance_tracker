import { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Toaster } from 'sonner-native';
import { ThemeProvider, useThemeContext } from '@/store/ThemeContext';
import { AuthProvider, useAuth } from '@/store/AuthContext';
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog';
import { AnimatedSplash } from '@/components/ui/AnimatedSplash';

SplashScreen.preventAutoHideAsync();

// Long enough for one full ripple to play even when startup is instant.
const MIN_SPLASH_MS = 1800;

function RootLayoutInner() {
  const { resolvedTheme } = useThemeContext();
  const { loading: authLoading } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // The native splash is hidden by AnimatedSplash once it has drawn, to avoid a flash.
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  const showSplash = authLoading || !minTimeElapsed;
  const handleSplashHidden = useCallback(() => setSplashDone(true), []);

  return (
    <>
      <StatusBar style={!splashDone || resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="customer/[id]"
          options={{
            headerShown: true,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="customer/add-transaction"
          options={{
            headerShown: true,
            presentation: 'modal',
          }}
        />
      </Stack>
      {!splashDone && <AnimatedSplash visible={showSplash} onHidden={handleSplashHidden} />}
      <Toaster
        theme={resolvedTheme}
        position="top-center"
        duration={3000}
        richColors
        swipeToDismissDirection="up"
        visibleToasts={3}
        toastOptions={{
          style: {
            borderRadius: 14,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 8,
          },
          titleStyle: { fontSize: 15, fontWeight: '600' },
          descriptionStyle: { fontSize: 13 },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <ConfirmDialogProvider>
            <RootLayoutInner />
          </ConfirmDialogProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
