import { useEffect, useRef } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

// Must match the native splash (app.json) so the hand-off is invisible.
export const SPLASH_BACKGROUND = '#050914';
// These match assets/images/splash-icon.png (a 288-unit canvas: 60 logo, 120 circle,
// glow fading out at radius 92) so the native splash and this first frame are identical.
const STAGE_SIZE = 288;
const LOGO_SIZE = 60;
const CIRCLE_SIZE = 120;
const GLOW_SIZE = 200;
const ACCENT = '#00E59B';
const RIPPLE_COUNT = 3;
const RIPPLE_DURATION = 2400;

interface AnimatedSplashProps {
  visible: boolean;
  onHidden: () => void;
}

function Ripple({ index, enabled }: { index: number; enabled: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!enabled) return;
    progress.value = withDelay(
      (RIPPLE_DURATION / RIPPLE_COUNT) * index,
      withRepeat(withTiming(1, { duration: RIPPLE_DURATION, easing: Easing.out(Easing.cubic) }), -1, false)
    );
  }, [enabled, index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - progress.value),
    transform: [{ scale: 1 + 1.6 * progress.value }],
  }));

  if (!enabled) return null;
  return <Animated.View style={[styles.ripple, style]} />;
}

export function AnimatedSplash({ visible, onHidden }: AnimatedSplashProps) {
  const reduceMotion = useReducedMotion();
  const nativeHidden = useRef(false);

  const container = useSharedValue(1);
  // Solid cover over the gradient, faded out so the native splash's flat colour blends in.
  const cover = useSharedValue(1);
  const textEnter = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    cover.value = withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) });
    textEnter.value = withDelay(300, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    if (!reduceMotion) {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    }
  }, [cover, textEnter, breathe, reduceMotion]);

  useEffect(() => {
    if (visible) return;
    container.value = withTiming(0, { duration: 450, easing: Easing.inOut(Easing.quad) }, (finished) => {
      if (finished) scheduleOnRN(onHidden);
    });
  }, [visible, container, onHidden]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: container.value }));
  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value }));
  const glowStyle = useAnimatedStyle(() => ({
    // At breathe = 0 this matches the glow baked into splash-icon.png.
    opacity: 0.55 + 0.35 * breathe.value,
    transform: [{ scale: 0.92 + 0.16 * breathe.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textEnter.value,
    transform: [{ translateY: 8 * (1 - textEnter.value) }],
  }));

  const handleLayout = () => {
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    SplashScreen.hideAsync().catch(() => {});
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, containerStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
      onLayout={handleLayout}
      accessible
      accessibilityLabel="FinTrack is loading"
    >
      {/* Background gradient + soft top light */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#050914" />
            <Stop offset="0.55" stopColor="#0A1630" />
            <Stop offset="1" stopColor="#0B2B3B" />
          </LinearGradient>
          <RadialGradient id="topLight" cx="50%" cy="0%" r="70%">
            <Stop offset="0" stopColor={ACCENT} stopOpacity={0.08} />
            <Stop offset="1" stopColor={ACCENT} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bg)" />
        <Rect width="100%" height="100%" fill="url(#topLight)" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, styles.cover, coverStyle]} />

      <View style={styles.center}>
        <View style={styles.stage}>
          {/* Breathing glow behind the circle */}
          <Animated.View style={[styles.glow, glowStyle]}>
            <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
              <Defs>
                <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={ACCENT} stopOpacity={0.35} />
                  <Stop offset="0.45" stopColor="#14B8C4" stopOpacity={0.14} />
                  <Stop offset="1" stopColor={ACCENT} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#glow)" />
            </Svg>
          </Animated.View>

          {/* Ripples expanding outward from the circle */}
          {Array.from({ length: RIPPLE_COUNT }, (_, i) => (
            <Ripple key={i} index={i} enabled={!reduceMotion} />
          ))}

          {/* Subtle frosted circle holding the logo */}
          <View style={styles.circle}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Animated.View style={[styles.textBlock, textStyle]}>
            <Text style={styles.name}>FinTrack</Text>
            <Text style={styles.tagline}>Smart ledger for your business</Text>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    backgroundColor: SPLASH_BACKGROUND,
  },
  stage: {
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  ripple: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: 'rgba(0, 229, 155, 0.06)',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOpacity: 0.35,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {},
    }),
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  textBlock: {
    // Absolute so the logo stays exactly centred, matching the native splash.
    position: 'absolute',
    top: STAGE_SIZE / 2 + CIRCLE_SIZE / 2 + 28,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
