import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/hooks/use-settings';

export default function TabLayout() {
  const theme = useTheme();
  const { theme: themeMode } = useSettings();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.backgroundElement,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarActiveTintColor: '#208AEF',
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={focused ? '📊' : '📋'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-customer"
        options={{
          title: 'Add Customer',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={focused ? '➕' : '➕'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={focused ? '👥' : '👤'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={focused ? '📈' : '📉'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={focused ? '⚙️' : '🔧'} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

import { Text, View } from 'react-native';

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>{icon}</Text>
    </View>
  );
}
