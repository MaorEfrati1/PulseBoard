import { StyleSheet } from 'react-native';

// ─── Color Palette ────────────────────────────────────────────────────────────

export const Colors = {
  // Backgrounds
  bg: '#0F1117',
  bgCard: '#1A1D27',
  bgElevated: '#21253A',
  bgInput: '#13161F',

  // Brand
  primary: '#6366F1',       // indigo-500
  primaryLight: '#818CF8',  // indigo-400
  primaryDark: '#4F46E5',   // indigo-600
  primaryGlow: 'rgba(99,102,241,0.15)',

  // Accents
  success: '#22C55E',
  successBg: 'rgba(34,197,94,0.12)',
  warning: '#F59E0B',
  warningBg: 'rgba(245,158,11,0.12)',
  danger: '#EF4444',
  dangerBg: 'rgba(239,68,68,0.12)',
  info: '#38BDF8',
  infoBg: 'rgba(56,189,248,0.12)',

  // Priority colours
  priorityLow: '#94A3B8',
  priorityMedium: '#38BDF8',
  priorityHigh: '#F59E0B',
  priorityCritical: '#EF4444',

  // Status colours
  statusTodo: '#94A3B8',
  statusInProgress: '#6366F1',
  statusBlocked: '#EF4444',
  statusDone: '#22C55E',

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
  textInverse: '#0F1117',

  // Borders
  border: '#1E2338',
  borderLight: '#2A2F45',

  // Misc
  white: '#FFFFFF',
  transparent: 'transparent',
  overlay: 'rgba(0,0,0,0.6)',
  skeleton: '#1E2338',
  skeletonHighlight: '#252942',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const Typography = {
  // Sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  xxxl: 38,

  // Weights (React Native uses string literals)
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,

  // Line heights
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  primary: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// ─── Common Shared Styles ─────────────────────────────────────────────────────

export const CommonStyles = StyleSheet.create({
  // Layout
  flex1: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: { alignItems: 'center', justifyContent: 'center' },

  // Screen container
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  // Card
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },

  // Input
  input: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.base,
  },

  // Text helpers
  textPrimary: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
  },
  textSecondary: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
  },
  textMuted: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // Badge
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    letterSpacing: 0.4,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

// ─── Priority helpers ─────────────────────────────────────────────────────────

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'low':      return Colors.priorityLow;
    case 'medium':   return Colors.priorityMedium;
    case 'high':     return Colors.priorityHigh;
    case 'critical': return Colors.priorityCritical;
    default:         return Colors.textMuted;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'todo':        return Colors.statusTodo;
    case 'in_progress': return Colors.statusInProgress;
    case 'blocked':     return Colors.statusBlocked;
    case 'done':        return Colors.statusDone;
    default:            return Colors.textMuted;
  }
}

export function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'low':      return 'Low';
    case 'medium':   return 'Medium';
    case 'high':     return 'High';
    case 'critical': return 'Critical';
    default:         return priority;
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'todo':        return 'To Do';
    case 'in_progress': return 'In Progress';
    case 'blocked':     return 'Blocked';
    case 'done':        return 'Done';
    default:            return status;
  }
}
