import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { OfflineBanner } from '../components/common/OfflineBanner';
import { useTasks } from '../hooks/useTasks';
import { useAI } from '../hooks/useAI';
import { useSocket } from '../hooks/useSocket';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAuthStore } from '../store/auth.store';
import {
  Colors,
  Typography,
  Spacing,
  Radius,
  Shadows,
  CommonStyles,
  getPriorityColor,
  getStatusColor,
  getPriorityLabel,
  getStatusLabel,
} from '../theme';
import type { Task, TaskStatus, Message } from '../types';
import type { RootStackScreenProps, RootStackParamList } from '../navigation/types';
import { SocketEvent } from '../services/socket.service';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = RootStackScreenProps<'TaskDetail'>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

interface PendingMessage {
  id: string;
  role: 'user';
  content: string;
  createdAt: string;
  isPending: true;
}

interface TypingUser {
  userId: string;
  userName: string;
}

// ─── Status Chip ──────────────────────────────────────────────────────────────

function StatusChip({
  status,
  onPress,
}: {
  status: TaskStatus;
  onPress?: () => void;
}) {
  const color = getStatusColor(status);
  return (
    <TouchableOpacity
      style={[styles.statusChip, { backgroundColor: `${color}20`, borderColor: color }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusChipText, { color }]}>{getStatusLabel(status)}</Text>
    </TouchableOpacity>
  );
}

// ─── Chat Message ─────────────────────────────────────────────────────────────

function ChatMessage({
  message,
  isPending,
}: {
  message: Message | PendingMessage;
  isPending: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowOther]}>
      {!isUser && (
        <View style={[styles.messageAvatar, styles.messageAvatarAI]}>
          <Text style={styles.messageAvatarText}>✦</Text>
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.messageBubbleUser : styles.messageBubbleOther,
          isPending ? styles.messageBubblePending : null,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser ? styles.messageTextUser : styles.messageTextOther,
            isPending ? styles.messageTextPending : null,
          ]}
        >
          {message.content}
        </Text>
        {isPending && (
          <Text style={styles.messagePendingLabel}>Sending when online…</Text>
        )}
        <Text style={styles.messageTime}>
          {new Date(message.createdAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ users }: { users: TypingUser[] }) {
  if (users.length === 0) return null;
  const names =
    users.length === 1
      ? users[0].userName
      : `${users[0].userName} and ${users.length - 1} other${users.length > 2 ? 's' : ''}`;
  return (
    <View style={styles.typingRow}>
      <View style={styles.typingDots}>
        {[0, 1, 2].map((i) => <View key={i} style={styles.typingDot} />)}
      </View>
      <Text style={styles.typingText}>{names} is typing…</Text>
    </View>
  );
}

