import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '../store/auth.store';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineSync } from '../hooks/useOfflineSync';
import {
  Colors,
  Typography,
  Spacing,
  Radius,
  Shadows,
} from '../theme';
import type { MainTabScreenProps } from '../navigation/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = MainTabScreenProps<'Profile'>;

// ─── Section Row ──────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen(_: Props) {
  const user    = useAuthStore((s) => s.user);
  const logout  = useAuthStore((s) => s.logout);
  const { isOnline, networkStatus } = useNetworkStatus();
  const { pendingCount, isSyncing, sync, clearQueue } = useOfflineSync();

  const initials = user?.fullName
    ?.split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') ?? '?';

  const handleLogout = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: logout,
        },
      ],
    );
  };

  const handleClearQueue = () => {
    Alert.alert(
      'Clear sync queue',
      `This will permanently discard ${pendingCount} pending change${pendingCount !== 1 ? 's' : ''}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearQueue,
        },
      ],
    );
  };

  const networkLabel = {
    online: 'Online',
    offline: 'Offline',
    reconnecting: 'Reconnecting…',
  }[networkStatus];

  const networkColor = {
    online: Colors.success,
    offline: Colors.danger,
    reconnecting: Colors.warning,
  }[networkStatus];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user?.fullName ?? '—'}</Text>
          <Text style={styles.userEmail}>{user?.email ?? '—'}</Text>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary },
            ]}
          >
            <Text style={styles.roleBadgeText}>
              {user?.role?.toUpperCase() ?? 'MEMBER'}
            </Text>
          </View>
        </View>

        {/* Account info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.card}>
            <InfoRow label="Full name" value={user?.fullName ?? '—'} />
            <View style={styles.divider} />
            <InfoRow label="Email" value={user?.email ?? '—'} />
            <View style={styles.divider} />
            <InfoRow label="Role" value={user?.role ?? '—'} />
            <View style={styles.divider} />
            <InfoRow
              label="Member since"
              value={
                user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'
              }
            />
          </View>
        </View>

        {/* Network status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NETWORK</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={styles.networkStatus}>
                <View style={[styles.networkDot, { backgroundColor: networkColor }]} />
                <Text style={[styles.networkLabel, { color: networkColor }]}>
                  {networkLabel}
                </Text>
              </View>
            </View>
            {pendingCount > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Pending sync</Text>
                  <Text style={[styles.infoValue, { color: Colors.warning }]}>
                    {pendingCount} change{pendingCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Sync actions */}
          {pendingCount > 0 && (
            <View style={styles.syncActions}>
              <TouchableOpacity
                style={[
                  styles.syncBtn,
                  (!isOnline || isSyncing) ? styles.syncBtnDisabled : null,
                ]}
                onPress={sync}
                disabled={!isOnline || isSyncing}
              >
                <Text style={styles.syncBtnText}>
                  {isSyncing ? 'Syncing…' : 'Sync now'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={handleClearQueue}
              >
                <Text style={styles.clearBtnText}>Discard changes</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Sign out */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>TaskFlow v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { paddingBottom: 40 },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.primary,
  },
  avatarText: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.primaryLight,
  },
  userName: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  roleBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.primaryLight,
    letterSpacing: 0.8,
  },
  section: { paddingHorizontal: Spacing.base, paddingTop: Spacing.xl },
  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  infoLabel: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  infoValue: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.base },
  networkStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  networkDot: { width: 8, height: 8, borderRadius: 4 },
  networkLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold },
  syncActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  syncBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.primary,
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },
  clearBtn: {
    flex: 1,
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  clearBtnText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.danger,
  },
  logoutBtn: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.danger,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  logoutBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.danger,
  },
  version: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xl,
    paddingBottom: Spacing.base,
  },
});
