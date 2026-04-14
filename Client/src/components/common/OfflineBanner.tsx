import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

import { useNetworkStatus } from '../../hooks/useNetworkStatus';

// ─── Constants ────────────────────────────────────────────────────────────────

const BANNER_HEIGHT = 52;
const SLIDE_DURATION = 300;
const BACK_ONLINE_VISIBLE_MS = 2_000;

// ─── Component ────────────────────────────────────────────────────────────────

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  // 'offline' | 'back-online' | 'hidden'
  const [mode, setMode] = useState<'offline' | 'back-online' | 'hidden'>(
    'hidden',
  );

  const translateY = useSharedValue(-BANNER_HEIGHT);
  const prevOnlineRef = useRef(isOnline);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Slide helpers ───────────────────────────────────────────────────────────

  const slideDown = () => {
    translateY.value = withTiming(0, {
      duration: SLIDE_DURATION,
      easing: Easing.out(Easing.ease),
    });
  };

  const slideUp = (onDone?: () => void) => {
    translateY.value = withTiming(
      -BANNER_HEIGHT,
      { duration: SLIDE_DURATION, easing: Easing.in(Easing.ease) },
      (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      },
    );
  };

  // ── React to network changes ────────────────────────────────────────────────

  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!isOnline) {
      // Went offline — show orange banner
      setMode('offline');
      slideDown();
    } else if (!wasOnline && isOnline) {
      // Just came back online — show green banner briefly
      setMode('back-online');
      slideDown();

      hideTimerRef.current = setTimeout(() => {
        slideUp(() => setMode('hidden'));
      }, BACK_ONLINE_VISIBLE_MS);
    }

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // ── Animated style ──────────────────────────────────────────────────────────

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (mode === 'hidden') return null;

  // ── Render ──────────────────────────────────────────────────────────────────

  const isBackOnline = mode === 'back-online';

  return (
    <Animated.View
      style={[
        styles.banner,
        isBackOnline ? styles.bannerOnline : styles.bannerOffline,
        animatedStyle,
      ]}
    >
      <View style={styles.row}>
        <Text style={styles.icon}>{isBackOnline ? '✓' : '📡'}</Text>
        <View>
          <Text style={styles.title}>
            {isBackOnline ? 'Back online' : 'No internet connection'}
          </Text>
          {!isBackOnline && (
            <Text style={styles.subtitle}>
              Changes will sync when back online
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 999,
  },
  bannerOffline: {
    backgroundColor: '#F97316', // orange-500
  },
  bannerOnline: {
    backgroundColor: '#22C55E', // green-500
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 18,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 1,
  },
});
