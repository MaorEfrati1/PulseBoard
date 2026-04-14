import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { OfflineBanner } from '../components/common/OfflineBanner';
import { AISummarySkeleton, ActivityItemSkeleton } from '../components/common/Skeleton';
import { useAuthStore } from '../store/auth.store';
import { useAISummary } from '../hooks/useAISummary';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { useTasks } from '../hooks/useTasks';
import { useOnlinePresence } from '../hooks/useOnlinePresence';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  Colors,
  Typography,
  Spacing,
  Radius,
  Shadows,
  CommonStyles,
} from '../theme';
import type { ActivityLog } from '../types';
import type { MainTabScreenProps, RootStackParamList } from '../navigation/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = MainTabScreenProps<'Feed'>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatsRow({
  activeTasks,
  completedToday,
}: {
  activeTasks: number;
  completedToday: number;
}) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{activeTasks}</Text>
        <Text style={styles.statLabel}>Active Tasks</Text>
        <View style={[styles.statAccent, { backgroundColor: Colors.primary }]} />
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{completedToday}</Text>
        <Text style={styles.statLabel}>Completed Today</Text>
        <View style={[styles.statAccent, { backgroundColor: Colors.success }]} />
      </View>
    </View>
  );
}

function AISummaryCard({
  isLoading,
  activitySummary,
  blockerReport,
  hasBlockers,
  onRefresh,
}: {
  isLoading: boolean;
  activitySummary: ReturnType<typeof useAISummary>['activitySummary'];
  blockerReport: ReturnType<typeof useAISummary>['blockerReport'];
  hasBlockers: boolean;
  onRefresh: () => void;
}) {
  if (isLoading) {
    return (
      <View style={[CommonStyles.card, styles.aiCard]}>
        <AISummarySkeleton />
      </View>
    );
  }

  return (
    <View style={[CommonStyles.card, styles.aiCard]}>
      {/* Header */}
      <View style={styles.aiCardHeader}>
        <View style={styles.aiIconWrap}>
          <Text style={styles.aiIcon}>✦</Text>
        </View>
        <View style={styles.aiHeaderText}>
          <Text style={styles.aiCardTitle}>AI Daily Summary</Text>
          <Text style={styles.aiCardSubtitle}>
            {activitySummary
              ? `Today · ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}`
              : 'No data yet'}
          </Text>
        </View>
        {hasBlockers && (
          <View style={styles.warningBadge}>
            <Text style={styles.warningBadgeIcon}>⚠</Text>
            <Text style={styles.warningBadgeText}>
              {blockerReport ? '1' : '?'} blocker
            </Text>
          </View>
        )}
        <TouchableOpacity
          onPress={onRefresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      {activitySummary ? (
        <>
          <Text style={styles.aiNarrative}>
            {activitySummary.completedTasks > 0
              ? `You completed ${activitySummary.completedTasks} task${activitySummary.completedTasks !== 1 ? 's' : ''} today`
              : 'No tasks completed yet today'}
            {activitySummary.blockedTasks > 0
              ? `, with ${activitySummary.blockedTasks} task${activitySummary.blockedTasks !== 1 ? 's' : ''} currently blocked.`
              : '. All clear — no blockers!'}
          </Text>

          <View style={styles.aiStatsRow}>
            <View style={styles.aiStatChip}>
              <Text style={styles.aiStatChipValue}>{activitySummary.completedTasks}</Text>
              <Text style={styles.aiStatChipLabel}>Done</Text>
            </View>
            <View style={styles.aiStatChip}>
              <Text
                style={[
                  styles.aiStatChipValue,
                  activitySummary.blockedTasks > 0 ? { color: Colors.danger } : null,
                ]}
              >
                {activitySummary.blockedTasks}
              </Text>
              <Text style={styles.aiStatChipLabel}>Blocked</Text>
            </View>
            <View style={styles.aiStatChip}>
              <Text style={styles.aiStatChipValue}>
                {Math.round(activitySummary.averageCompletionTimeHours)}h
              </Text>
              <Text style={styles.aiStatChipLabel}>Avg. Time</Text>
            </View>
          </View>

          {blockerReport && blockerReport.suggestedActions.length > 0 && (
            <View style={styles.blockerBox}>
              <Text style={styles.blockerTitle}>
                ⚠ Blocker · {blockerReport.severity} severity
              </Text>
              <Text style={styles.blockerDescription}>
                {blockerReport.blockerDescription}
              </Text>
              <Text style={styles.blockerAction}>
                → {blockerReport.suggestedActions[0]}
              </Text>
            </View>
          )}
        </>
      ) : (
        <Text style={styles.aiNarrative}>
          Summary will appear after your first task activity today.
        </Text>
      )}
    </View>
  );
}

function OnlinePresenceStrip({
  onlineCount,
  onlineUserIds,
}: {
  onlineCount: number;
  onlineUserIds: string[];
}) {
  return (
    <View style={styles.presenceStrip}>
      <View style={styles.presenceDot} />
      <Text style={styles.presenceText}>
        {onlineCount === 0
          ? 'No teammates online'
          : `${onlineCount} teammate${onlineCount !== 1 ? 's' : ''} online`}
      </Text>
      {onlineUserIds.slice(0, 5).map((id, idx) => (
        <View
          key={id}
          style={[styles.presenceAvatar, { marginLeft: idx === 0 ? Spacing.sm : -8 }]}
        >
          <Text style={styles.presenceAvatarText}>
            {id.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      ))}
      {onlineCount > 5 && (
        <View style={[styles.presenceAvatar, { marginLeft: -8 }]}>
          <Text style={styles.presenceAvatarText}>+{onlineCount - 5}</Text>
        </View>
      )}
    </View>
  );
}

function ActivityItem({
  item,
  onTaskPress,
}: {
  item: ActivityLog;
  onTaskPress: (taskId: string) => void;
}) {
  const actionMap: Record<string, { icon: string; color: string }> = {
    task_created:   { icon: '＋', color: Colors.primary    },
    task_updated:   { icon: '✎',  color: Colors.info       },
    task_completed: { icon: '✓',  color: Colors.success    },
    task_blocked:   { icon: '⊗',  color: Colors.danger     },
    comment_added:  { icon: '✉',  color: Colors.warning    },
    status_changed: { icon: '⇄',  color: Colors.primaryLight },
  };
  const meta = actionMap[item.action] ?? { icon: '•', color: Colors.textMuted };
  const isTaskAction = item.entityType === 'task';

  return (
    <TouchableOpacity
      style={styles.activityItem}
      onPress={() => isTaskAction && onTaskPress(item.entityId)}
      activeOpacity={isTaskAction ? 0.7 : 1}
    >
      <View style={[styles.activityIconWrap, { backgroundColor: `${meta.color}20` }]}>
        <Text style={[styles.activityIcon, { color: meta.color }]}>{meta.icon}</Text>
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityText} numberOfLines={2}>
          <Text style={styles.activityUser}>
            {item.user?.fullName ?? 'Someone'}{' '}
          </Text>
          {item.action.replace(/_/g, ' ')}
        </Text>
        <Text style={styles.activityTime}>{formatTimeAgo(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FeedScreen(_: Props) {
  const user = useAuthStore((s) => s.user);
  const { isOnline } = useNetworkStatus();
  const navigation = useNavigation<RootNav>();

  const { tasks, isLoading: tasksLoading } = useTasks({ autoFetch: true });

  const activeTasks = tasks.filter(
    (t) => t.status === 'todo' || t.status === 'in_progress',
  ).length;

  const completedToday = tasks.filter((t) => {
    if (t.status !== 'done') return false;
    const updated = new Date(t.updatedAt);
    const today = new Date();
    return (
      updated.getFullYear() === today.getFullYear() &&
      updated.getMonth()    === today.getMonth()    &&
      updated.getDate()     === today.getDate()
    );
  }).length;

  const blockedTaskIds = tasks
    .filter((t) => t.status === 'blocked')
    .map((t) => t.id);

  const {
    activitySummary,
    isLoading: aiLoading,
    blockerReport,
    hasBlockers,
    refresh: refreshAI,
  } = useAISummary({ period: 'day', blockedTaskIds, autoFetch: isOnline });

  const {
    activities,
    isLoading: feedLoading,
    hasNextPage,
    refresh: refreshFeed,
    loadMore,
  } = useActivityFeed({
    filters: user?.id ? { userId: user.id } : {},
    pollInterval: 15_000,
    autoStart: isOnline,
  });

  const { onlineUserIds, getOnlineCount } = useOnlinePresence();

  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshFeed(), refreshAI()]);
    setRefreshing(false);
  }, [refreshFeed, refreshAI]);

  const handleTaskPress = useCallback(
    (taskId: string) => navigation.navigate('TaskDetail', { taskId }),
    [navigation],
  );

  // ── List header ─────────────────────────────────────────────────────────────

  const ListHeader = (
    <View>
      <StatsRow activeTasks={activeTasks} completedToday={completedToday} />
      <View style={styles.sectionPad}>
        <AISummaryCard
          isLoading={aiLoading || tasksLoading}
          activitySummary={activitySummary}
          blockerReport={blockerReport}
          hasBlockers={hasBlockers}
          onRefresh={refreshAI}
        />
      </View>
      <OnlinePresenceStrip
        onlineCount={getOnlineCount()}
        onlineUserIds={onlineUserIds}
      />
      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>Recent Activity</Text>
      </View>
    </View>
  );

  const ListEmpty = feedLoading ? (
    <View>
      {[0, 1, 2, 3].map((i) => <ActivityItemSkeleton key={i} />)}
    </View>
  ) : (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No recent activity</Text>
      <Text style={styles.emptySubtitle}>
        Activity from you and your team will appear here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <OfflineBanner />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Good{' '}
            {new Date().getHours() < 12
              ? 'morning'
              : new Date().getHours() < 17
              ? 'afternoon'
              : 'evening'}
            ,
          </Text>
          <Text style={styles.userName}>
            {user?.fullName?.split(' ')[0] ?? 'there'} 👋
          </Text>
        </View>
        {!isOnline && (
          <View style={styles.offlinePill}>
            <Text style={styles.offlinePillText}>Offline</Text>
          </View>
        )}
      </View>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActivityItem item={item} onTaskPress={handleTaskPress} />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        onEndReached={hasNextPage ? loadMore : undefined}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primaryLight}
            colors={[Colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  greeting: { fontSize: Typography.sm, color: Colors.textSecondary },
  userName: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  offlinePill: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  offlinePillText: {
    fontSize: Typography.xs,
    color: Colors.warning,
    fontWeight: Typography.semibold,
  },
  listContent: { paddingBottom: Spacing.xxxl },
  sectionPad: { paddingHorizontal: Spacing.base, marginBottom: Spacing.md },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, position: 'relative' },
  statValue: {
    fontSize: Typography.xxxl,
    fontWeight: Typography.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: Typography.medium,
    letterSpacing: 0.4,
  },
  statAccent: { position: 'absolute', bottom: 0, width: 20, height: 3, borderRadius: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.border },

  // AI Card
  aiCard: { marginBottom: 0 },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  aiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiIcon: { fontSize: 18, color: Colors.primaryLight },
  aiHeaderText: { flex: 1 },
  aiCardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  aiCardSubtitle: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  warningBadgeIcon: { fontSize: 10, color: Colors.warning },
  warningBadgeText: {
    fontSize: Typography.xs,
    color: Colors.warning,
    fontWeight: Typography.semibold,
  },
  refreshIcon: { fontSize: 18, color: Colors.textMuted },
  aiNarrative: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  aiStatsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  aiStatChip: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiStatChipValue: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  aiStatChipLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  blockerBox: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.danger,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  blockerTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.danger,
    letterSpacing: 0.3,
  },
  blockerDescription: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  blockerAction: { fontSize: Typography.sm, color: Colors.textSecondary },

  // Presence strip
  presenceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    marginRight: Spacing.sm,
  },
  presenceText: { flex: 1, fontSize: Typography.xs, color: Colors.textSecondary },
  presenceAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primaryDark,
    borderWidth: 1.5,
    borderColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceAvatarText: { fontSize: 10, fontWeight: Typography.bold, color: Colors.white },

  // Feed header
  feedHeader: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  feedTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Activity item
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  activityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityIcon: { fontSize: 16, fontWeight: Typography.bold },
  activityContent: { flex: 1 },
  activityText: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
  activityUser: { color: Colors.textPrimary, fontWeight: Typography.semibold },
  activityTime: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 3 },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.md },
  emptyTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
