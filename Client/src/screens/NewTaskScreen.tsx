import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTasks } from '../hooks/useTasks';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAuthStore } from '../store/auth.store';
import {
  Colors,
  Typography,
  Spacing,
  Radius,
  Shadows,
  getPriorityColor,
  getPriorityLabel,
} from '../theme';
import type { TaskPriority } from '../types';
import type { CreateTaskPayload } from '../api/tasks.api';
import type { RootStackScreenProps } from '../navigation/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = RootStackScreenProps<'NewTask'>;

interface FormState {
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  tags: string;
}

interface FormErrors {
  title?: string;
  assigneeId?: string;
  general?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

// ─── Priority Chips ───────────────────────────────────────────────────────────

function PriorityChips({
  value,
  onChange,
  disabled,
}: {
  value: TaskPriority;
  onChange: (p: TaskPriority) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.chipsRow}>
      {PRIORITIES.map((p) => {
        const color = getPriorityColor(p);
        const isActive = value === p;
        return (
          <TouchableOpacity
            key={p}
            style={[
              styles.priorityChip,
              isActive
                ? { backgroundColor: `${color}25`, borderColor: color }
                : null,
            ]}
            onPress={() => onChange(p)}
            disabled={disabled}
          >
            <Text style={[styles.priorityChipText, isActive ? { color } : null]}>
              {getPriorityLabel(p)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Date Input ───────────────────────────────────────────────────────────────

function DateInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const [raw, setRaw] = useState(
    value ? new Date(value).toLocaleDateString('en-US') : '',
  );
  const [error, setError] = useState('');

  const handleChange = (text: string) => {
    setRaw(text);
    if (text === '') { setError(''); onChange(''); return; }
    const ymd = /^\d{4}-\d{2}-\d{2}$/.test(text);
    const mdy = /^\d{2}\/\d{2}\/\d{4}$/.test(text);
    if (ymd) {
      setError('');
      onChange(new Date(text).toISOString());
    } else if (mdy) {
      const [m, d, y] = text.split('/');
      setError('');
      onChange(new Date(`${y}-${m}-${d}`).toISOString());
    } else {
      setError('Use MM/DD/YYYY');
    }
  };

  return (
    <View>
      <View style={styles.inputWrap}>
        <Text style={styles.inputIcon}>📅</Text>
        <TextInput
          style={styles.input}
          placeholder="MM/DD/YYYY (optional)"
          placeholderTextColor={Colors.textMuted}
          value={raw}
          onChangeText={handleChange}
          keyboardType="numbers-and-punctuation"
          editable={!disabled}
        />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.title.trim())         errors.title = 'Title is required';
  else if (form.title.trim().length > 200)
                                   errors.title = 'Max 200 characters';
  if (!form.assigneeId.trim())    errors.assigneeId = 'Assignee ID is required';
  return errors;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NewTaskScreen({ route, navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const { isOnline } = useNetworkStatus();
  const { createTask } = useTasks({ autoFetch: false });

  // Pre-fill assigneeId if passed via route params
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    priority: 'medium',
    assigneeId: route.params?.assigneeId ?? user?.id ?? '',
    dueDate: '',
    tags: '',
  });

  const [errors, setErrors]       = useState<FormErrors>({});
  const [touched, setTouched]     = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      if (touched[field]) {
        const errs = validate({ ...form, [field]: value });
        setErrors((prev) => ({ ...prev, [field]: errs[field as keyof FormErrors] }));
      }
    },
    [form, touched],
  );

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validate(form));
  };

  const handleSubmit = useCallback(async () => {
    setTouched({ title: true, assigneeId: true });
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setIsSubmitting(true);
    try {
      const payload: CreateTaskPayload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        assigneeId: form.assigneeId.trim(),
        dueDate: form.dueDate || undefined,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const created = await createTask(payload);
      navigation.goBack();
      // Navigate to new task detail if created successfully and online
      if (created?.id && isOnline) {
        navigation.navigate('TaskDetail', { taskId: created.id });
      }
    } catch (err) {
      setErrors({
        general: err instanceof Error ? err.message : 'Failed to create task',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [form, createTask, navigation, isOnline]);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      {/* Sheet handle */}
      <View style={styles.handle} />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {errors.general && (
            <View style={styles.generalError}>
              <Text style={styles.generalErrorText}>{errors.general}</Text>
            </View>
          )}

          {!isOnline && (
            <View style={styles.offlineNotice}>
              <Text style={styles.offlineNoticeText}>
                📴 Offline — task will sync when you reconnect
              </Text>
            </View>
          )}

          {/* Title */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TITLE *</Text>
            <View
              style={[
                styles.inputWrap,
                touched.title && errors.title ? styles.inputError : null,
              ]}
            >
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="What needs to be done?"
                placeholderTextColor={Colors.textMuted}
                value={form.title}
                onChangeText={(v) => set('title', v)}
                onBlur={() => handleBlur('title')}
                multiline
                maxLength={200}
                editable={!isSubmitting}
                autoFocus
              />
            </View>
            {touched.title && errors.title ? (
              <Text style={styles.fieldError}>{errors.title}</Text>
            ) : null}
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, styles.inputMultiline, styles.inputTall]}
                placeholder="Add more context… (optional)"
                placeholderTextColor={Colors.textMuted}
                value={form.description}
                onChangeText={(v) => set('description', v)}
                multiline
                maxLength={2000}
                editable={!isSubmitting}
              />
            </View>
          </View>

          {/* Priority */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PRIORITY</Text>
            <PriorityChips
              value={form.priority}
              onChange={(p) => set('priority', p)}
              disabled={isSubmitting}
            />
          </View>

          {/* Assignee */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ASSIGNEE ID *</Text>
            <View
              style={[
                styles.inputWrap,
                touched.assigneeId && errors.assigneeId ? styles.inputError : null,
              ]}
            >
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                placeholder="User ID"
                placeholderTextColor={Colors.textMuted}
                value={form.assigneeId}
                onChangeText={(v) => set('assigneeId', v)}
                onBlur={() => handleBlur('assigneeId')}
                autoCapitalize="none"
                editable={!isSubmitting}
              />
            </View>
            {touched.assigneeId && errors.assigneeId ? (
              <Text style={styles.fieldError}>{errors.assigneeId}</Text>
            ) : null}
          </View>

          {/* Due date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DUE DATE</Text>
            <DateInput
              value={form.dueDate}
              onChange={(v) => set('dueDate', v)}
              disabled={isSubmitting}
            />
          </View>

          {/* Tags */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TAGS</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>#</Text>
              <TextInput
                style={styles.input}
                placeholder="design, bug, frontend"
                placeholderTextColor={Colors.textMuted}
                value={form.tags}
                onChangeText={(v) => set('tags', v)}
                autoCapitalize="none"
                editable={!isSubmitting}
              />
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting ? styles.submitBtnDisabled : null]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isOnline ? 'Create Task' : 'Save (sync later)'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgCard },
  flex1: { flex: 1 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  scrollContent: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  generalError: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.danger,
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  generalErrorText: { fontSize: Typography.sm, color: Colors.danger },
  offlineNotice: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.warning,
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  offlineNoticeText: { fontSize: Typography.sm, color: Colors.warning },
  fieldGroup: { marginBottom: Spacing.base },
  fieldLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  inputError: { borderColor: Colors.danger },
  inputIcon: { fontSize: 16 },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    paddingVertical: Spacing.md,
  },
  inputMultiline: { textAlignVertical: 'top' },
  inputTall: { minHeight: 80, paddingTop: Spacing.md },
  fieldError: { fontSize: Typography.xs, color: Colors.danger, marginTop: Spacing.xs },
  chipsRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  priorityChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  priorityChipText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    minHeight: 52,
    ...Shadows.primary,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
    letterSpacing: 0.2,
  },
});
