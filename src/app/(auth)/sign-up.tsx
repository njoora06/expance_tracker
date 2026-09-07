import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validate = () => {
    if (!fullName.trim()) {
      setError('Full name is required');
      return false;
    }
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address');
      return false;
    }
    if (!password) {
      setError('Password is required');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (!confirmPassword) {
      setError('Please confirm your password');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow access to your photo library to set a profile photo');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const handleSignUp = async () => {
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const error = await register(fullName.trim(), email.trim(), password, profilePhoto);
      if (error) {
        setError(error);
      } else {
        router.replace('/(tabs)/dashboard' as any);
      }
    } catch (e) {
      setError('Sign up failed');
    } finally {
      setLoading(false);
    }
  };

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
          <Animated.View entering={FadeIn.duration(400)}>
            {/* Brand */}
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
            />
            <Text style={[styles.brandName, { color: theme.text }]}>FinTrack</Text>

            {/* Welcome */}
            <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Sign up to get started
            </Text>

            {/* Error */}
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: '#FF6B6B15' }]}>
                <SymbolView
                  name={{ ios: 'exclamationmark.circle', android: 'error', web: 'error' }}
                  size={16}
                  weight="medium"
                  tintColor="#FF6B6B"
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Profile Photo */}
            <View style={styles.photoSection}>
              <Pressable onPress={handlePickPhoto} style={styles.photoBtn}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={[styles.photo, { borderColor: theme.backgroundElement }]} />
                ) : (
                  <View style={[styles.photoPlaceholder, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                    <SymbolView
                      name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
                      size={28}
                      weight="medium"
                      tintColor={theme.textSecondary}
                    />
                    <Text style={[styles.photoPlaceholderText, { color: theme.textSecondary }]}>
                      Add Photo
                    </Text>
                  </View>
                )}
              </Pressable>
              <Text style={[styles.photoHint, { color: theme.textSecondary }]}>
                Optional
              </Text>
            </View>

            {/* Full Name */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Full Name *</Text>
              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundElement }]}>
                <SymbolView
                  name={{ ios: 'person', android: 'person', web: 'person' }}
                  size={18}
                  weight="medium"
                  tintColor={theme.textSecondary}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="John Doe"
                  placeholderTextColor={theme.textSecondary + '80'}
                  value={fullName}
                  onChangeText={(v) => { setFullName(v); setError(''); }}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Email *</Text>
              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundElement }]}>
                <SymbolView
                  name={{ ios: 'envelope', android: 'email', web: 'email' }}
                  size={18}
                  weight="medium"
                  tintColor={theme.textSecondary}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="your@email.com"
                  placeholderTextColor={theme.textSecondary + '80'}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Password *</Text>
              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundElement }]}>
                <SymbolView
                  name={{ ios: 'lock', android: 'lock', web: 'lock' }}
                  size={18}
                  weight="medium"
                  tintColor={theme.textSecondary}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={theme.textSecondary + '80'}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(''); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  hitSlop={8}
                >
                  <SymbolView
                    name={{
                      ios: showPassword ? 'eye' : 'eye.slash',
                      android: showPassword ? 'visibility' : 'visibility_off',
                      web: showPassword ? 'visibility' : 'visibility_off',
                    }}
                    size={20}
                    weight="medium"
                    tintColor={theme.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Confirm Password *</Text>
              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundElement }]}>
                <SymbolView
                  name={{ ios: 'lock.shield', android: 'lock', web: 'lock' }}
                  size={18}
                  weight="medium"
                  tintColor={theme.textSecondary}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Re-enter your password"
                  placeholderTextColor={theme.textSecondary + '80'}
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setError(''); }}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={() => setShowConfirm(!showConfirm)}
                  style={styles.eyeBtn}
                  hitSlop={8}
                >
                  <SymbolView
                    name={{
                      ios: showConfirm ? 'eye' : 'eye.slash',
                      android: showConfirm ? 'visibility' : 'visibility_off',
                      web: showConfirm ? 'visibility' : 'visibility_off',
                    }}
                    size={20}
                    weight="medium"
                    tintColor={theme.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            {/* Submit */}
            <Pressable
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Create Account</Text>
              )}
            </Pressable>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                Already have an account?{' '}
              </Text>
              <Pressable onPress={() => router.push('/(auth)/login' as any)}>
                <Text style={[styles.footerLink, { color: '#208AEF' }]}>Sign In</Text>
              </Pressable>
            </View>
          </Animated.View>
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
    paddingTop: 60,
    flexGrow: 1,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 16,
    alignSelf: 'center',
    marginBottom: 16,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoBtn: {
    marginBottom: 4,
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
  },
  photoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  photoHint: {
    fontSize: 12,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
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
  submitBtn: {
    backgroundColor: '#208AEF',
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 15,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '700',
  },
});
