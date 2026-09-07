import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useThemeContext } from '@/store/ThemeContext';
import { AuthProvider } from '@/store/AuthContext';

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const { resolvedTheme } = useThemeContext();

  useEffect(() => {
    async function hide() {
      await SplashScreen.hideAsync();
    }
    hide();
  }, []);

  return (
    <>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
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
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </ThemeProvider>
  );
}
