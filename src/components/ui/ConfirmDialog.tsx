import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    // Settle any dialog still open so its caller doesn't hang.
    resolverRef.current?.(false);
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  };

  const accent = options?.destructive ? theme.danger : theme.primary;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        visible={options !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => close(false)}
      >
        <Pressable style={styles.overlay} onPress={() => close(false)}>
          <Pressable
            style={[styles.card, { backgroundColor: theme.background }]}
            onPress={() => {}}
          >
            <View style={[styles.iconCircle, { backgroundColor: accent + '1A' }]}>
              <SymbolView
                name={
                  options?.destructive
                    ? { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }
                    : { ios: 'questionmark.circle.fill', android: 'help', web: 'help' }
                }
                size={28}
                tintColor={accent}
              />
            </View>

            <Text style={[styles.title, { color: theme.text }]}>{options?.title}</Text>
            {options?.message ? (
              <Text style={[styles.message, { color: theme.textSecondary }]}>
                {options.message}
              </Text>
            ) : null}

            <View style={styles.buttons}>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}
                onPress={() => close(false)}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>
                  {options?.cancelText ?? 'Cancel'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: accent },
                  pressed && styles.pressed,
                ]}
                onPress={() => close(true)}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  {options?.confirmText ?? 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used within ConfirmDialogProvider');
  return confirm;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    alignSelf: 'stretch',
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});