// ─── Meta Row ─────────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TaskDetailScreen({ route }: Props) {
  const { taskId } = route.params;
  const navigation = useNavigation<RootNav>();

  const user = useAuthStore((s) => s.user);
  const { isOnline } = useNetworkStatus();

  const { tasks, updateTask } = useTasks({ autoFetch: false });
  const task = tasks.find((t) => t.id === taskId) ?? null;

  const { messages, isChatLoading, sendMessage } = useAI();

  const { emit, on, off, joinRoom, leaveRoom, isConnected } = useSocket({
    autoConnect: false,
  });

  const [inputText, setInputText]         = useState('');
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [typingUsers, setTypingUsers]     = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping]           = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Join / leave room ───────────────────────────────────────────────────────

  useEffect(() => {
    if (isConnected) joinRoom(taskId);
    return () => { if (isConnected) leaveRoom(taskId); };
  }, [taskId, isConnected, joinRoom, leaveRoom]);

  // ── Typing events ───────────────────────────────────────────────────────────

  useEffect(() => {
    type TypingPayload = { userId: string; userName: string; isTyping: boolean; taskId: string };

    const handleTyping = (data: TypingPayload) => {
      if (data.taskId !== taskId || data.userId === user?.id) return;
      setTypingUsers((prev) =>
        data.isTyping
          ? prev.find((u) => u.userId === data.userId)
            ? prev
            : [...prev, { userId: data.userId, userName: data.userName }]
          : prev.filter((u) => u.userId !== data.userId),
      );
    };

    on('typing:update' as SocketEvent, handleTyping as never);
    return () => { off('typing:update' as SocketEvent, handleTyping as never); };
  }, [taskId, user?.id, on, off]);

  // ── Input change → typing events ────────────────────────────────────────────

  const handleInputChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (!isConnected) return;
      if (!isTyping && text.length > 0) {
        setIsTyping(true);
        emit('typing:start' as SocketEvent, { taskId });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        emit('typing:stop' as SocketEvent, { taskId });
      }, 1_500);
    },
    [isTyping, isConnected, emit, taskId],
  );

  // ── Send ────────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    if (isTyping) {
      setIsTyping(false);
      if (isConnected) emit('typing:stop' as SocketEvent, { taskId });
    }
    if (!isOnline) {
      setPendingMessages((prev) => [
        ...prev,
        {
          id: `pending_${Date.now()}`,
          role: 'user',
          content: text,
          createdAt: new Date().toISOString(),
          isPending: true,
        },
      ]);
      return;
    }
    await sendMessage(text, taskId);
  }, [inputText, isTyping, isConnected, isOnline, emit, taskId, sendMessage]);

  // ── Status cycle ────────────────────────────────────────────────────────────

  const handleStatusCycle = useCallback(async () => {
    if (!task) return;
    const statuses: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];
    const next = statuses[(statuses.indexOf(task.status) + 1) % statuses.length];
    await updateTask(taskId, { status: next });
  }, [task, taskId, updateTask]);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (!task) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={CommonStyles.center}>
          <ActivityIndicator color={Colors.primaryLight} />
        </View>
      </SafeAreaView>
    );
  }

  const priorityColor = getPriorityColor(task.priority);
  const allMessages = [
    ...messages,
    ...pendingMessages.map((m) => m as unknown as Message),
  ];
  const pendingIds = new Set(pendingMessages.map((m) => m.id));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <OfflineBanner />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.flex1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Title + priority accent */}
          <View style={styles.titleSection}>
            <View style={[styles.priorityAccent, { backgroundColor: priorityColor }]} />
            <View style={styles.titleContent}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              {task.description ? (
                <Text style={styles.taskDescription}>{task.description}</Text>
              ) : null}
            </View>
          </View>

          {/* Status + priority chips */}
          <View style={styles.chipsRow}>
            <StatusChip status={task.status} onPress={handleStatusCycle} />
            <View
              style={[
                styles.priorityChip,
                { backgroundColor: `${priorityColor}20`, borderColor: priorityColor },
              ]}
            >
              <Text style={[styles.priorityChipText, { color: priorityColor }]}>
                {getPriorityLabel(task.priority)}
              </Text>
            </View>
          </View>

          {/* Meta */}
          <View style={[CommonStyles.card, styles.metaCard]}>
            <MetaRow
              label="Assignee"
              value={task.assignee?.fullName ?? task.assigneeId}
            />
            {task.dueDate && (
              <MetaRow
                label="Due"
                value={new Date(task.dueDate).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              />
            )}
            {task.tags.length > 0 && (
              <View style={styles.metaTagRow}>
                <Text style={styles.metaLabel}>Tags</Text>
                <View style={styles.tagsWrap}>
                  {task.tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <MetaRow
              label="Created"
              value={new Date(task.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            />
          </View>

          {/* Chat section */}
          <View style={styles.chatSection}>
            <Text style={styles.chatSectionTitle}>
              Task Chat
              {!isOnline && (
                <Text style={styles.chatOfflineNote}> (offline)</Text>
              )}
            </Text>

            {allMessages.length === 0 ? (
              <View style={styles.chatEmpty}>
                <Text style={styles.chatEmptyText}>
                  Ask the AI anything about this task
                </Text>
              </View>
            ) : (
              <View style={styles.messagesContainer}>
                {allMessages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isPending={pendingIds.has(msg.id)}
                  />
                ))}
              </View>
            )}

            <TypingIndicator users={typingUsers} />
            {isChatLoading && (
              <View style={styles.aiLoadingRow}>
                <View style={styles.aiLoadingDot} />
                <Text style={styles.aiLoadingText}>AI is thinking…</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Chat input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.chatInput}
            placeholder={
              isOnline ? 'Ask AI about this task…' : 'Message will send when online…'
            }
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              !inputText.trim() ? styles.sendBtnDisabled : null,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isChatLoading}
          >
            {isChatLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.sendBtnText}>{isOnline ? '↑' : '↗'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  flex1: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xxl },
  titleSection: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    gap: Spacing.md,
  },
  priorityAccent: { width: 4, borderRadius: 2, minHeight: 40, flexShrink: 0 },
  titleContent: { flex: 1 },
  taskTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: Spacing.xs,
  },
  taskDescription: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    flexWrap: 'wrap',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusChipText: { fontSize: Typography.xs, fontWeight: Typography.semibold },
  priorityChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  priorityChipText: { fontSize: Typography.xs, fontWeight: Typography.semibold },
  metaCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.base, gap: Spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  metaLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: Typography.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    width: 72,
    flexShrink: 0,
    paddingTop: 1,
  },
  metaValue: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary },
  metaTagRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  tagsWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  tag: {
    backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  tagText: { fontSize: Typography.xs, color: Colors.primaryLight },
  chatSection: { paddingHorizontal: Spacing.base },
  chatSectionTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
  },
  chatOfflineNote: { color: Colors.warning, fontWeight: Typography.regular },
  chatEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  chatEmptyText: { fontSize: Typography.sm, color: Colors.textMuted },
  messagesContainer: { gap: Spacing.md, marginBottom: Spacing.md },
  messageRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  messageAvatarAI: {
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  messageAvatarText: { fontSize: 12, color: Colors.primaryLight },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  messageBubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  messageBubbleOther: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  messageBubblePending: {
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warning,
    opacity: 0.8,
  },
  messageText: { fontSize: Typography.sm, lineHeight: 20 },
  messageTextUser: { color: Colors.white },
  messageTextOther: { color: Colors.textSecondary },
  messageTextPending: { color: Colors.warning },
  messagePendingLabel: {
    fontSize: 10,
    color: Colors.warning,
    marginTop: 3,
    fontStyle: 'italic',
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  typingDots: { flexDirection: 'row', gap: 3 },
  typingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.textMuted },
  typingText: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
  aiLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  aiLoadingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  aiLoadingText: { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  chatInput: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.sm,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.primary,
  },
  sendBtnDisabled: { backgroundColor: Colors.bgElevated },
  sendBtnText: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
});
