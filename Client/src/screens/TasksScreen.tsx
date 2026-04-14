import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { OfflineBanner } from '../components/common/OfflineBanner';
import { TaskCardSkeleton } from '../components/common/Skeleton';
import { useTasks } from '../hooks/useTasks';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineSync } from '../hooks/useOfflineSync';
import {
  Colors,
  Typography,
  Spacing,
  Radius,
  Shadows,
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getStatusLabel,
} from '../theme';
import type { Task, TaskStatus, TaskPriority } from '../types';
import type { MainTabScreenProps, RootStackParamList } from '../navigation/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = MainTabScreenProps<'Tasks'>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

type KanbanColumn = { status: TaskStatus; label: string; color: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: KanbanColumn[] = [
  { status: 'todo',        label: 'To Do',      color: Colors.statusTodo        },
  { status: 'in_progress', label: 'In Progress', color: Colors.statusInProgress },
  { status: 'done',        label: 'Done',        color: Colors.statusDone       },
];

const PRIORITY_FILTERS: Array<{ value: TaskPriority | 'all'; label: string }> = [
  { value: 'all',      label: 'All'         },
  { value: 'critical', label: '🔴 Critical' },
  { value: 'high',     label: '🟠 High'     },
  { value: 'medium',   label: '🟡 Medium'   },
  { value: 'low',      label: '⚪ Low'      },
];

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onPress,
  onLongPress,
  isPending,
}: {
  task: Task;
  onPress: () => void;
  onLongPress: () => void;
  isPending: boolean;
}) {
  const priorityColor = getPriorityColor(task.priority);
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== 'done';

  return (
    <TouchableOpacity
      style={[styles.taskCard, isPending && styles.taskCardPending]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      <View style={[styles.taskPriorityBar, { backgroundColor: priorityColor }]} />
      <View style={styles.taskCardContent}>
        <View style={styles.taskCardHeader}>
          <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
          {isPending && (
            <View style={styles.pendingDot}>
              <Text style={styles.pendingDotText}>↑</Text>
            </View>
          )}
        </View>
        {task.description ? (
          <Text style={styles.taskDescription} numberOfLines={2}>{task.description}</Text>
        ) : null}
        <View style={styles.taskCardFooter}>
          <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}20` }]}>
            <Text style={[styles.priorityBadgeText, { color: priorityColor }]}>
              {getPriorityLabel(task.priority)}
            </Text>
          </View>
          {task.dueDate && (
            <Text style={[styles.dueDate, isOverdue ? styles.dueDateOverdue : null]}>
              {isOverdue ? '⚠ ' : '📅 '}
              {new Date(task.dueDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          )}
          <View style={styles.assigneeAvatar}>
            <Text style={styles.assigneeAvatarText}>
              {(task.assignee?.fullName ?? task.assigneeId).slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </View>
        {isPending && (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>↑ Pending sync</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanCol({
  column,
  tasks,
  pendingIds,
  onTaskPress,
  onTaskLongPress,
}: {
  column: KanbanColumn;
  tasks: Task[];
  pendingIds: Set<string>;
  onTaskPress: (id: string) => void;
  onTaskLongPress: (task: Task) => void;
}) {
  return (
    <View style={styles.column}>
      <View style={styles.columnHeader}>
        <View style={[styles.columnDot, { backgroundColor: column.color }]} />
        <Text style={styles.columnTitle}>{column.label}</Text>
        <View style={styles.columnCount}>
          <Text style={styles.columnCountText}>{tasks.length}</Text>
        </View>
      </View>
      {tasks.length === 0 ? (
        <View style={styles.columnEmpty}>
          <Text style={styles.columnEmptyText}>No tasks</Text>
        </View>
      ) : (
        tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onPress={() => onTaskPress(task.id)}
            onLongPress={() => onTaskLongPress(task)}
            isPending={pendingIds.has(task.id)}
          />
        ))
      )}
    </View>
  );
}

// ─── Status Move Modal ────────────────────────────────────────────────────────

function StatusMoveModal({
  task,
  visible,
  onClose,
  onMove,
}: {
  task: Task | null;
  visible: boolean;
  onClose: () => void;
  onMove: (status: TaskStatus) => void;
}) {
  if (!task) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Move task</Text>
          <Text style={styles.modalSubtitle} numberOfLines={1}>{task.title}</Text>
          <View style={styles.modalDivider} />
          {COLUMNS.map((col) => (
            <TouchableOpacity
              key={col.status}
              style={[
                styles.modalOption,
                task.status === col.status && styles.modalOptionActive,
              ]}
              onPress={() => onMove(col.status)}
            >
              <View style={[styles.modalOptionDot, { backgroundColor: col.color }]} />
              <Text
                style={[
                  styles.modalOptionText,
                  task.status === col.status && styles.modalOptionTextActive,
                ]}
              >
                {col.label}
              </Text>
              {task.status === col.status && (
                <Text style={styles.modalOptionCheck}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TasksScreen(_: Props) {
  const navigation = useNavigation<RootNav>();
  const { isOnline } = useNetworkStatus();
  const { pendingCount } = useOfflineSync();

  const [activeFilter, setActiveFilter] = useState<TaskPriority | 'all'>('all');
  const [refreshing, setRefreshing]     = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);

  const { tasks, isLoading, refresh, updateTask } = useTasks({ autoFetch: true });

  const pendingIds = useMemo(
    () => new Set(tasks.filter((t) => t.id.startsWith('optimistic_')).map((t) => t.id)),
    [tasks],
  );

  const filtered = useMemo(
    () => activeFilter === 'all' ? tasks : tasks.filter((t) => t.priority === activeFilter),
    [tasks, activeFilter],
  );

  const byStatus = useMemo(
    () =>
      COLUMNS.reduce((acc, col) => {
        acc[col.status] = filtered.filter((t) => t.status === col.status);
        return acc;
      }, {} as Record<TaskStatus, Task[]>),
    [filtered],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleLongPress = useCallback((task: Task) => {
    setSelectedTask(task);
    setShowMoveModal(true);
  }, []);

  const handleMove = useCallback(
    async (status: TaskStatus) => {
      if (!selectedTask) return;
      setShowMoveModal(false);
      await updateTask(selectedTask.id, { status });
      setSelectedTask(null);
    },
    [selectedTask, updateTask],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <OfflineBanner />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tasks</Text>
          <Text style={styles.headerSubtitle}>
            {filtered.length} task{filtered.length !== 1 ? 's' : ''}
            {!isOnline && pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
          </Text>
        </View>
        {!isOnline && (
          <View style={styles.offlinePill}>
            <Text style={styles.offlinePillText}>● Offline</Text>
          </View>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {PRIORITY_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[
              styles.filterChip,
              activeFilter === f.value && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(f.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === f.value && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Kanban board */}
      {isLoading && tasks.length === 0 ? (
        <ScrollView>
          {[0, 1, 2].map((i) => <TaskCardSkeleton key={i} />)}
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primaryLight}
              colors={[Colors.primary]}
            />
          }
          contentContainerStyle={styles.kanbanContainer}
        >
          {COLUMNS.map((col) => (
            <KanbanCol
              key={col.status}
              column={col}
              tasks={byStatus[col.status] ?? []}
              pendingIds={pendingIds}
              onTaskPress={(id) => navigation.navigate('TaskDetail', { taskId: id })}
              onTaskLongPress={handleLongPress}
            />
          ))}
        </ScrollView>
      )}

      {/* FAB — works offline */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewTask', undefined)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>

      <StatusMoveModal
        task={selectedTask}
        visible={showMoveModal}
        onClose={() => { setShowMoveModal(false); setSelectedTask(null); }}
        onMove={handleMove}
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
  filterBar: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterBarContent: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary },
  filterChipText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  filterChipTextActive: { color: Colors.primaryLight, fontWeight: Typography.semibold },
  kanbanContainer: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: 100,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  column: {
    width: 280,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  columnDot: { width: 8, height: 8, borderRadius: 4 },
  columnTitle: {
    flex: 1,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  columnCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  columnCountText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.semibold,
  },
  columnEmpty: { paddingVertical: Spacing.xl, alignItems: 'center' },
  columnEmptyText: { fontSize: Typography.xs, color: Colors.textMuted },
  taskCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.sm,
    marginVertical: Spacing.xs,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  taskCardPending: { borderColor: Colors.warning, borderStyle: 'dashed' },
  taskPriorityBar: { width: 4, flexShrink: 0 },
  taskCardContent: { flex: 1, padding: Spacing.md, gap: Spacing.xs },
  taskCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  taskTitle: {
    flex: 1,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  pendingDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDotText: { fontSize: 10, color: Colors.warning, fontWeight: Typography.bold },
  taskDescription: { fontSize: Typography.xs, color: Colors.textMuted, lineHeight: 16 },
  taskCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  priorityBadge: { paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: Radius.sm },
  priorityBadgeText: { fontSize: 10, fontWeight: Typography.semibold },
  dueDate: { flex: 1, fontSize: 10, color: Colors.textMuted },
  dueDateOverdue: { color: Colors.danger },
  assigneeAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeAvatarText: { fontSize: 9, fontWeight: Typography.bold, color: Colors.white },
  pendingBanner: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    marginTop: Spacing.xs,
  },
  pendingBannerText: { fontSize: 10, color: Colors.warning },
  fab: {
    position: 'absolute',
    right: Spacing.base,
    bottom: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.primary,
  },
  fabIcon: { fontSize: 28, color: Colors.white, lineHeight: 32, marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: 40,
    paddingTop: Spacing.md,
    ...Shadows.lg,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.base,
  },
  modalTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.base,
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  modalDivider: { height: 1, backgroundColor: Colors.border, marginBottom: Spacing.sm },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  modalOptionActive: { backgroundColor: Colors.primaryGlow },
  modalOptionDot: { width: 10, height: 10, borderRadius: 5 },
  modalOptionText: { flex: 1, fontSize: Typography.base, color: Colors.textSecondary },
  modalOptionTextActive: { color: Colors.primaryLight, fontWeight: Typography.semibold },
  modalOptionCheck: { fontSize: Typography.base, color: Colors.primary },
});
