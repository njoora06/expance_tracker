import { useTheme } from '@/hooks/use-theme';
import {
  cancelPasswordReset,
  findUserForReset,
  getDeviceLockStatus,
  verifyWithDeviceLock,
} from '@/store/auth';
import { notify } from '@/utils/notify';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
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

type Step = 'email' | 'verify';
type VerifyState = 'prompting' | 'idle' | 'no_lock' | 'unsupported' | 'verified';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<{ userId: string; fullName: string } | null>(null);
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');

  const validate = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address');
      return false;
    }
    return true;
  };

  const runVerification = async (userId: string) => {
    setError('');
    const status = await getDeviceLockStatus();
    if (status !== 'available') {
      setVerifyState(status);
      return;
    }

    setVerifyState('prompting');
    const result = await verifyWithDeviceLock(userId);
    if (result.ok) {
      setVerifyState('verified');
      router.replace({ pathname: '/(auth)/reset-password', params: { token: result.token } } as any);
      return;
    }
    if (result.reason === 'no_lock') {
      setVerifyState('no_lock');
      return;
    }
    setVerifyState('idle');
    if (result.reason === 'failed') {
      setError(result.message ?? 'Verification failed. Try again.');
    }
  };

  const handleContinue = async () => {
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const found = await findUserForReset(email);
      setAccount(found);
      setStep('verify');
      // Open the system prompt straight away; the retry button covers cancels.
      await runVerification(found.userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    cancelPasswordReset();
    setStep('email');
    setAccount(null);
    setVerifyState('idle');
    setError('');
  };

  const handleRetry = () => {
    if (!account) return;
    runVerification(account.userId).catch((e) => {
      console.error('[Auth] Device verification failed:', e);
      setVerifyState('idle');
      notify.error("Couldn't start verification");
    });
  };

  const goToLogin = () => {
    cancelPasswordReset();
    router.replace('/(auth)/login' as any);
  };

  const iconTint = verifyState === 'verified' ? theme.success : verifyState === 'no_lock' || verifyState === 'unsupported' ? theme.danger : theme.primary;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.appName, { color: '#208AEF' }]}>FinTrackLedger</Text>
          <Text style={[styles.title, { color: theme.text }]}>Forgot Password</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {step === 'email'
              ? 'Enter the email you signed up with. You will confirm it\'s you with your phone\'s screen lock.'
              : `Hi ${account?.fullName ?? ''}, verify it's you to create a new password.`}
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: '#FF6B6B20' }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {step === 'email' ? (
            <>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.backgroundElement, color: theme.text },
                  ]}
                  placeholder="your@email.com"
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={handleContinue}
                />
              </View>

              <Pressable
                style={[styles.submitBtn, loading && styles.disabled]}
                onPress={handleContinue}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Continue</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <View style={[styles.verifyCard, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.iconCircle, { backgroundColor: iconTint + '1F' }]}>
                  <SymbolView
                    name={
                      verifyState === 'verified'
                        ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }
                        : verifyState === 'no_lock' || verifyState === 'unsupported'
                          ? { ios: 'lock.slash', android: 'no_encryption', web: 'no_encryption' }
                          : { ios: 'touchid', android: 'fingerprint', web: 'fingerprint' }
                    }
                    size={44}
                    tintColor={iconTint}
                  />
                </View>
                <Text style={[styles.verifyTitle, { color: theme.text }]}>
                  {verifyState === 'verified'
                    ? 'Verified'
                    : verifyState === 'no_lock'
                      ? 'No screen lock set up'
                      : verifyState === 'unsupported'
                        ? 'Not available here'
                        : verifyState === 'prompting'
                          ? 'Waiting for verification…'
                          : 'Verify it\'s you'}
                </Text>
                <Text style={[styles.verifyText, { color: theme.textSecondary }]}>
                  {verifyState === 'no_lock'
                    ? 'Set up a screen lock (PIN, pattern or fingerprint) in your phone\'s Settings, then try again.'
                    : verifyState === 'unsupported'
                      ? 'Password reset is only available in the mobile app.'
                      : 'Use your fingerprint, face, PIN or pattern — the same way you unlock your phone.'}
                </Text>
              </View>

              {verifyState !== 'unsupported' && (
                <Pressable
                  style={[styles.submitBtn, verifyState === 'prompting' && styles.disabled]}
                  onPress={handleRetry}
                  disabled={verifyState === 'prompting'}
                >
                  {verifyState === 'prompting' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {verifyState === 'no_lock' ? 'Try Again' : 'Verify with Fingerprint / PIN'}
                    </Text>
                  )}
                </Pressable>
              )}

              <Pressable style={styles.secondaryBtn} onPress={handleChangeEmail}>
                <Text style={[styles.footerLink, { color: '#208AEF' }]}>Use a different email</Text>
              </Pressable>
            </>
          )}

          <View style={styles.footer}>
            <Pressable onPress={goToLogin}>
              <Text style={[styles.footerLink, { color: '#208AEF' }]}>
                Back to Sign In
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
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
  errorBox: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
  },
  submitBtn: {
    backgroundColor: '#208AEF',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 58,
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  verifyCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  verifyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  verifyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '700',
  },
});
