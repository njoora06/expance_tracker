import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator, Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { notify } from '@/utils/notify';
import {
  APP_BACKUP_LOCATION,
  BackupInfo,
  formatFileSize,
  saveBackupToDevice,
  shareBackup,
} from '@/utils/backup';

interface BackupSheetProps {
  backup: BackupInfo;
  onClose: () => void;
}

export function BackupSheet({ backup, onClose }: BackupSheetProps) {
  const theme = useTheme();
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);

  const isWeb = Platform.OS === 'web';
  const created = new Date(backup.createdAt);

  const handleSave = async () => {
    setBusy('save');
    try {
      const location = await saveBackupToDevice(backup);
      if (location) {
        setSavedTo(location);
        notify.success('Backup saved', `Saved to ${location}`);
      }
    } catch (e) {
      console.error('[Backup] Save failed:', e);
      notify.error("Couldn't save backup", 'Try choosing a different folder.');
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setBusy('share');
    try {
      await shareBackup(backup);
    } catch (e) {
      console.error('[Backup] Share failed:', e);
      notify.error("Couldn't open share sheet");
    } finally {
      setBusy(null);
    }
  };

  const rows: { label: string; value: string }[] = [
    { label: 'File', value: backup.name },
    { label: 'Size', value: formatFileSize(backup.size) },
    {
      label: 'Contains',
      value: `${backup.counts.customers} customers · ${backup.counts.transactions} transactions`,
    },
    { label: 'Location', value: isWeb ? 'Your browser’s Downloads folder' : APP_BACKUP_LOCATION },
  ];
  if (savedTo) rows.push({ label: 'Saved copy', value: savedTo });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.container, { backgroundColor: theme.background }]} onPress={() => {}}>
          <View style={styles.dragIndicator} />

          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: theme.success + '22' }]}>
              <SymbolView
                name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                size={30}
                tintColor={theme.success}
              />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              {isWeb ? 'Backup downloaded' : 'Backup created'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {created.toLocaleDateString()} at {created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            {rows.map((row, i) => (
              <View key={row.label}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: theme.background }]} />}
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{row.label}</Text>
                  <Text style={[styles.rowValue, { color: theme.text }]} selectable>
                    {row.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {!isWeb && (
            <>
              <Text style={[styles.path, { color: theme.textSecondary }]} selectable numberOfLines={2}>
                {backup.uri}
              </Text>
              <View style={[styles.note, { backgroundColor: theme.primary + '14' }]}>
                <SymbolView
                  name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }}
                  size={18}
                  tintColor={theme.primary}
                />
                <Text style={[styles.noteText, { color: theme.text }]}>
                  App storage is erased if the app is uninstalled. Save a copy to your device to keep it safe.
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.button, { backgroundColor: theme.primary }, pressed && styles.pressed]}
                onPress={handleSave}
                disabled={busy !== null}
              >
                {busy === 'save' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <SymbolView
                      name={{ ios: 'square.and.arrow.down', android: 'download', web: 'download' }}
                      size={20}
                      tintColor="#fff"
                    />
                    <Text style={[styles.buttonText, { color: '#fff' }]}>
                      {Platform.OS === 'ios' ? 'Save to Files' : 'Save to device'}
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}
                onPress={handleShare}
                disabled={busy !== null}
              >
                {busy === 'share' ? (
                  <ActivityIndicator color={theme.text} />
                ) : (
                  <>
                    <SymbolView
                      name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                      size={20}
                      tintColor={theme.text}
                    />
                    <Text style={[styles.buttonText, { color: theme.text }]}>Share / Open</Text>
                  </>
                )}
              </Pressable>
            </>
          )}

          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={[styles.doneText, { color: theme.primary }]}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.two,
    paddingHorizontal: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 16,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C6C8CC',
    alignSelf: 'center',
    marginBottom: Spacing.three,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: 12,
  },
  rowLabel: {
    fontSize: 14,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
  },
  path: {
    fontSize: 11,
    marginTop: Spacing.two,
    marginHorizontal: Spacing.one,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 12,
    marginTop: Spacing.three,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 50,
    borderRadius: 14,
    marginTop: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  doneBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
