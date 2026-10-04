import * as ImagePicker from 'expo-image-picker';
import { PickerModal } from '@/components/ui/PickerModal';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { BackupSheet } from '@/components/ui/BackupSheet';
import { useAuth } from '@/hooks/use-auth';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { clearAllData, restoreData } from '@/store/storage';
import { CURRENCIES, CurrencyCode, ThemeMode } from '@/store/types';
import { notify } from '@/utils/notify';
import { BackupInfo, createBackupFile, getLastBackupDate, pickBackupFile } from '@/utils/backup';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const systemScheme = useColorScheme();
  const { theme: themeMode, currency, setTheme, setCurrency } = useSettings();
  const { user, logout, updateProfile } = useAuth();
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const confirm = useConfirm();
  const [backupResult, setBackupResult] = useState<BackupInfo | null>(null);
  const [lastBackup, setLastBackup] = useState<Date | null>(() => {
    try {
      return getLastBackupDate();
    } catch {
      return null;
    }
  });

  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify.error('Permission needed', 'Allow photo library access to update your profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        await updateProfile(result.assets[0].uri);
        notify.success('Profile photo updated');
      } catch (e) {
        notify.error("Couldn't update photo");
      }
    }
  };

  const handleRemovePhoto = async () => {
    const ok = await confirm({
      title: 'Remove profile photo?',
      message: 'Your profile will show your initials instead.',
      confirmText: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      await updateProfile('');
      notify.success('Profile photo removed');
    } catch (e) {
      notify.error("Couldn't remove photo");
    }
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
      const info = await notify.promise(createBackupFile(user.id), {
        loading: 'Creating backup…',
        success: 'Backup created',
        error: "Couldn't create backup",
      });
      setLastBackup(new Date(info.createdAt));
      setBackupResult(info);
    } catch (e) {
      // Error toast already shown by notify.promise.
      console.error('[Backup] Create failed:', e);
    }
  };

  const handleRestore = async () => {
    if (!user) return;
    let preview;
    try {
      preview = await pickBackupFile();
    } catch (e) {
      notify.error(
        e instanceof Error && e.message === 'Not a FinTrack backup file' ? e.message : "Couldn't read backup file",
        'Choose a .json file created with FinTrack Backup.'
      );
      return;
    }
    if (!preview) return;

    const { customers, transactions } = preview.counts;
    const from = preview.createdAt ? ` from ${new Date(preview.createdAt).toLocaleDateString()}` : '';
    const ok = await confirm({
      title: 'Restore backup?',
      message: `Import ${customers} customers and ${transactions} transactions${from}. Existing records with the same ID will be overwritten.`,
      confirmText: 'Restore',
    });
    if (!ok) return;

    const error = await restoreData(preview.text, user.id);
    if (error) {
      notify.error("Couldn't restore backup", error);
    } else {
      notify.success('Backup restored', `${customers} customers · ${transactions} transactions`);
    }
  };

  const handleClearData = async () => {
    if (!user) return;
    const ok = await confirm({
      title: 'Clear all data?',
      message: 'All customers and transactions will be permanently deleted. This cannot be undone.',
      confirmText: 'Clear data',
      destructive: true,
    });
    if (!ok) return;
    try {
      await clearAllData(user.id);
      notify.success('All data cleared');
    } catch (e) {
      notify.error("Couldn't clear data");
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Log out?',
      message: 'You will need to sign in again to access your ledger.',
      confirmText: 'Log out',
      destructive: true,
    });
    if (!ok) return;
    await logout();
    router.replace('/(auth)/login');
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
              <View>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Create Backup</Text>
                <Text style={[styles.settingHint, { color: theme.textSecondary }]}>
                  {lastBackup
                    ? `Last backup: ${lastBackup.toLocaleDateString()} ${lastBackup.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Save your customers and transactions to a file'}
                </Text>
              </View>
              <Text style={[styles.settingArrow, { color: theme.textSecondary }]}>›</Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: theme.background }]} />
            {Platform.OS !== 'web' && (
              <>
                <Pressable style={styles.settingRow} onPress={handleRestore}>
                  <View>
                    <Text style={[styles.settingLabel, { color: theme.text }]}>Restore from Backup</Text>
                    <Text style={[styles.settingHint, { color: theme.textSecondary }]}>
                      Import a FinTrack backup file
                    </Text>
                  </View>
                  <Text style={[styles.settingArrow, { color: theme.textSecondary }]}>›</Text>
                </Pressable>
                <View style={[styles.divider, { backgroundColor: theme.background }]} />
              </>
            )}
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

      {backupResult && (
        <BackupSheet key={backupResult.name} backup={backupResult} onClose={() => setBackupResult(null)} />
      )}
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
