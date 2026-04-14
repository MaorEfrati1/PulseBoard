import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { OfflineBanner } from '../components/common/OfflineBanner';
import { useOnlinePresence } from '../hooks/useOnlinePresence';
import { useTasks } from '../hooks/useTasks';
import { useAuthStore } from '../store/auth.store';
import {
  Colors,
  Typography,
  Spacing,
  Radius,
  CommonStyles,
  getStatusColor,
  getStatusLabel,
} from '../theme';
import type { Task } from '../types';
import type { MainTabScreenProps, RootStackParamList } from '../navigation/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = MainTabScreenProps<'Team'>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

interface TeamMember {
  userId: string;
  userName: string;
  online: boolean;
  currentTask: Task | null;
  lastSeen?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lastSeenText(lastSeen?: string): string {
  if (!lastSeen) return 'Last seen: unknown';
  const diff = Date.now() - new Date(lastSeen).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Last seen: just now';
  if (mins < 60) return `Last seen: ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Last seen: ${hrs}h ago`;
  return `Last seen: ${Math.floor(hrs / 24)}d ago`;
}

// ─── Member Card ──────────────────────────────────────────────────────────────

function MemberCard({
  member,
  isCurrentUser,
  onTaskPress,
}: {
  member: TeamMember;
  isCurrentUser: boolean;
  onTaskPress: (taskId: string) => void;
}) {
  const initials = member.userName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View style={[styles.memberCard, isCurrentUser && styles.memberCardSelf]}>
      {/* Avatar + presence dot */}
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || '?'}</Text>
        </View>
        <View
          style={[
            styles.presenceDot,
            { backgroundColor: member.online ? Colors.success : Colors.textMuted },
          ]}
        />
      </View>

      {/* Info */}
      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={styles.memberName} numberOfLines={1}>
            {member.userName}
            {isCurrentUser ? ' (you)' : ''}
          </Text>
          <View
            style={[
              styles.onlinePill,
              {
                backgroundColor: member.online ? Colors.successBg : Colors.bgElevated,
                borderColor: member.online ? Colors.success : Colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.onlinePillText,
                { color: member.online ? Colors.success : Colors.textMuted },
              ]}
            >
              {member.online ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        {member.currentTask ? (
          <TouchableOpacity
            style={styles.currentTaskBadge}
            onPress={() => onTaskPress(member.currentTask!.id)}
          >
            <View
              style={[
                styles.currentTaskDot,
                { backgroundColor: getStatusColor(member.currentTask.status) },
              ]}
            />
            <Text style={styles.currentTaskText} numberOfLines={1}>
              {member.currentTask.title}
            </Text>
            <Text style={styles.currentTaskStatus}>
              · {getStatusLabel(member.currentTask.status)}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.noTaskText}>
            {member.online
              ? 'No active task'
              : lastSeenText(member.lastSeen)}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TeamScreen(_: Props) {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<RootNav>();
  const { onlineUsers, getOnlineCount } = useOnlinePresence();
  const { tasks } = useTasks({ autoFetch: true });

  const [refreshing, setRefreshing] = useState(false);

  // ── Build member list from presence + task data ─────────────────────────────

  const allUserIds = new Set<string>();
  onlineUsers.forEach((_, id) => allUserIds.add(id));
  tasks.forEach((t) => {
    if (t.assigneeId) allUserIds.add(t.assigneeId);
    if (t.assignee?.id) allUserIds.add(t.assignee.id);
  });

  const members: TeamMember[] = Array.from(allUserIds).map((uid) => {
    const presence = onlineUsers.get(uid);
    const taskWithAssignee = tasks.find((t) => t.assignee?.id === uid);
    const currentTask =
      tasks.find(
        (t) =>
          t.assigneeId === uid &&
          (t.status === 'in_progress' || t.status === 'todo'),
      ) ?? null;

    return {
      userId: uid,
      userName:
        presence?.userName ??
        taskWithAssignee?.assignee?.fullName ??
        `User ${uid.slice(0, 6)}`,
      online: presence?.online ?? false,
      currentTask,
      lastSeen: presence?.lastSeen,
    };
  });

  const onlineMembers  = members.filter((m) => m.online);
  const offlineMembers = members.filter((m) => !m.online);

  const sections = [
    ...(onlineMembers.length > 0
      ? [{ title: `Online · ${onlineMembers.length}`, data: onlineMembers }]
      : []),
    ...(offlineMembers.length > 0
      ? [{ title: `Offline · ${offlineMembers.length}`, data: offlineMembers }]
      : []),
  ];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
  }, []);

  const handleTaskPress = useCallback(
    (taskId: string) => navigation.navigate('TaskDetail', { taskId }),
    [navigation],
  );

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (members.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <OfflineBanner />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Team</Text>
        </View>
        <View style={[CommonStyles.flex1, CommonStyles.center]}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No teammates yet</Text>
          <Text style={styles.emptySubtitle}>
            Team members will appear here once they connect
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <OfflineBanner />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Team</Text>
          <Text style={styles.headerSubtitle}>
            {getOnlineCount()} of {members.length} online
          </Text>
        </View>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineBadgeDot} />
          <Text style={styles.onlineBadgeText}>{getOnlineCount()} online</Text>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <MemberCard
            member={item}
            isCurrentUser={item.userId === user?.id}
            onTaskPress={handleTaskPress}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
        )}
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
        stickySectionHeadersEnabled={false}
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
  headerTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  headerSubtitle: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.successBg,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  onlineBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  onlineBadgeText: {
    fontSize: Typography.xs,
    color: Colors.success,
    fontWeight: Typography.semibold,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  sectionHeaderText: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  listContent: { paddingBottom: 40 },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  memberCardSelf: { backgroundColor: Colors.primaryGlow },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textSecondary,
  },
  presenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  memberInfo: { flex: 1, gap: Spacing.xs },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  memberName: {
    flex: 1,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  onlinePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  onlinePillText: { fontSize: Typography.xs, fontWeight: Typography.semibold },
  currentTaskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  currentTaskDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  currentTaskText: { flex: 1, fontSize: Typography.xs, color: Colors.textSecondary },
  currentTaskStatus: { fontSize: Typography.xs, color: Colors.textMuted, flexShrink: 0 },
  noTaskText: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
  emptyIcon: { fontSize: 48, textAlign: 'center', marginBottom: Spacing.md },
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
    paddingHorizontal: Spacing.xl,
    lineHeight: 20,
  },
});
