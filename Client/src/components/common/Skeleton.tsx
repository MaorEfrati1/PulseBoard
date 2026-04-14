import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Colors, Radius } from '../../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Skeleton({
  width = '100%',
  height = 16,
  radius = Radius.sm,
  style,
}: SkeletonProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as ViewStyle['width'], height, borderRadius: radius },
        animatedStyle,
        style,
      ]}
    />
  );
}

// ─── AISummary skeleton ───────────────────────────────────────────────────────

export function AISummarySkeleton() {
  return (
    <View style={styles.aiCard}>
      <View style={styles.aiHeader}>
        <Skeleton width={32} height={32} radius={Radius.md} />
        <View style={styles.aiHeaderText}>
          <Skeleton width={120} height={14} />
          <Skeleton width={80} height={11} style={styles.mt4} />
        </View>
      </View>
      <Skeleton width="100%" height={12} style={styles.mt12} />
      <Skeleton width="85%" height={12} style={styles.mt6} />
      <Skeleton width="70%" height={12} style={styles.mt6} />
      <View style={styles.statsRow}>
        <Skeleton width={72} height={52} radius={Radius.md} />
        <Skeleton width={72} height={52} radius={Radius.md} />
        <Skeleton width={72} height={52} radius={Radius.md} />
      </View>
    </View>
  );
}

// ─── TaskCard skeleton ────────────────────────────────────────────────────────

export function TaskCardSkeleton() {
  return (
    <View style={styles.taskCard}>
      <View style={styles.row}>
        <Skeleton width={8} height={52} radius={4} />
        <View style={styles.taskContent}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="45%" height={11} style={styles.mt6} />
          <View style={styles.row}>
            <Skeleton width={60} height={20} radius={Radius.full} style={styles.mr8} />
            <Skeleton width={60} height={20} radius={Radius.full} />
          </View>
        </View>
        <Skeleton width={28} height={28} radius={Radius.full} />
      </View>
    </View>
  );
}

// ─── ActivityItem skeleton ────────────────────────────────────────────────────

export function ActivityItemSkeleton() {
  return (
    <View style={styles.activityItem}>
      <Skeleton width={36} height={36} radius={Radius.full} />
      <View style={styles.activityContent}>
        <Skeleton width="60%" height={13} />
        <Skeleton width="40%" height={11} style={styles.mt4} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.skeleton,
  },
  aiCard: {
    padding: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiHeaderText: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  taskCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskContent: {
    flex: 1,
    gap: 6,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  activityContent: {
    flex: 1,
  },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt12: { marginTop: 12 },
  mr8: { marginRight: 8 },
});
