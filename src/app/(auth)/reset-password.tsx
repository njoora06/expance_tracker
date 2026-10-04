import { useTheme } from '@/hooks/use-theme';
import { cancelPasswordReset, resetPassword } from '@/store/auth';
import { notify } from '@/utils/notify';
import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const passwordError =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH
      ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      : submitted && !password
        ? 'New password is required'
        : '';
  const confirmError =
    confirmPassword.length > 0 && confirmPassword !== password
      ? 'Passwords do not match'
      : submitted && !confirmPassword
        ? 'Please confirm your new password'
        : '';
  const isValid = password.length >= MIN_PASSWORD_LENGTH && confirmPassword === password;

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!isValid) return;
    setSaving(true);
    try {
      await resetPassword(token ?? '', password);
      notify.success('Password changed', 'Sign in with your new password.');
      router.replace('/(auth)/login' as any);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't change password";
      notify.error("Couldn't change password", message);
      if (message.startsWith('Verification expired')) {
        router.replace('/(auth)/forgot-password' as any);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    cancelPasswordReset();
    router.replace('/(auth)/login' as any);
  };

  const renderPasswordField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    visible: boolean,
    toggle: () => void,
    placeholder: string,
    fieldError: string,
    icon: { ios: string; android: string; web: string }
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: theme.backgroundElement },
          fieldError ? { borderColor: theme.danger, borderWidth: 1 } : null,
        ]}
      >
        <SymbolView name={icon as any} size={18} weight="medium" tintColor={theme.textSecondary} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary + '80'}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable onPress={toggle} style={styles.eyeBtn} hitSlop={8}>
          <SymbolView
            name={{
              ios: visible ? 'eye' : 'eye.slash',
              android: visible ? 'visibility' : 'visibility_off',
              web: visible ? 'visibility' : 'visibility_off',
            }}
            size={20}
            weight="medium"
            tintColor={theme.textSecondary}
          />
        </Pressable>
      </View>
      {fieldError ? <Text style={[styles.fieldError, { color: theme.danger }]}>{fieldError}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.appName, { color: '#208AEF' }]}>FinTrackLedger</Text>

          <View style={[styles.verifiedBadge, { backgroundColor: theme.success + '1F' }]}>
            <SymbolView
              name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }}
              size={16}
              tintColor={theme.success}
            />
            <Text style={[styles.verifiedText, { color: theme.success }]}>Identity verified</Text>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Create New Password</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose a new password for your account. You&apos;ll use it to sign in from now on.
          </Text>

          {renderPasswordField(
            'New Password',
            password,
            setPassword,
            showPassword,
            () => setShowPassword(!showPassword),
            `Min. ${MIN_PASSWORD_LENGTH} characters`,
            passwordError,
            { ios: 'lock', android: 'lock', web: 'lock' }
          )}
          {renderPasswordField(
            'Confirm Password',
            confirmPassword,
            setConfirmPassword,
            showConfirm,
            () => setShowConfirm(!showConfirm),
            'Re-enter your new password',
            confirmError,
            { ios: 'lock.shield', android: 'lock', web: 'lock' }
          )}

          <Pressable
            style={[styles.submitBtn, (!isValid || saving) && styles.disabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Change Password</Text>
            )}
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={[styles.cancelText, { color: '#208AEF' }]}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    padding: 24,
    paddingTop: 40,
    flexGrow: 1,
  },
  appName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 24,
    letterSpacing: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  verifiedText: {
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 32,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
  },
  eyeBtn: {
    paddingVertical: 16,
    paddingLeft: 8,
  },
  fieldError: {
    fontSize: 12,
    marginTop: 6,
  },
  submitBtn: {
    backgroundColor: '#208AEF',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    marginTop: 8,
    marginBottom: 12,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
