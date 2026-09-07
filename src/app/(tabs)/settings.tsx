import * as ImagePicker from 'expo-image-picker';
import { PickerModal } from '@/components/ui/PickerModal';
import { useAuth } from '@/hooks/use-auth';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { backupData, clearAllData } from '@/store/storage';
import { CURRENCIES, CurrencyCode, ThemeMode } from '@/store/types';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const systemScheme = useColorScheme();
  const { theme: themeMode, currency, setTheme, setCurrency } = useSettings();
  const { user, logout, updateProfile } = useAuth();
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow access to your photo library to update your profile photo');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await updateProfile(result.assets[0].uri);
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => updateProfile(''),
      },
    ]);
  };

  const getThemeLabel = useCallback(() => {
    switch (themeMode) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'system': return 'System';
    }
  }, [themeMode]);

  const handleBackup = async () => {
    if (!user) return;
    try {
      const data = await backupData(user.id);
      Alert.alert('Backup', 'Backup created successfully.');
    } catch (e) {
      Alert.alert('Error', 'Failed to create backup');
    }
  };

  const handleClearData = () => {
    if (!user) return;
    Alert.alert('Clear All Data', 'This will permanently delete all customers and transactions. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          await clearAllData(user.id);
          Alert.alert('Done', 'All data cleared');
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Good Night';
  }, []);

  const themeOptions = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'system' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Profile */}
        <View style={styles.profileSection}>
          <Pressable onPress={handleChangePhoto}>
            {user?.profilePhoto ? (
              <Image source={{ uri: user.profilePhoto }} style={styles.profileAvatar} />
            ) : (
              <View style={[styles.profileAvatarPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.profileAvatarInitial, { color: theme.textSecondary }]}>
                  {user?.fullName?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={handleChangePhoto}>
            <Text style={[styles.changePhotoText, { color: '#208AEF' }]}>
              {user?.profilePhoto ? 'Change Photo' : 'Add Photo'}
            </Text>
          </Pressable>
          {user?.profilePhoto ? (
            <Pressable onPress={handleRemovePhoto} style={styles.removePhotoBtn}>
              <Text style={[styles.removePhotoText, { color: '#FF6B6B' }]}>Remove</Text>
            </Pressable>
          ) : null}
          <Text style={[styles.profileGreeting, { color: theme.textSecondary }]}>
            {getGreeting()}
          </Text>
          <Text style={[styles.profileName, { color: theme.text }]}>
            {user?.fullName || 'User'}
          </Text>
          <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
            {user?.email}
          </Text>
        </View>

        {/* Theme */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Appearance</Text>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Theme</Text>
                <Text style={[styles.settingHint, { color: theme.textSecondary }]}>
                  Current: {getThemeLabel()}
                </Text>
              </View>
              <View style={styles.themeOptions}>
                {themeOptions.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.themeOption,
                      { backgroundColor: theme.background },
                      themeMode === opt.value && { backgroundColor: '#208AEF' },
                    ]}
                    onPress={() => setTheme(opt.value as ThemeMode)}
                  >
                    <Text style={[styles.themeOptionText, { color: theme.textSecondary }, themeMode === opt.value && { color: '#fff' }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Currency */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Currency</Text>
          <Pressable
            style={[styles.card, styles.settingRow, { backgroundColor: theme.backgroundElement }]}
            onPress={() => setShowCurrencyPicker(true)}
          >
            <View>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Currency</Text>
              <Text style={[styles.settingHint, { color: theme.textSecondary }]}>
                {CURRENCIES.find((c) => c.code === currency)?.name || currency} ({currency})
              </Text>
            </View>
            <Text style={[styles.settingArrow, { color: theme.textSecondary }]}>›</Text>
          </Pressable>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Data Management</Text>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <Pressable style={styles.settingRow} onPress={handleBackup}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Backup</Text>
              <Text style={[styles.settingArrow, { color: theme.textSecondary }]}>›</Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: theme.background }]} />
            <Pressable style={styles.settingRow} onPress={handleClearData}>
              <Text style={[styles.settingLabel, { color: '#FF6B6B' }]}>Clear All Data</Text>
            </Pressable>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.logoutSection}>
          <Pressable
            style={[styles.card, styles.logoutBtn, { backgroundColor: '#FF3B30' }]}
            onPress={handleLogout}
          >
            <Text style={[styles.settingLabel, { color: '#fff', textAlign: 'center' }]}>Logout</Text>
          </Pressable>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>About</Text>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>App Name</Text>
              <Text style={[styles.settingValue, { color: theme.textSecondary }]}>FinTrackLedger</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.background }]} />
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Version</Text>
              <Text style={[styles.settingValue, { color: theme.textSecondary }]}>1.0.0</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.background }]} />
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Built with</Text>
              <Text style={[styles.settingValue, { color: theme.textSecondary }]}>Expo SDK 57</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.footer, { color: '#208AEF' }]}>
          Designed & Developed by Neeraj Patel
        </Text>
      </ScrollView>

      <PickerModal
        visible={showCurrencyPicker}
        title="Select Currency"
        options={CURRENCIES.map((c) => ({ label: `${c.name} (${c.symbol})`, value: c.code }))}
        selected={currency}
        onSelect={(v) => setCurrency(v as CurrencyCode)}
        onClose={() => setShowCurrencyPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 4,
  },
  card: { borderRadius: 14, overflow: 'hidden' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLabel: { fontSize: 16, fontWeight: '500' },
  settingHint: { fontSize: 13, marginTop: 2 },
  settingValue: { fontSize: 14 },
  settingArrow: { fontSize: 24, fontWeight: '300' },
  divider: { height: 1, marginHorizontal: 16 },
  profileSection: { alignItems: 'center', paddingVertical: 16, marginBottom: 24 },
  profileAvatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 8 },
  profileAvatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36, marginBottom: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarInitial: { fontSize: 28, fontWeight: '700' },
  changePhotoText: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  removePhotoBtn: { marginBottom: 8 },
  removePhotoText: { fontSize: 12, fontWeight: '500' },
  profileGreeting: { fontSize: 14, marginBottom: 2 },
  profileName: { fontSize: 22, fontWeight: '700', marginBottom: 2 },
  profileEmail: { fontSize: 14 },
  logoutSection: { marginTop: 8, marginBottom: 24 },
  logoutBtn: { paddingVertical: 18 },
  themeOptions: { flexDirection: 'row', gap: 6 },
  themeOption: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  themeOptionText: { fontSize: 13, fontWeight: '600' },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    paddingTop: 12,
    paddingBottom: 8,
  },
});
