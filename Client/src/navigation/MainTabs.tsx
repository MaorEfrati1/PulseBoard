import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useUIStore } from '../store/ui.store';
import type { MainTabsParamList } from './types';
import { Colors, Typography } from '../theme';

// ─── Real screens ─────────────────────────────────────────────────────────────

import FeedScreen    from '../screens/FeedScreen';
import TasksScreen   from '../screens/TasksScreen';
import TeamScreen    from '../screens/TeamScreen';
import ProfileScreen from '../screens/ProfileScreen';

// ─── Tab icons ────────────────────────────────────────────────────────────────

const ICONS: Record<keyof MainTabsParamList, { default: string; focused: string }> = {
  Feed:    { default: '📋', focused: '📋' },
  Tasks:   { default: '✅', focused: '✅' },
  Team:    { default: '👥', focused: '👥' },
  Profile: { default: '👤', focused: '👤' },
};

// ─── Unread Badge ─────────────────────────────────────────────────────────────

function UnreadBadge({ count }: { count: number }): React.JSX.Element | null {
  if (count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

// ─── Tab icon wrapper ─────────────────────────────────────────────────────────

function TabIcon({
  icon,
  focused,
  unreadCount = 0,
}: {
  icon: string;
  focused: boolean;
  unreadCount?: number;
}): React.JSX.Element {
  return (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperFocused]}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>{icon}</Text>
      {unreadCount > 0 && <UnreadBadge count={unreadCount} />}
    </View>
  );
}

// ─── Navigator ────────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<MainTabsParamList>();

export function MainTabs(): React.JSX.Element {
  const unreadCount = useUIStore((s) => s.unreadCount);
  const resetUnread = useUIStore((s) => s.resetUnread);

  const handleFeedFocus = useCallback(() => {
    if (unreadCount > 0) resetUnread();
  }, [unreadCount, resetUnread]);

  return (
    <Tab.Navigator
      initialRouteName="Feed"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primaryLight,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        listeners={{ focus: handleFeedFocus }}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={ICONS.Feed[focused ? 'focused' : 'default']}
              focused={focused}
              unreadCount={unreadCount}
            />
          ),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: styles.nativeBadge,
        }}
      />

      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={ICONS.Tasks[focused ? 'focused' : 'default']} focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="Team"
        component={TeamScreen}
        options={{
          tabBarLabel: 'Team',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={ICONS.Team[focused ? 'focused' : 'default']} focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={ICONS.Profile[focused ? 'focused' : 'default']} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.bgCard,   // dark (was #FFFFFF)
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: Typography.medium,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 28,
    borderRadius: 8,
  },
  iconWrapperFocused: {
    backgroundColor: Colors.primaryGlow,
  },
  icon: {
    fontSize: 20,
    opacity: 0.45,
  },
  iconFocused: {
    opacity: 1,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: Typography.bold,
    lineHeight: 12,
  },
  nativeBadge: {
    backgroundColor: Colors.danger,
    fontSize: 10,
  },
});
